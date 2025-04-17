const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const winston = require('winston');
const dotenv = require('dotenv');
const deploy = require('./deploy');

// Konfiguracja środowiska
dotenv.config();

// Konfiguracja loggera
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'orchestrator.log' })
  ]
});

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
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

    // Zapisanie pliku
    await projectFile.mv(uploadPath);
    
    logger.info(`Plik ${projectFile.name} został przesłany`);
    
    // Analiza projektu
    const projectInfo = await deploy.analyzeProject(uploadPath);
    
    return res.status(200).json({
      status: true,
      message: 'Plik został przesłany pomyślnie',
      data: {
        fileName: projectFile.name,
        projectType: projectInfo.type,
        projectSize: projectFile.size,
      }
    });
  } catch (err) {
    logger.error(`Błąd podczas uploadu: ${err.message}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas uploadu: ${err.message}`
    });
  }
});

// API do deploymentu projektu
app.post('/api/deploy', async (req, res) => {
  try {
    const { fileName, services } = req.body;
    
    if (!fileName) {
      return res.status(400).json({
        status: false,
        message: 'Nie podano nazwy pliku'
      });
    }
    
    const filePath = path.join(__dirname, '..', 'projects', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        status: false,
        message: 'Plik nie istnieje'
      });
    }
    
    // Deployment projektu
    const deployResult = await deploy.deployProject(filePath, services);
    
    return res.status(200).json({
      status: true,
      message: 'Projekt został zdeployowany pomyślnie',
      data: deployResult
    });
  } catch (err) {
    logger.error(`Błąd podczas deploymentu: ${err.message}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas deploymentu: ${err.message}`
    });
  }
});

// API do pobierania statusu projektu
app.get('/api/status/:id', async (req, res) => {
  try {
    const projectId = req.params.id;
    const status = await deploy.getProjectStatus(projectId);
    
    return res.status(200).json({
      status: true,
      data: status
    });
  } catch (err) {
    logger.error(`Błąd podczas pobierania statusu: ${err.message}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas pobierania statusu: ${err.message}`
    });
  }
});

// API do pobierania listy zdeployowanych projektów
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await deploy.getDeployedProjects();
    
    return res.status(200).json({
      status: true,
      data: projects
    });
  } catch (err) {
    logger.error(`Błąd podczas pobierania listy projektów: ${err.message}`);
    return res.status(500).json({
      status: false,
      message: `Błąd podczas pobierania listy projektów: ${err.message}`
    });
  }
});

// Uruchomienie serwera
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Orkiestrator uruchomiony na porcie ${PORT}`);
});

// Obsługa zamknięcia
process.on('SIGTERM', () => {
  logger.info('Zamykanie serwera Orkiestratora...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Zamykanie serwera Orkiestratora...');
  process.exit(0);
});
