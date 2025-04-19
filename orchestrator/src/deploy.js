const fs = require('fs-extra');
const path = require('path');
const extract = require('extract-zip');
const { exec } = require('child_process');
const winston = require('winston');
const dotenv = require('dotenv');
const findFreePort = require('find-free-port');
const Dockerode = require('dockerode');
const projectTypeDetector = require('./projectTypeDetector');
const projectBuilder = require('./projectBuilder');
const serverConfigurator = require('./serverConfigurator');

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
    
    // Analiza typu projektu przy użyciu zaawansowanego detektora
    const projectType = await projectTypeDetector.detectProjectType(extractDir);
    
    logger.info(`Projekt przeanalizowany: ${fileName}, wykryty typ: ${projectType}`);
    
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
    
    // Budowanie projektu przy użyciu zaawansowanego buildera
    await projectBuilder.buildProject(projectInfo, deployDir);
    
    // Generowanie konfiguracji serwera
    const serverConfig = await serverConfigurator.generateServerConfig(projectInfo, deployDir, freePort);
    
    // Generowanie konfiguracji kontenera
    const containerConfig = await generateContainerConfig(projectInfo, freePort, servicesObj, serverConfig);
    
    // Uruchomienie projektu bezpośrednio przez Docker API
    await startProjectWithDockerAPI(projectInfo.id, containerConfig);
    
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

