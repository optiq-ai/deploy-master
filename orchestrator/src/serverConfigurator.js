/**
 * Moduł do zaawansowanej konfiguracji serwera
 * Implementuje dostosowane konfiguracje NGINX, obsługę routingu SPA i rozszerzoną obsługę API
 */

const fs = require('fs-extra');
const path = require('path');
const winston = require('winston');

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

/**
 * Główna funkcja do generowania konfiguracji serwera
 * @param {Object} projectInfo - Informacje o projekcie
 * @param {string} deployDir - Katalog docelowy dla zdeployowanego projektu
 * @param {number} port - Port, na którym będzie działać aplikacja
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateServerConfig(projectInfo, deployDir, port) {
  try {
    logger.info(`Generowanie konfiguracji serwera dla projektu typu: ${projectInfo.type}`);
    
    // Wczytanie analizy projektu, jeśli istnieje
    let projectAnalysis = {};
    const analysisPath = path.join(projectInfo.path, 'project-analysis.json');
    
    try {
      if (fs.existsSync(analysisPath)) {
        projectAnalysis = fs.readJsonSync(analysisPath);
        logger.debug(`Wczytano analizę projektu: ${JSON.stringify(projectAnalysis, null, 2)}`);
      }
    } catch (err) {
      logger.warn(`Nie można wczytać analizy projektu: ${err.message}`);
    }
    
    // Wybór strategii konfiguracji serwera na podstawie typu projektu
    const serverStrategy = selectServerStrategy(projectInfo.type, projectAnalysis);
    logger.info(`Wybrana strategia konfiguracji serwera: ${serverStrategy.name}`);
    
    // Generowanie konfiguracji serwera
    const serverConfig = await serverStrategy.generate({
      projectInfo,
      deployDir,
      port,
      projectAnalysis
    });
    
    // Zapisanie konfiguracji serwera
    await saveServerConfig(serverConfig, deployDir);
    
    logger.info(`Konfiguracja serwera dla projektu ${projectInfo.name} została wygenerowana pomyślnie`);
    return serverConfig;
  } catch (err) {
    logger.error(`Błąd podczas generowania konfiguracji serwera: ${err.message}`);
    throw err;
  }
}

/**
 * Wybór strategii konfiguracji serwera na podstawie typu projektu
 * @param {string} projectType - Typ projektu
 * @param {Object} projectAnalysis - Analiza projektu
 * @returns {Object} - Obiekt strategii konfiguracji serwera
 */
function selectServerStrategy(projectType, projectAnalysis) {
  const strategies = {
    // Strategie dla projektów React
    react: {
      name: 'react',
      generate: generateReactServerConfig
    },
    
    // Strategie dla projektów Next.js
    nextjs: {
      name: 'nextjs',
      generate: generateNextjsServerConfig
    },
    
    // Strategie dla projektów Vue
    vue: {
      name: 'vue',
      generate: generateVueServerConfig
    },
    
    // Strategie dla projektów Angular
    angular: {
      name: 'angular',
      generate: generateAngularServerConfig
    },
    
    // Strategie dla projektów Svelte
    svelte: {
      name: 'svelte',
      generate: generateSvelteServerConfig
    },
    
    // Strategie dla projektów SvelteKit
    sveltekit: {
      name: 'sveltekit',
      generate: generateSvelteKitServerConfig
    },
    
    // Strategie dla projektów Gatsby
    gatsby: {
      name: 'gatsby',
      generate: generateGatsbyServerConfig
    },
    
    // Strategie dla projektów Astro
    astro: {
      name: 'astro',
      generate: generateAstroServerConfig
    },
    
    // Strategie dla projektów Remix
    remix: {
      name: 'remix',
      generate: generateRemixServerConfig
    },
    
    // Strategie dla projektów Node.js
    node: {
      name: 'node',
      generate: generateNodeServerConfig
    },
    
    // Strategie dla projektów PHP
    php: {
      name: 'php',
      generate: generatePhpServerConfig
    },
    
    // Strategie dla projektów Python
    python: {
      name: 'python',
      generate: generatePythonServerConfig
    },
    
    // Strategie dla projektów statycznych
    static: {
      name: 'static',
      generate: generateStaticServerConfig
    },
    
    // Strategia domyślna
    default: {
      name: 'default',
      generate: generateDefaultServerConfig
    }
  };
  
  return strategies[projectType] || strategies.default;
}

/**
 * Zapisanie konfiguracji serwera
 * @param {Object} serverConfig - Konfiguracja serwera
 * @param {string} deployDir - Katalog docelowy dla zdeployowanego projektu
 * @returns {Promise<void>}
 */
async function saveServerConfig(serverConfig, deployDir) {
  try {
    // Zapisanie konfiguracji NGINX
    if (serverConfig.nginxConfig) {
      const nginxConfPath = path.join(deployDir, 'nginx.conf');
      await fs.writeFile(nginxConfPath, serverConfig.nginxConfig);
      logger.debug(`Zapisano konfigurację NGINX do pliku: ${nginxConfPath}`);
    }
    
    // Zapisanie konfiguracji Docker Compose
    if (serverConfig.dockerComposeConfig) {
      const dockerComposeConfPath = path.join(deployDir, 'docker-compose.server.yml');
      await fs.writeJson(dockerComposeConfPath, serverConfig.dockerComposeConfig, { spaces: 2 });
      logger.debug(`Zapisano konfigurację Docker Compose do pliku: ${dockerComposeConfPath}`);
    }
    
    // Zapisanie skryptów pomocniczych
    if (serverConfig.scripts) {
      for (const [scriptName, scriptContent] of Object.entries(serverConfig.scripts)) {
        const scriptPath = path.join(deployDir, scriptName);
        await fs.writeFile(scriptPath, scriptContent);
        await fs.chmod(scriptPath, 0o755); // Nadanie uprawnień do wykonania
        logger.debug(`Zapisano skrypt ${scriptName} do pliku: ${scriptPath}`);
      }
    }
  } catch (err) {
    logger.error(`Błąd podczas zapisywania konfiguracji serwera: ${err.message}`);
    throw err;
  }
}

