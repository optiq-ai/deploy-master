const fs = require('fs-extra');
const path = require('path');
const extract = require('extract-zip');
const { exec } = require('child_process');
const winston = require('winston');
const dotenv = require('dotenv');
const findFreePort = require('find-free-port');
const Dockerode = require('dockerode');

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
    new winston.transports.File({ filename: 'deploy.log' })
  ]
});

// Inicjalizacja klienta Docker
const docker = new Dockerode();

// Katalogi projektów
const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const DEPLOYED_DIR = path.join(__dirname, '..', 'deployed');

// Funkcja do analizy projektu
async function analyzeProject(filePath) {
  try {
    const fileName = path.basename(filePath);
    const projectId = generateProjectId();
    const extractDir = path.join(PROJECTS_DIR, projectId);
    
    // Utworzenie katalogu dla projektu
    await fs.ensureDir(extractDir);
    
    // Rozpakowanie projektu
    await extract(filePath, { dir: extractDir });
    
    // Analiza typu projektu
    const projectType = await detectProjectType(extractDir);
    
    return {
      id: projectId,
      name: fileName.replace('.zip', ''),
      type: projectType,
      path: extractDir
    };
  } catch (err) {
    logger.error(`Błąd podczas analizy projektu: ${err.message}`);
    throw err;
  }
}

// Funkcja do wykrywania typu projektu
async function detectProjectType(projectDir) {
  try {
    // Sprawdzenie, czy to projekt React
    if (fs.existsSync(path.join(projectDir, 'package.json'))) {
      const packageJson = require(path.join(projectDir, 'package.json'));
      
      if (packageJson.dependencies && 
         (packageJson.dependencies.react || 
          packageJson.dependencies.next || 
          packageJson.dependencies.vue)) {
        
        // Sprawdzenie, czy to Next.js
        if (packageJson.dependencies.next) {
          return 'nextjs';
        }
        
        // Sprawdzenie, czy to Vue.js
        if (packageJson.dependencies.vue) {
          return 'vue';
        }
        
        // Domyślnie React
        return 'react';
      }
    }
    
    // Sprawdzenie, czy to statyczna strona HTML
    if (fs.existsSync(path.join(projectDir, 'index.html'))) {
      return 'static';
    }
    
    // Domyślnie nieznany typ
    return 'unknown';
  } catch (err) {
    logger.error(`Błąd podczas wykrywania typu projektu: ${err.message}`);
    return 'unknown';
  }
}

// Funkcja do deploymentu projektu
async function deployProject(filePath, services = {}) {
  try {
    logger.info(`Rozpoczęcie deploymentu projektu: ${filePath}`);
    logger.debug(`Otrzymane dane usług: ${JSON.stringify(services)}`);
    
    // Upewnienie się, że services jest poprawnym obiektem JavaScript
    let servicesObj = {};
    try {
      if (typeof services === 'string') {
        logger.debug('Dane usług są stringiem, próba parsowania JSON');
        servicesObj = JSON.parse(services);
      } else if (services && typeof services === 'object') {
        logger.debug('Dane usług są obiektem');
        servicesObj = services;
      } else {
        logger.warn(`Nieoczekiwany format danych usług: ${typeof services}`);
      }
    } catch (jsonError) {
      logger.error(`Błąd parsowania JSON dla services: ${jsonError.message}`);
      servicesObj = {};
    }
    
    // Analiza projektu
    const projectInfo = await analyzeProject(filePath);
    logger.info(`Projekt przeanalizowany: ${projectInfo.name}, typ: ${projectInfo.type}`);
    
    // Znalezienie wolnego portu
    const [freePort] = await findFreePort(8000);
    logger.info(`Przydzielony port: ${freePort}`);
    
    // Przygotowanie katalogu dla zdeployowanego projektu
    const deployDir = path.join(DEPLOYED_DIR, projectInfo.id);
    await fs.ensureDir(deployDir);
    
    // Budowanie projektu w zależności od typu
    await buildProject(projectInfo, deployDir);
    
    // Generowanie docker-compose.override.yml
    await generateDockerComposeOverride(projectInfo, freePort, servicesObj);
    
    // Uruchomienie projektu
    await startProject(projectInfo.id);
    
    // Zapisanie informacji o projekcie
    const projectData = {
      id: projectInfo.id,
      name: projectInfo.name,
      type: projectInfo.type,
      port: freePort,
      url: `http://localhost:${freePort}`,
      services: servicesObj,
      deployedAt: new Date().toISOString()
    };
    
    await fs.writeJson(path.join(deployDir, 'project.json'), projectData);
    logger.info(`Deployment projektu zakończony pomyślnie: ${projectInfo.id}`);
    
    return projectData;
  } catch (err) {
    logger.error(`Błąd podczas deploymentu projektu: ${err.message}`);
    throw err;
  }
}

