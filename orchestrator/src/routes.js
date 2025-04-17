const express = require('express');
const path = require('path');
const handlebars = require('handlebars');
const fs = require('fs-extra');
const { exec } = require('child_process');
const winston = require('winston');
const dotenv = require('dotenv');

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
    new winston.transports.File({ filename: 'routes.log' })
  ]
});

// Inicjalizacja routera
const router = express.Router();

// Funkcja do renderowania szablonów
function renderTemplate(templateName, data = {}) {
  const templatePath = path.join(__dirname, 'szablony', `${templateName}.hbs`);
  const layoutPath = path.join(__dirname, 'szablony', 'layout.hbs');
  
  try {
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');
    
    const template = handlebars.compile(templateContent);
    const layout = handlebars.compile(layoutContent);
    
    const content = template(data);
    
    return layout({
      ...data,
      body: content
    });
  } catch (err) {
    logger.error(`Błąd podczas renderowania szablonu ${templateName}: ${err.message}`);
    throw err;
  }
}

// Strona główna
router.get('/', (req, res) => {
  try {
    const html = renderTemplate('home', {
      title: 'Strona główna',
      isHome: true
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Lista projektów
router.get('/projects', async (req, res) => {
  try {
    const deploy = require('./deploy');
    const projects = await deploy.getDeployedProjects();
    
    const html = renderTemplate('projects-list', {
      title: 'Projekty',
      isProjects: true,
      projects
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Nowy projekt
router.get('/projects/new', (req, res) => {
  try {
    const html = renderTemplate('new-project', {
      title: 'Nowy projekt',
      isNewProject: true
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Status projektu
router.get('/projects/:id', async (req, res) => {
  try {
    const deploy = require('./deploy');
    const projectId = req.params.id;
    
    const projectStatus = await deploy.getProjectStatus(projectId);
    
    const html = renderTemplate('project-status', {
      title: `Projekt: ${projectStatus.name}`,
      isProjects: true,
      ...projectStatus
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Logi projektu
router.get('/projects/:id/logs', async (req, res) => {
  try {
    const deploy = require('./deploy');
    const projectId = req.params.id;
    
    const projectStatus = await deploy.getProjectStatus(projectId);
    
    // Pobranie logów
    const logs = await new Promise((resolve, reject) => {
      exec(`docker logs app_${projectId}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Błąd podczas pobierania logów: ${error.message}`);
          return reject(error);
        }
        
        resolve(stdout || stderr || 'Brak dostępnych logów');
      });
    });
    
    const html = renderTemplate('project-logs', {
      title: `Logi projektu: ${projectStatus.name}`,
      isProjects: true,
      ...projectStatus,
      logs
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Ustawienia
router.get('/settings', (req, res) => {
  try {
    const html = renderTemplate('settings', {
      title: 'Ustawienia',
      isSettings: true
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Monitoring
router.get('/monitoring', (req, res) => {
  try {
    const html = renderTemplate('monitoring', {
      title: 'Monitoring',
      isMonitoring: true
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// Logi systemu
router.get('/logs', (req, res) => {
  try {
    const html = renderTemplate('logs', {
      title: 'Logi systemu',
      isLogs: true
    });
    
    res.send(html);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// API do zatrzymywania projektu
router.post('/api/projects/:id/stop', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    await new Promise((resolve, reject) => {
      exec(`cd /app/deployed/${projectId} && docker-compose -f docker-compose.override.yml down`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Błąd podczas zatrzymywania projektu: ${error.message}`);
          return reject(error);
        }
        
        logger.info(`Projekt ${projectId} został zatrzymany`);
        resolve();
      });
    });
    
    res.json({
      status: true,
      message: 'Projekt został zatrzymany'
    });
  } catch (err) {
    logger.error(`Błąd podczas zatrzymywania projektu: ${err.message}`);
    res.status(500).json({
      status: false,
      message: `Błąd podczas zatrzymywania projektu: ${err.message}`
    });
  }
});

// API do restartowania projektu
router.post('/api/projects/:id/restart', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    await new Promise((resolve, reject) => {
      exec(`cd /app/deployed/${projectId} && docker-compose -f docker-compose.override.yml restart`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Błąd podczas restartowania projektu: ${error.message}`);
          return reject(error);
        }
        
        logger.info(`Projekt ${projectId} został zrestartowany`);
        resolve();
      });
    });
    
    res.json({
      status: true,
      message: 'Projekt został zrestartowany'
    });
  } catch (err) {
    logger.error(`Błąd podczas restartowania projektu: ${err.message}`);
    res.status(500).json({
      status: false,
      message: `Błąd podczas restartowania projektu: ${err.message}`
    });
  }
});

// API do pobierania logów
router.get('/api/projects/:id/logs/download', async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Pobranie logów
    const logs = await new Promise((resolve, reject) => {
      exec(`docker logs app_${projectId}`, (error, stdout, stderr) => {
        if (error) {
          logger.error(`Błąd podczas pobierania logów: ${error.message}`);
          return reject(error);
        }
        
        resolve(stdout || stderr || 'Brak dostępnych logów');
      });
    });
    
    // Ustawienie nagłówków
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=logs_${projectId}.txt`);
    
    res.send(logs);
  } catch (err) {
    logger.error(`Błąd podczas pobierania logów: ${err.message}`);
    res.status(500).send(`Błąd podczas pobierania logów: ${err.message}`);
  }
});

module.exports = router;