/**
 * Generowanie konfiguracji serwera dla projektu React
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateReactServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla aplikacji React (SPA)
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA dla React Router
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*;";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Next.js
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateNextjsServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Skrypt do uruchomienia Next.js
  const serverScript = `
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: '.' });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(\`> Ready on http://localhost:\${port}\`);
  });
});
`;
  
  // Konfiguracja Docker Compose dla Next.js
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'node:16-alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:3000`],
        volumes: [`${deployDir}:/app`],
        working_dir: '/app',
        command: ['node', 'server.js'],
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    scripts: {
      'server.js': serverScript
    },
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Vue
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateVueServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla aplikacji Vue (SPA)
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA dla Vue Router
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*;";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Angular
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateAngularServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla aplikacji Angular (SPA)
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA dla Angular Router
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*;";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Svelte
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateSvelteServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla aplikacji Svelte (SPA)
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*;";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu SvelteKit
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateSvelteKitServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Skrypt do uruchomienia SvelteKit
  const serverScript = `
const { handler } = require('./build/handler.js');
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Obsługa plików statycznych
app.use(express.static(path.join(__dirname, 'build/client')));

// Obsługa SvelteKit
app.use(handler);

app.listen(port, '0.0.0.0', () => {
  console.log(\`SvelteKit app listening on port \${port}\`);
});
`;
  
  // Konfiguracja Docker Compose dla SvelteKit
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'node:16-alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:3000`],
        volumes: [`${deployDir}:/app`],
        working_dir: '/app',
        command: ['node', 'server.js'],
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    scripts: {
      'server.js': serverScript
    },
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Gatsby
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateGatsbyServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla aplikacji Gatsby (SPA)
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*;";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Astro
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateAstroServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla aplikacji Astro (SPA lub SSG)
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa routingu SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://*;";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Remix
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateRemixServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Skrypt do uruchomienia Remix
  const serverScript = `
const path = require('path');
const express = require('express');
const { createRequestHandler } = require('@remix-run/express');

const app = express();
const port = process.env.PORT || 3000;

// Obsługa plików statycznych
app.use(express.static(path.join(__dirname, 'public')));

// Obsługa Remix
app.all(
  '*',
  createRequestHandler({
    build: require('./build'),
    mode: process.env.NODE_ENV
  })
);

app.listen(port, '0.0.0.0', () => {
  console.log(\`Remix app listening on port \${port}\`);
});
`;
  
  // Konfiguracja Docker Compose dla Remix
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'node:16-alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:3000`],
        volumes: [`${deployDir}:/app`],
        working_dir: '/app',
        command: ['node', 'server.js'],
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    scripts: {
      'server.js': serverScript
    },
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Node.js
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateNodeServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja Docker Compose dla Node.js
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'node:16-alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:3000`],
        volumes: [`${deployDir}:/app`],
        working_dir: '/app',
        command: ['node', 'index.js'],
        environment: {
          NODE_ENV: 'production',
          PORT: '3000'
        },
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu PHP
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generatePhpServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja Docker Compose dla PHP
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'php:8.0-apache',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [`${deployDir}:/var/www/html`],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu Python
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generatePythonServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja Docker Compose dla Python
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'python:3.9-slim',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:5000`],
        volumes: [`${deployDir}:/app`],
        working_dir: '/app',
        command: ['sh', '-c', 'source venv/bin/activate && python app.py'],
        environment: {
          PYTHONUNBUFFERED: '1',
          PORT: '5000'
        },
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    dockerComposeConfig
  };
}

/**
 * Generowanie konfiguracji serwera dla projektu statycznego
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateStaticServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla projektu statycznego
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Obsługa plików HTML
    location ~* \\.html$ {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

/**
 * Generowanie domyślnej konfiguracji serwera
 * @param {Object} options - Opcje generowania
 * @returns {Promise<Object>} - Konfiguracja serwera
 */
async function generateDefaultServerConfig(options) {
  const { projectInfo, deployDir, port } = options;
  
  // Konfiguracja NGINX dla projektu domyślnego
  const nginxConfig = `
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;
    
    # Obsługa plików statycznych
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
    
    # Optymalizacja wydajności
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_proxied any;
    gzip_vary on;
    gzip_types
        application/javascript
        application/json
        application/x-javascript
        application/xml
        application/xml+rss
        text/css
        text/javascript
        text/plain
        text/xml;
    
    # Nagłówki bezpieczeństwa
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
}
`;
  
  // Konfiguracja Docker Compose dla NGINX
  const dockerComposeConfig = {
    services: {
      [`app_${projectInfo.id}`]: {
        image: 'nginx:alpine',
        container_name: `app_${projectInfo.id}`,
        restart: 'unless-stopped',
        ports: [`${port}:80`],
        volumes: [
          `${deployDir}:/usr/share/nginx/html`,
          `${path.join(deployDir, 'nginx.conf')}:/etc/nginx/conf.d/default.conf`
        ],
        networks: ['deploy-network']
      }
    }
  };
  
  return {
    nginxConfig,
    dockerComposeConfig
  };
}

module.exports = {
  generateServerConfig,
  selectServerStrategy,
  saveServerConfig
};
