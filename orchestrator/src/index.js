const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const helmet = require('helmet');
const { exec } = require('child_process');
const findFreePort = require('find-free-port');

// Konfiguracja środowiska
dotenv.config();

// Inicjalizacja Express
const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ strict: false })); // Dodane strict: false dla lepszej obsługi JSON
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
}));

// Konfiguracja bezpieczeństwa z helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "http://localhost:4000"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    }
  }
}));

// Funkcja pomocnicza do bezpiecznego parsowania JSON
function safeJsonParse(data, defaultValue = {}) {
  if (!data) return defaultValue;
  
  if (typeof data === 'object') {
    return data;
  }
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error(`Błąd parsowania JSON: ${error.message}`);
    console.error(`Dane wejściowe: ${typeof data === 'string' ? data.substring(0, 100) : typeof data}`);
    return defaultValue;
  }
}

// Katalogi projektów
const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const DEPLOYED_DIR = path.join(__dirname, '..', 'deployed');

// Funkcja do deploymentu pojedynczego pliku HTML
async function deploySingleHtml(htmlFile, htmlContent) {
  try {
    console.log(`Rozpoczęcie deploymentu pojedynczego pliku HTML: ${htmlFile}`);
    
    // Generowanie unikalnego ID projektu
    const projectId = `html_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    // Przygotowanie katalogu dla zdeployowanego projektu
    const deployDir = path.join(DEPLOYED_DIR, projectId);
    await fs.ensureDir(deployDir);
    
    // Zapisanie pliku HTML
    const htmlPath = path.join(deployDir, 'index.html');
    await fs.writeFile(htmlPath, htmlContent);
    
    console.log(`Plik HTML zapisany w: ${htmlPath}`);
    
    // Znalezienie wolnego portu
    const [freePort] = await findFreePort(8000);
    console.log(`Przydzielony port: ${freePort}`);
    
    // Generowanie konfiguracji NGINX dla statycznej strony
    const nginxConfPath = path.join(deployDir, 'nginx.conf');
    const nginxConf = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
`;
    
    await fs.writeFile(nginxConfPath, nginxConf);
    
    // Generowanie docker-compose.override.yml
    const composeConfig = {
      version: '3.8',
      services: {
        [`app_${projectId}`]: {
          image: 'nginx:alpine',
          container_name: `app_${projectId}`,
          restart: 'unless-stopped',
          ports: [`${freePort}:80`],
          volumes: [
            `${deployDir}:/usr/share/nginx/html`,
            `${nginxConfPath}:/etc/nginx/conf.d/default.conf`
          ],
          networks: ['deploy-network']
        }
      },
      networks: {
        'deploy-network': {
          external: true
        }
      }
    };
    
    // Zapisanie pliku docker-compose.override.yml
    await fs.writeJson(
      path.join(deployDir, 'docker-compose.override.yml'),
      composeConfig,
      { spaces: 2 }
    );
    
    // Uruchomienie kontenera
    await new Promise((resolve, reject) => {
      const command = `cd ${deployDir} && docker-compose -f docker-compose.override.yml up -d`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error(`Błąd podczas uruchamiania kontenera: ${error.message}`);
          return reject(error);
        }
        
        console.log(`Kontener dla projektu ${projectId} został uruchomiony pomyślnie`);
        console.log(`Stdout: ${stdout}`);
        
        if (stderr) {
          console.warn(`Stderr: ${stderr}`);
        }
        
        resolve();
      });
    });
    
    // Zapisanie informacji o projekcie
    const projectData = {
      id: projectId,
      name: htmlFile,
      type: 'html',
      port: freePort,
      url: `http://localhost:${freePort}`,
      deployedAt: new Date().toISOString()
    };
    
    await fs.writeJson(path.join(deployDir, 'project.json'), projectData);
    
    console.log(`Deployment pojedynczego pliku HTML zakończony pomyślnie: ${projectId}`);
    
    return projectData;
  } catch (err) {
    console.error(`Błąd podczas deploymentu pojedynczego pliku HTML: ${err.message}`);
    throw err;
  }
}