// Funkcja do budowania projektu
async function buildProject(projectInfo, deployDir) {
  return new Promise((resolve, reject) => {
    let buildCommand;
    
    switch (projectInfo.type) {
      case 'react':
        buildCommand = `cd ${projectInfo.path} && npm install && npm run build && cp -r build/* ${deployDir}`;
        break;
      case 'nextjs':
        buildCommand = `cd ${projectInfo.path} && npm install && npm run build`;
        break;
      case 'vue':
        buildCommand = `cd ${projectInfo.path} && npm install && npm run build && cp -r dist/* ${deployDir}`;
        break;
      case 'static':
        buildCommand = `cp -r ${projectInfo.path}/* ${deployDir}`;
        break;
      default:
        return reject(new Error(`Nieobsługiwany typ projektu: ${projectInfo.type}`));
    }
    
    exec(buildCommand, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Błąd podczas budowania projektu: ${error.message}`);
        return reject(error);
      }
      
      logger.info(`Projekt ${projectInfo.name} został zbudowany pomyślnie`);
      logger.debug(`Stdout: ${stdout}`);
      
      if (stderr) {
        logger.warn(`Stderr: ${stderr}`);
      }
      
      resolve();
    });
  });
}

// Funkcja do generowania docker-compose.override.yml
async function generateDockerComposeOverride(projectInfo, port, services) {
  try {
    logger.info(`Generowanie docker-compose.override.yml dla projektu ${projectInfo.name}`);
    logger.debug(`Dane usług przekazane do generateDockerComposeOverride: ${JSON.stringify(services)}`);
    
    const deployDir = path.join(DEPLOYED_DIR, projectInfo.id);
    
    // Upewnienie się, że services jest poprawnym obiektem
    if (!services || typeof services !== 'object') {
      logger.warn(`Nieprawidłowy format services, używanie pustego obiektu`);
      services = {};
    }
    
    // Podstawowa konfiguracja dla projektu
    let composeConfig = {
      version: '3.8',
      services: {
        [`app_${projectInfo.id}`]: {
          image: getImageForProjectType(projectInfo.type),
          container_name: `app_${projectInfo.id}`,
          restart: 'unless-stopped',
          ports: [`${port}:80`],
          volumes: [`${deployDir}:/usr/share/nginx/html`],
          networks: ['deploy-network']
        }
      },
      networks: {
        'deploy-network': {
          external: true
        }
      }
    };
    
    // Dodanie usług w zależności od wybranych opcji
    if (services.db && services.db.enabled) {
      logger.debug(`Konfigurowanie bazy danych typu: ${services.db.type || 'postgres'}`);
      const dbPort = await findFreePort(5432);
      
      composeConfig.services[`db_${projectInfo.id}`] = {
        image: getDbImage(services.db.type),
        container_name: `db_${projectInfo.id}`,
        restart: 'unless-stopped',
        environment: {
          POSTGRES_USER: services.db.user || 'dbuser',
          POSTGRES_PASSWORD: services.db.password || 'dbpassword',
          POSTGRES_DB: services.db.name || 'appdb',
          MYSQL_ROOT_PASSWORD: services.db.password || 'dbpassword',
          MYSQL_DATABASE: services.db.name || 'appdb',
          MYSQL_USER: services.db.user || 'dbuser',
          MYSQL_PASSWORD: services.db.password || 'dbpassword',
          MONGO_INITDB_ROOT_USERNAME: services.db.user || 'dbuser',
          MONGO_INITDB_ROOT_PASSWORD: services.db.password || 'dbpassword'
        },
        ports: [`${dbPort[0]}:${getDbPort(services.db.type)}`],
        volumes: [`db_data_${projectInfo.id}:/var/lib/postgresql/data`],
        networks: ['deploy-network']
      };
      
      composeConfig.volumes = {
        [`db_data_${projectInfo.id}`]: {}
      };
    }
    
    if (services.redis && services.redis.enabled) {
      logger.debug(`Konfigurowanie Redis`);
      const redisPort = await findFreePort(6379);
      
      composeConfig.services[`redis_${projectInfo.id}`] = {
        image: 'redis:alpine',
        container_name: `redis_${projectInfo.id}`,
        restart: 'unless-stopped',
        command: ['redis-server', '--requirepass', services.redis.password || 'redispassword'],
        ports: [`${redisPort[0]}:6379`],
        networks: ['deploy-network']
      };
    }
    
    // Zapisanie pliku docker-compose.override.yml
    logger.debug(`Zapisywanie konfiguracji docker-compose: ${JSON.stringify(composeConfig, null, 2)}`);
    await fs.writeJson(
      path.join(deployDir, 'docker-compose.override.yml'),
      composeConfig,
      { spaces: 2 }
    );
    
    logger.info(`Wygenerowano plik docker-compose.override.yml dla projektu ${projectInfo.name}`);
  } catch (err) {
    logger.error(`Błąd podczas generowania docker-compose.override.yml: ${err.message}`);
    throw err;
  }
}

// Funkcja do uruchamiania projektu
async function startProject(projectId) {
  return new Promise((resolve, reject) => {
    const deployDir = path.join(DEPLOYED_DIR, projectId);
    const command = `cd ${deployDir} && docker-compose -f docker-compose.override.yml up -d`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Błąd podczas uruchamiania projektu: ${error.message}`);
        return reject(error);
      }
      
      logger.info(`Projekt ${projectId} został uruchomiony pomyślnie`);
      logger.debug(`Stdout: ${stdout}`);
      
      if (stderr) {
        logger.warn(`Stderr: ${stderr}`);
      }
      
      resolve();
    });
  });
}

