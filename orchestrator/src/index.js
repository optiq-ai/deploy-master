const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const fileUpload = require('express-fileupload');

// Konfiguracja środowiska
dotenv.config();

// Inicjalizacja Express
const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: 500 * 1024 * 1024 // 500MB limit
  },
}));

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
    
    // Bezpieczne parsowanie JSON dla services
    let services = {};
    if (req.body.services) {
      try {
        services = JSON.parse(req.body.services);
      } catch (jsonError) {
        console.error(`Błąd parsowania JSON dla services: ${jsonError.message}`);
        // Kontynuuj z pustym obiektem services zamiast zwracać błąd
      }
    }
    
    // Zapisanie pliku projektu
    const uploadPath = path.join(__dirname, '..', 'projects', projectFile.name);
    await fs.ensureDir(path.join(__dirname, '..', 'projects'));
    await projectFile.mv(uploadPath);
    
    console.log(`Plik projektu ${projectFile.name} został przesłany`);
    
    // Deployment projektu
    const deploy = require('./deploy');
    const projectData = await deploy.deployProject(uploadPath, services);
    
    return res.status(200).json({
      status: true,
      message: 'Projekt został pomyślnie utworzony i wdrożony',
      data: projectData
    });
  } catch (err) {
    console.error(`Błąd podczas deploymentu: ${err.message}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas deploymentu: ${err.message}`
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