// Statyczne pliki dla UI
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint główny - UI do uploadu
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DeployMaster - Orkiestrator</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f7fa;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 20px;
          border-radius: 5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #3f51b5;
          text-align: center;
        }
        .status {
          padding: 15px;
          background-color: #e8f5e9;
          border-radius: 5px;
          margin-bottom: 20px;
          text-align: center;
        }
        .upload-form {
          margin-top: 20px;
          padding: 15px;
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .btn {
          background-color: #3f51b5;
          color: white;
          border: none;
          padding: 10px 15px;
          border-radius: 4px;
          cursor: pointer;
        }
        .btn:hover {
          background-color: #303f9f;
        }
        .tabs {
          display: flex;
          margin-bottom: 20px;
        }
        .tab {
          padding: 10px 15px;
          cursor: pointer;
          border: 1px solid #e0e0e0;
          background-color: #f5f7fa;
          margin-right: 5px;
          border-radius: 4px 4px 0 0;
        }
        .tab.active {
          background-color: white;
          border-bottom: 1px solid white;
        }
        .tab-content {
          display: none;
        }
        .tab-content.active {
          display: block;
        }
        textarea {
          width: 100%;
          min-height: 200px;
          margin-bottom: 10px;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          font-family: monospace;
        }
      </style>
      <script>
        function showTab(tabId) {
          // Ukryj wszystkie zakładki
          document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
          });
          
          // Usuń aktywną klasę ze wszystkich przycisków zakładek
          document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
          });
          
          // Pokaż wybraną zakładkę
          document.getElementById(tabId).classList.add('active');
          
          // Dodaj aktywną klasę do przycisku zakładki
          document.querySelector(\`[onclick="showTab('\${tabId}')"]\`).classList.add('active');
        }
      </script>
    </head>
    <body>
      <div class="container">
        <h1>DeployMaster - Orkiestrator</h1>
        <div class="status">
          <h2>System działa poprawnie!</h2>
          <p>Wszystkie komponenty zostały pomyślnie uruchomione.</p>
        </div>
        
        <div class="tabs">
          <div class="tab active" onclick="showTab('project-tab')">Projekt ZIP</div>
          <div class="tab" onclick="showTab('html-tab')">Pojedynczy HTML</div>
        </div>
        
        <div id="project-tab" class="tab-content active">
          <div class="upload-form">
            <h3>Wgraj projekt do deploymentu</h3>
            <form action="/api/upload" method="post" enctype="multipart/form-data">
              <input type="file" name="project" required>
              <button type="submit" class="btn">Wgraj projekt</button>
            </form>
          </div>
        </div>
        
        <div id="html-tab" class="tab-content">
          <div class="upload-form">
            <h3>Wgraj pojedynczy plik HTML</h3>
            <form action="/api/deploy-html" method="post" enctype="multipart/form-data">
              <input type="file" name="html" accept=".html,.htm" required>
              <button type="submit" class="btn">Wgraj i zdeployuj HTML</button>
            </form>
            
            <h3>Lub wklej kod HTML</h3>
            <form action="/api/deploy-html-content" method="post">
              <textarea name="htmlContent" placeholder="Wklej tutaj kod HTML..." required></textarea>
              <input type="text" name="fileName" placeholder="Nazwa pliku (np. moja-strona.html)" required>
              <button type="submit" class="btn">Zdeployuj HTML</button>
            </form>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API endpoint testowy
app.get('/api/status', (req, res) => {
  res.json({
    status: "ok",
    message: "System działa poprawnie",
    timestamp: new Date().toISOString()
  });
});

// API do uploadu projektów
app.post('/api/upload', async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ 
        status: false, 
        message: 'Nie przesłano żadnego pliku' 
      });
    }

    const projectFile = req.files.project;
    const uploadPath = path.join(__dirname, '..', 'projects', projectFile.name);
    
    // Upewnij się, że katalog projects istnieje
    await fs.ensureDir(path.join(__dirname, '..', 'projects'));

    // Zapisanie pliku
    await projectFile.mv(uploadPath);
    
    console.log(`Plik ${projectFile.name} został przesłany`);
    
    return res.status(200).json({
      status: true,
      message: 'Plik został przesłany pomyślnie',
      data: {
        fileName: projectFile.name,
        fileSize: projectFile.size,
      }
    });
  } catch (err) {
    console.error(`Błąd podczas uploadu: ${err.message}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas uploadu: ${err.message}`
    });
  }
});

// API do deploymentu pojedynczego pliku HTML (upload pliku)
app.post('/api/deploy-html', async (req, res) => {
  try {
    if (!req.files || !req.files.html) {
      return res.status(400).json({ 
        status: false, 
        message: 'Nie przesłano pliku HTML' 
      });
    }

    const htmlFile = req.files.html;
    
    // Sprawdzenie, czy plik jest HTML
    if (!htmlFile.name.toLowerCase().endsWith('.html') && !htmlFile.name.toLowerCase().endsWith('.htm')) {
      return res.status(400).json({
        status: false,
        message: 'Przesłany plik nie jest plikiem HTML'
      });
    }
    
    // Odczytanie zawartości pliku HTML
    const htmlContent = htmlFile.data.toString('utf8');
    
    // Deployment pliku HTML
    const projectData = await deploySingleHtml(htmlFile.name, htmlContent);
    
    return res.status(200).json({
      status: true,
      message: 'Plik HTML został pomyślnie zdeployowany',
      data: projectData
    });
  } catch (err) {
    console.error(`Błąd podczas deploymentu HTML: ${err.message}`);
    console.error(`Stack: ${err.stack}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas deploymentu HTML: ${err.message}`,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    });
  }
});

// API do deploymentu zawartości HTML (wklejony kod)
app.post('/api/deploy-html-content', async (req, res) => {
  try {
    const { htmlContent, fileName } = req.body;
    
    if (!htmlContent) {
      return res.status(400).json({
        status: false,
        message: 'Nie podano zawartości HTML'
      });
    }
    
    if (!fileName) {
      return res.status(400).json({
        status: false,
        message: 'Nie podano nazwy pliku'
      });
    }
    
    // Dodanie rozszerzenia .html, jeśli nie ma
    const htmlFileName = fileName.toLowerCase().endsWith('.html') || fileName.toLowerCase().endsWith('.htm') 
      ? fileName 
      : `${fileName}.html`;
    
    // Deployment zawartości HTML
    const projectData = await deploySingleHtml(htmlFileName, htmlContent);
    
    return res.status(200).json({
      status: true,
      message: 'Zawartość HTML została pomyślnie zdeployowana',
      data: projectData
    });
  } catch (err) {
    console.error(`Błąd podczas deploymentu zawartości HTML: ${err.message}`);
    console.error(`Stack: ${err.stack}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas deploymentu zawartości HTML: ${err.message}`,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    });
  }
});

// API do tworzenia i deploymentu projektów
app.post('/api/projects', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ 
        status: false, 
        message: 'Nie przesłano pliku projektu' 
      });
    }

    const projectFile = req.files.file;
    const projectName = req.body.name || projectFile.name.replace('.zip', '');
    const projectType = req.body.type || 'static';
    const environment = req.body.environment || 'dev';
    
    // Bezpieczne parsowanie JSON dla services z użyciem nowej funkcji pomocniczej
    const servicesObj = safeJsonParse(req.body.services, {});
    
    // Zapisanie pliku projektu
    const uploadPath = path.join(__dirname, '..', 'projects', projectFile.name);
    await fs.ensureDir(path.join(__dirname, '..', 'projects'));
    await projectFile.mv(uploadPath);
    
    console.log(`Plik projektu ${projectFile.name} został przesłany`);
    console.log(`Dane usług: ${JSON.stringify(servicesObj)}`);
    
    // Deployment projektu
    const deploy = require('./deploy');
    const projectData = await deploy.deployProject(uploadPath, servicesObj);
    
    return res.status(200).json({
      status: true,
      message: 'Projekt został pomyślnie utworzony i wdrożony',
      data: projectData
    });
  } catch (err) {
    console.error(`Błąd podczas deploymentu: ${err.message}`);
    console.error(`Stack: ${err.stack}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas deploymentu: ${err.message}`
    });
  }
});

// API do deploymentu projektu
app.post('/api/deploy', async (req, res) => {
  try {
    console.log('Otrzymano żądanie deploymentu');
    console.log(`Typ body: ${typeof req.body}`);
    console.log(`Zawartość body: ${JSON.stringify(req.body, null, 2)}`);
    
    const { fileName, services } = req.body;
    
    if (!fileName) {
      return res.status(400).json({
        status: false,
        message: 'Nie podano nazwy pliku projektu'
      });
    }
    
    // Ścieżka do pliku projektu
    const filePath = path.join(__dirname, '..', 'projects', fileName);
    
    // Sprawdzenie, czy plik istnieje
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({
        status: false,
        message: `Plik projektu ${fileName} nie istnieje`
      });
    }
    
    console.log(`Rozpoczęcie deploymentu projektu ${fileName}`);
    console.log(`Typ danych usług: ${typeof services}`);
    console.log(`Dane usług przed przetworzeniem: ${JSON.stringify(services)}`);
    
    // Bezpieczne parsowanie JSON dla services z użyciem nowej funkcji pomocniczej
    const servicesObj = safeJsonParse(services, {});
    
    console.log(`Dane usług po przetworzeniu: ${JSON.stringify(servicesObj)}`);
    
    // Deployment projektu
    const deploy = require('./deploy');
    const projectData = await deploy.deployProject(filePath, servicesObj);
    
    return res.status(200).json({
      status: true,
      message: 'Projekt został pomyślnie wdrożony',
      data: projectData
    });
  } catch (err) {
    console.error(`Błąd podczas deploymentu: ${err.message}`);
    console.error(`Stack: ${err.stack}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas deploymentu: ${err.message}`,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    });
  }
});

// Uruchomienie serwera
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orkiestrator uruchomiony na porcie ${PORT}`);
});

// Obsługa zamknięcia
process.on('SIGTERM', () => {
  console.log('Zamykanie serwera Orkiestratora...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Zamykanie serwera Orkiestratora...');
  process.exit(0);
});