// Funkcja do generowania konfiguracji kontenera
async function generateContainerConfig(projectInfo, port, services = {}, serverConfig = {}) {
  try {
    logger.info(`Generowanie konfiguracji kontenera dla projektu ${projectInfo.name}`);
    
    // Upewnienie się, że services jest obiektem
    if (!services || typeof services !== 'object') {
      logger.warn(`Nieprawidłowy format services, używanie pustego obiektu`);
      services = {};
    }
    
    const deployDir = path.join(DEPLOYED_DIR, projectInfo.id);
    const containerConfigs = [];
    
    // Podstawowa konfiguracja dla aplikacji
    let appContainerConfig = {};
    
    // Dostosowanie konfiguracji w zależności od typu projektu
    switch (projectInfo.type) {
      case 'nextjs':
        appContainerConfig = {
          name: `app_${projectInfo.id}`,
          Image: 'node:16-alpine',
          Cmd: ['node', 'server.js'],
          WorkingDir: '/app',
          HostConfig: {
            Binds: [`${deployDir}:/app`],
            PortBindings: {
              '3000/tcp': [{ HostPort: `${port}` }]
            },
            RestartPolicy: {
              Name: 'unless-stopped'
            }
          },
          ExposedPorts: {
            '3000/tcp': {}
          },
          NetworkingConfig: {
            EndpointsConfig: {
              'deploy-network': {}
            }
          }
        };
        break;
        
      case 'node':
        appContainerConfig = {
          name: `app_${projectInfo.id}`,
          Image: 'node:16-alpine',
          Cmd: ['node', 'index.js'],
          WorkingDir: '/app',
          HostConfig: {
            Binds: [`${deployDir}:/app`],
            PortBindings: {
              '3000/tcp': [{ HostPort: `${port}` }]
            },
            RestartPolicy: {
              Name: 'unless-stopped'
            }
          },
          ExposedPorts: {
            '3000/tcp': {}
          },
          NetworkingConfig: {
            EndpointsConfig: {
              'deploy-network': {}
            }
          }
        };
        break;
        
      case 'php':
        appContainerConfig = {
          name: `app_${projectInfo.id}`,
          Image: 'php:8.0-apache',
          HostConfig: {
            Binds: [`${deployDir}:/var/www/html`],
            PortBindings: {
              '80/tcp': [{ HostPort: `${port}` }]
            },
            RestartPolicy: {
              Name: 'unless-stopped'
            }
          },
          ExposedPorts: {
            '80/tcp': {}
          },
          NetworkingConfig: {
            EndpointsConfig: {
              'deploy-network': {}
            }
          }
        };
        break;
        
      case 'python':
        appContainerConfig = {
          name: `app_${projectInfo.id}`,
          Image: 'python:3.9-slim',
          Cmd: ['sh', '-c', 'source venv/bin/activate && python app.py'],
          WorkingDir: '/app',
          HostConfig: {
            Binds: [`${deployDir}:/app`],
            PortBindings: {
              '5000/tcp': [{ HostPort: `${port}` }]
            },
            RestartPolicy: {
              Name: 'unless-stopped'
            }
          },
          ExposedPorts: {
            '5000/tcp': {}
          },
          NetworkingConfig: {
            EndpointsConfig: {
              'deploy-network': {}
            }
          }
        };
        break;
        
      default:
        // Dla projektów statycznych i innych frontendowych używamy NGINX z konfiguracją SPA
        // Generowanie konfiguracji NGINX dla SPA
        const nginxConfPath = path.join(deployDir, 'nginx.conf');
        if (!fs.existsSync(nginxConfPath)) {
          const nginxConf = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA
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
        }
        
        appContainerConfig = {
          name: `app_${projectInfo.id}`,
          Image: 'nginx:alpine',
          HostConfig: {
            Binds: [
              `${deployDir}:/usr/share/nginx/html`,
              `${nginxConfPath}:/etc/nginx/conf.d/default.conf`
            ],
            PortBindings: {
              '80/tcp': [{ HostPort: `${port}` }]
            },
            RestartPolicy: {
              Name: 'unless-stopped'
            }
          },
          ExposedPorts: {
            '80/tcp': {}
          },
          NetworkingConfig: {
            EndpointsConfig: {
              'deploy-network': {}
            }
          }
        };
    }
    
    containerConfigs.push(appContainerConfig);
    
    // Dodanie bazy danych, jeśli jest włączona
    if (services.db && services.db.enabled) {
      const dbType = services.db.type || 'postgres';
      const dbUser = services.db.user || 'dbuser';
      const dbPassword = services.db.password || 'dbpassword';
      const dbName = services.db.name || 'appdb';
      
      // Znalezienie wolnego portu dla bazy danych
      const [dbPort] = await findFreePort(getDbPort(dbType));
      
      const dbContainerConfig = {
        name: `db_${projectInfo.id}`,
        Image: getDbImage(dbType),
        Env: [
          `POSTGRES_USER=${dbUser}`,
          `POSTGRES_PASSWORD=${dbPassword}`,
          `POSTGRES_DB=${dbName}`,
          `MYSQL_ROOT_PASSWORD=${dbPassword}`,
          `MYSQL_USER=${dbUser}`,
          `MYSQL_PASSWORD=${dbPassword}`,
          `MYSQL_DATABASE=${dbName}`,
          `MONGO_INITDB_ROOT_USERNAME=${dbUser}`,
          `MONGO_INITDB_ROOT_PASSWORD=${dbPassword}`
        ],
        HostConfig: {
          Binds: [`db_${projectInfo.id}_data:/var/lib/postgresql/data`],
          PortBindings: {
            [`${getDbPort(dbType)}/tcp`]: [{ HostPort: `${dbPort}` }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        },
        ExposedPorts: {
          [`${getDbPort(dbType)}/tcp`]: {}
        },
        NetworkingConfig: {
          EndpointsConfig: {
            'deploy-network': {}
          }
        }
      };
      
      containerConfigs.push(dbContainerConfig);
      
      // Utworzenie wolumenu dla danych bazy danych
      try {
        await docker.createVolume({
          Name: `db_${projectInfo.id}_data`
        });
        logger.info(`Utworzono wolumen db_${projectInfo.id}_data`);
      } catch (err) {
        logger.warn(`Błąd podczas tworzenia wolumenu: ${err.message}`);
      }
    }
    
    // Dodanie Redis, jeśli jest włączony
    if (services.redis && services.redis.enabled) {
      // Znalezienie wolnego portu dla Redis
      const [redisPort] = await findFreePort(6379);
      
      const redisContainerConfig = {
        name: `redis_${projectInfo.id}`,
        Image: 'redis:alpine',
        Cmd: ['redis-server', '--requirepass', services.redis.password || 'redispassword'],
        HostConfig: {
          PortBindings: {
            '6379/tcp': [{ HostPort: `${redisPort}` }]
          },
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        },
        ExposedPorts: {
          '6379/tcp': {}
        },
        NetworkingConfig: {
          EndpointsConfig: {
            'deploy-network': {}
          }
        }
      };
      
      containerConfigs.push(redisContainerConfig);
    }
    
    // Zapisanie konfiguracji kontenerów do pliku dla celów diagnostycznych
    await fs.writeJson(
      path.join(deployDir, 'container-configs.json'),
      containerConfigs,
      { spaces: 2 }
    );
    
    logger.info(`Wygenerowano konfigurację kontenerów dla projektu ${projectInfo.name}`);
    return containerConfigs;
  } catch (err) {
    logger.error(`Błąd podczas generowania konfiguracji kontenerów: ${err.message}`);
    throw err;
  }
}

// Funkcja do uruchamiania projektu bezpośrednio przez Docker API
async function startProjectWithDockerAPI(projectId, containerConfigs) {
  try {
    logger.info(`Uruchamianie projektu ${projectId} przez Docker API`);
    
    // Sprawdzenie, czy sieć deploy-network istnieje, jeśli nie, to ją utworzyć
    try {
      const networks = await docker.listNetworks();
      const networkExists = networks.some(network => network.Name === 'deploy-network');
      
      if (!networkExists) {
        logger.info('Tworzenie sieci deploy-network');
        await docker.createNetwork({
          Name: 'deploy-network',
          Driver: 'bridge'
        });
      }
    } catch (err) {
      logger.warn(`Błąd podczas sprawdzania/tworzenia sieci: ${err.message}`);
    }
    
    // Uruchomienie kontenerów
    for (const containerConfig of containerConfigs) {
      const containerName = containerConfig.name;
      
      // Sprawdzenie, czy kontener już istnieje
      try {
        const containers = await docker.listContainers({ all: true });
        const existingContainer = containers.find(container => 
          container.Names.some(name => name === `/${containerName}`)
        );
        
        if (existingContainer) {
          logger.info(`Kontener ${containerName} już istnieje, usuwanie...`);
          const container = docker.getContainer(existingContainer.Id);
          
          if (existingContainer.State === 'running') {
            await container.stop();
            logger.info(`Kontener ${containerName} zatrzymany`);
          }
          
          await container.remove();
          logger.info(`Kontener ${containerName} usunięty`);
        }
      } catch (err) {
        logger.warn(`Błąd podczas sprawdzania/usuwania kontenera: ${err.message}`);
      }
      
      // Tworzenie i uruchamianie kontenera
      try {
        logger.info(`Tworzenie kontenera ${containerName}`);
        
        // Usunięcie pola name z konfiguracji, ponieważ jest przekazywane osobno
        const { name, ...configWithoutName } = containerConfig;
        
        const container = await docker.createContainer({
          ...configWithoutName,
          name: containerName
        });
        
        logger.info(`Kontener ${containerName} utworzony`);
        
        await container.start();
        logger.info(`Kontener ${containerName} uruchomiony`);
      } catch (err) {
        logger.error(`Błąd podczas tworzenia/uruchamiania kontenera ${containerName}: ${err.message}`);
        throw err;
      }
    }
    
    logger.info(`Projekt ${projectId} uruchomiony pomyślnie przez Docker API`);
  } catch (err) {
    logger.error(`Błąd podczas uruchamiania projektu przez Docker API: ${err.message}`);
    throw err;
  }
}

// Funkcja do deploymentu pojedynczego pliku HTML
async function deploySingleHtml(htmlContent, fileName) {
  try {
    logger.info(`Rozpoczęcie deploymentu pojedynczego pliku HTML: ${fileName}`);
    
    const projectId = generateProjectId();
    const deployDir = path.join(DEPLOYED_DIR, projectId);
    
    // Utworzenie katalogu dla projektu
    await fs.ensureDir(deployDir);
    
    // Zapisanie pliku HTML
    const htmlFilePath = path.join(deployDir, 'index.html');
    await fs.writeFile(htmlFilePath, htmlContent);
    
    // Znalezienie wolnego portu
    const [freePort] = await findFreePort(8000);
    logger.info(`Przydzielony port: ${freePort}`);
    
    // Generowanie konfiguracji NGINX dla statycznej strony HTML
    const nginxConfPath = path.join(deployDir, 'nginx.conf');
    const nginxConf = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa statycznej strony HTML
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
    
    // Konfiguracja kontenera NGINX
    const containerConfig = {
      name: `app_${projectId}`,
      Image: 'nginx:alpine',
      HostConfig: {
        Binds: [
          `${deployDir}:/usr/share/nginx/html`,
          `${nginxConfPath}:/etc/nginx/conf.d/default.conf`
        ],
        PortBindings: {
          '80/tcp': [{ HostPort: `${freePort}` }]
        },
        RestartPolicy: {
          Name: 'unless-stopped'
        }
      },
      ExposedPorts: {
        '80/tcp': {}
      },
      NetworkingConfig: {
        EndpointsConfig: {
          'deploy-network': {}
        }
      }
    };
    
    // Uruchomienie kontenera przez Docker API
    await startProjectWithDockerAPI(projectId, [containerConfig]);
    
    // Zapisanie informacji o projekcie
    const projectData = {
      id: projectId,
      name: fileName.replace('.html', ''),
      type: 'static',
      port: freePort,
      url: `http://localhost:${freePort}`,
      deployedAt: new Date().toISOString()
    };
    
    await fs.writeJson(path.join(deployDir, 'project.json'), projectData);
    logger.info(`Deployment pojedynczego pliku HTML zakończony pomyślnie: ${projectId}`);
    
    return projectData;
  } catch (err) {
    logger.error(`Błąd podczas deploymentu pojedynczego pliku HTML: ${err.message}`);
    throw err;
  }
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
  deploySingleHtml,
  getProjectStatus,
  getDeployedProjects
};