// Funkcja do pobierania statusu projektu
async function getProjectStatus(projectId) {
  try {
    const deployDir = path.join(DEPLOYED_DIR, projectId);
    
    if (!fs.existsSync(deployDir)) {
      throw new Error(`Projekt o ID ${projectId} nie istnieje`);
    }
    
    const projectJsonPath = path.join(deployDir, 'project.json');
    
    if (!fs.existsSync(projectJsonPath)) {
      throw new Error(`Brak pliku project.json dla projektu ${projectId}`);
    }
    
    const projectData = await fs.readJson(projectJsonPath);
    
    // Sprawdzenie statusu kontenerów
    const containers = await docker.listContainers();
    const projectContainers = containers.filter(container => 
      container.Names.some(name => name.includes(projectId))
    );
    
    const containersStatus = projectContainers.map(container => ({
      name: container.Names[0].replace('/', ''),
      state: container.State,
      status: container.Status
    }));
    
    return {
      ...projectData,
      containers: containersStatus,
      running: projectContainers.length > 0
    };
  } catch (err) {
    logger.error(`Błąd podczas pobierania statusu projektu: ${err.message}`);
    throw err;
  }
}

// Funkcja do pobierania listy zdeployowanych projektów
async function getDeployedProjects() {
  try {
    const deployedProjects = [];
    
    // Sprawdzenie, czy katalog istnieje
    if (!fs.existsSync(DEPLOYED_DIR)) {
      return deployedProjects;
    }
    
    const projectDirs = await fs.readdir(DEPLOYED_DIR);
    
    for (const projectId of projectDirs) {
      const projectJsonPath = path.join(DEPLOYED_DIR, projectId, 'project.json');
      
      if (fs.existsSync(projectJsonPath)) {
        const projectData = await fs.readJson(projectJsonPath);
        deployedProjects.push(projectData);
      }
    }
    
    return deployedProjects;
  } catch (err) {
    logger.error(`Błąd podczas pobierania listy projektów: ${err.message}`);
    throw err;
  }
}

// Funkcje pomocnicze
function generateProjectId() {
  return `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function getImageForProjectType(type) {
  switch (type) {
    case 'nextjs':
      return 'node:16-alpine';
    default:
      return 'nginx:alpine';
  }
}

function getDbImage(type) {
  switch (type) {
    case 'mysql':
      return 'mysql:8';
    case 'mongodb':
      return 'mongo:5';
    default:
      return 'postgres:14-alpine';
  }
}

function getDbPort(type) {
  switch (type) {
    case 'mysql':
      return 3306;
    case 'mongodb':
      return 27017;
    default:
      return 5432;
  }
}

module.exports = {
  analyzeProject,
  deployProject,
  getProjectStatus,
  getDeployedProjects
};
