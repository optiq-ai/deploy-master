const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');
const helmet = require('helmet');

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
      </style>
    </head>
    <body>
      <div class="container">
        <h1>DeployMaster - Orkiestrator</h1>
        <div class="status">
          <h2>System działa poprawnie!</h2>
          <p>Wszystkie komponenty zostały pomyślnie uruchomione.</p>
        </div>
        
        <div class="upload-form">
          <h3>Wgraj projekt do deploymentu</h3>
          <form action="/api/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="project" required>
            <button type="submit" class="btn">Wgraj projekt</button>
          </form>
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
