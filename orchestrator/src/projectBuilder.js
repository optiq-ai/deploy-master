/**
 * Moduł do zaawansowanego budowania projektów
 * Implementuje dynamiczne komendy budowania i inteligentne zarządzanie zależnościami
 */

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
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
 * Główna funkcja do budowania projektu
 * @param {Object} projectInfo - Informacje o projekcie
 * @param {string} deployDir - Katalog docelowy dla zdeployowanego projektu
 * @returns {Promise<void>}
 */
async function buildProject(projectInfo, deployDir) {
  try {
    logger.info(`Rozpoczęcie zaawansowanego budowania projektu typu: ${projectInfo.type}`);
    
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
    
    // Określenie menedżera pakietów
    const packageManager = determinePackageManager(projectInfo.path, projectAnalysis);
    logger.info(`Wykryty menedżer pakietów: ${packageManager}`);
    
    // Określenie wersji Node.js
    const nodeVersion = determineNodeVersion(projectAnalysis);
    logger.info(`Wykryta wersja Node.js: ${nodeVersion || 'domyślna'}`);
    
    // Przygotowanie zmiennych środowiskowych
    const envVars = prepareEnvironmentVariables(projectInfo.path, projectInfo.type);
    
    // Wybór strategii budowania na podstawie typu projektu
    const buildStrategy = selectBuildStrategy(projectInfo.type, projectAnalysis);
    logger.info(`Wybrana strategia budowania: ${buildStrategy.name}`);
    
    // Wykonanie budowania
    await executeBuildStrategy(buildStrategy, {
      projectInfo,
      deployDir,
      packageManager,
      nodeVersion,
      envVars,
      projectAnalysis
    });
    
    // Sprawdzenie zawartości katalogu deploymentu
    await verifyDeploymentDirectory(deployDir);
    
    logger.info(`Projekt ${projectInfo.name} został zbudowany pomyślnie`);
  } catch (err) {
    logger.error(`Błąd podczas budowania projektu: ${err.message}`);
    throw err;
  }
}

/**
 * Określenie menedżera pakietów na podstawie plików w projekcie
 * @param {string} projectDir - Katalog projektu
 * @param {Object} projectAnalysis - Analiza projektu
 * @returns {string} - Nazwa menedżera pakietów (npm, yarn, pnpm)
 */
function determinePackageManager(projectDir, projectAnalysis) {
  // Jeśli analiza już zawiera informację o menedżerze pakietów, użyj jej
  if (projectAnalysis.packageManager) {
    return projectAnalysis.packageManager;
  }
  
  // Sprawdź pliki lock
  if (fs.existsSync(path.join(projectDir, 'yarn.lock'))) {
    return 'yarn';
  } else if (fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  } else {
    return 'npm';
  }
}

/**
 * Określenie wersji Node.js na podstawie analizy projektu
 * @param {Object} projectAnalysis - Analiza projektu
 * @returns {string|null} - Wersja Node.js lub null jeśli nie określono
 */
function determineNodeVersion(projectAnalysis) {
  if (projectAnalysis.nodeVersion) {
    return projectAnalysis.nodeVersion;
  }
  
  if (projectAnalysis.packageJson && projectAnalysis.packageJson.engines && projectAnalysis.packageJson.engines.node) {
    return projectAnalysis.packageJson.engines.node;
  }
  
  return null;
}

/**
 * Przygotowanie zmiennych środowiskowych dla procesu budowania
 * @param {string} projectDir - Katalog projektu
 * @param {string} projectType - Typ projektu
 * @returns {Object} - Obiekt ze zmiennymi środowiskowymi
 */
function prepareEnvironmentVariables(projectDir, projectType) {
  const envVars = {
    NODE_ENV: 'production',
    CI: 'true'
  };
  
  // Sprawdź, czy istnieje plik .env
  const envPath = path.join(projectDir, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const envLines = envContent.split('\n');
      
      for (const line of envLines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          const value = valueParts.join('=');
          if (key && value) {
            envVars[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
          }
        }
      }
    } catch (err) {
      logger.warn(`Nie można wczytać pliku .env: ${err.message}`);
    }
  }
  
  // Dodaj specyficzne zmienne dla różnych typów projektów
  switch (projectType) {
    case 'react':
      envVars.GENERATE_SOURCEMAP = 'false';
      envVars.REACT_APP_ENV = 'production';
      break;
    case 'nextjs':
      envVars.NEXT_TELEMETRY_DISABLED = '1';
      break;
    case 'vue':
      envVars.VUE_APP_ENV = 'production';
      break;
  }
  
  return envVars;
}

/**
 * Wybór strategii budowania na podstawie typu projektu
 * @param {string} projectType - Typ projektu
 * @param {Object} projectAnalysis - Analiza projektu
 * @returns {Object} - Obiekt strategii budowania
 */
function selectBuildStrategy(projectType, projectAnalysis) {
  const strategies = {
    // Strategie dla projektów React
    react: {
      name: 'react',
      build: buildReactProject,
      detectVariant: () => {
        if (projectAnalysis.detectedFrameworks && projectAnalysis.detectedFrameworks['create-react-app']) {
          return 'create-react-app';
        } else if (projectAnalysis.detectedFrameworks && projectAnalysis.detectedFrameworks['vite']) {
          return 'vite';
        } else {
          return 'generic';
        }
      }
    },
    
    // Strategie dla projektów Next.js
    nextjs: {
      name: 'nextjs',
      build: buildNextjsProject
    },
    
    // Strategie dla projektów Vue
    vue: {
      name: 'vue',
      build: buildVueProject,
      detectVariant: () => {
        if (projectAnalysis.detectedFrameworks && projectAnalysis.detectedFrameworks['vue-cli']) {
          return 'vue-cli';
        } else if (projectAnalysis.detectedFrameworks && projectAnalysis.detectedFrameworks['vite']) {
          return 'vite';
        } else {
          return 'generic';
        }
      }
    },
    
    // Strategie dla projektów Angular
    angular: {
      name: 'angular',
      build: buildAngularProject
    },
    
    // Strategie dla projektów Svelte
    svelte: {
      name: 'svelte',
      build: buildSvelteProject
    },
    
    // Strategie dla projektów SvelteKit
    sveltekit: {
      name: 'sveltekit',
      build: buildSvelteKitProject
    },
    
    // Strategie dla projektów Gatsby
    gatsby: {
      name: 'gatsby',
      build: buildGatsbyProject
    },
    
    // Strategie dla projektów Astro
    astro: {
      name: 'astro',
      build: buildAstroProject
    },
    
    // Strategie dla projektów Remix
    remix: {
      name: 'remix',
      build: buildRemixProject
    },
    
    // Strategie dla projektów Node.js
    node: {
      name: 'node',
      build: buildNodeProject
    },
    
    // Strategie dla projektów PHP
    php: {
      name: 'php',
      build: buildPhpProject
    },
    
    // Strategie dla projektów Python
    python: {
      name: 'python',
      build: buildPythonProject
    },
    
    // Strategie dla projektów statycznych
    static: {
      name: 'static',
      build: buildStaticProject
    },
    
    // Strategia domyślna
    default: {
      name: 'default',
      build: buildDefaultProject
    }
  };
  
  return strategies[projectType] || strategies.default;
}

/**
 * Wykonanie wybranej strategii budowania
 * @param {Object} strategy - Strategia budowania
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function executeBuildStrategy(strategy, options) {
  try {
    // Wykryj wariant, jeśli strategia ma taką funkcję
    let variant = 'generic';
    if (strategy.detectVariant) {
      variant = strategy.detectVariant();
      logger.info(`Wykryty wariant dla ${strategy.name}: ${variant}`);
    }
    
    // Wykonaj budowanie
    await strategy.build(options, variant);
  } catch (err) {
    logger.error(`Błąd podczas wykonywania strategii budowania ${strategy.name}: ${err.message}`);
    throw err;
  }
}

/**
 * Weryfikacja katalogu deploymentu
 * @param {string} deployDir - Katalog deploymentu
 * @returns {Promise<void>}
 */
async function verifyDeploymentDirectory(deployDir) {
  try {
    const deployedFiles = await fs.readdir(deployDir);
    logger.debug(`Zawartość katalogu deploymentu: ${deployedFiles.join(', ')}`);
    
    // Sprawdź, czy katalog zawiera index.html lub inne kluczowe pliki
    const hasIndexHtml = deployedFiles.includes('index.html');
    const hasPackageJson = deployedFiles.includes('package.json');
    
    if (!hasIndexHtml && !hasPackageJson) {
      logger.warn(`Katalog deploymentu nie zawiera index.html ani package.json`);
    }
  } catch (err) {
    logger.warn(`Nie można odczytać zawartości katalogu deploymentu: ${err.message}`);
  }
}

/**
 * Wykonanie komendy w powłoce
 * @param {string} command - Komenda do wykonania
 * @param {Object} options - Opcje wykonania
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function executeCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    logger.debug(`Wykonywanie komendy: ${command}`);
    
    const env = { ...process.env, ...options.env };
    
    exec(command, { env, ...options }, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Błąd podczas wykonywania komendy: ${error.message}`);
        logger.debug(`Stdout: ${stdout}`);
        logger.debug(`Stderr: ${stderr}`);
        return reject(error);
      }
      
      logger.debug(`Komenda wykonana pomyślnie`);
      logger.debug(`Stdout: ${stdout}`);
      
      if (stderr) {
        logger.warn(`Stderr: ${stderr}`);
      }
      
      resolve({ stdout, stderr });
    });
  });
}

/**
 * Budowanie projektu React
 * @param {Object} options - Opcje budowania
 * @param {string} variant - Wariant projektu React
 * @returns {Promise<void>}
 */
async function buildReactProject(options, variant) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  switch (variant) {
    case 'create-react-app':
      // Budowanie projektu Create React App
      await executeCommand(
        `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
        { env: envVars }
      );
      
      // Kopiowanie zbudowanych plików
      await fs.copy(path.join(projectInfo.path, 'build'), deployDir);
      break;
      
    case 'vite':
      // Budowanie projektu React z Vite
      await executeCommand(
        `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
        { env: envVars }
      );
      
      // Kopiowanie zbudowanych plików
      await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
      break;
      
    default:
      // Generyczne budowanie projektu React
      if (options.projectAnalysis.scripts && options.projectAnalysis.scripts.build) {
        // Użycie skryptu build z package.json
        await executeCommand(
          `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
          { env: envVars }
        );
        
        // Sprawdź, czy istnieje katalog build lub dist
        if (await fs.pathExists(path.join(projectInfo.path, 'build'))) {
          await fs.copy(path.join(projectInfo.path, 'build'), deployDir);
        } else if (await fs.pathExists(path.join(projectInfo.path, 'dist'))) {
          await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
        } else {
          // Jeśli nie ma katalogu build ani dist, skopiuj wszystkie pliki
          await fs.copy(projectInfo.path, deployDir);
        }
      } else {
        // Domyślna komenda dla React
        await executeCommand(
          `cd ${projectInfo.path} && ${packageManager} install && npx react-scripts build`,
          { env: envVars }
        );
        
        // Kopiowanie zbudowanych plików
        await fs.copy(path.join(projectInfo.path, 'build'), deployDir);
      }
  }
}

/**
 * Budowanie projektu Next.js
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildNextjsProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu Next.js
  await executeCommand(
    `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
    { env: envVars }
  );
  
  // Kopiowanie plików Next.js
  await fs.copy(path.join(projectInfo.path, '.next'), path.join(deployDir, '.next'));
  
  // Kopiowanie plików publicznych
  if (await fs.pathExists(path.join(projectInfo.path, 'public'))) {
    await fs.copy(path.join(projectInfo.path, 'public'), path.join(deployDir, 'public'));
  }
  
  // Kopiowanie package.json
  await fs.copy(path.join(projectInfo.path, 'package.json'), path.join(deployDir, 'package.json'));
  
  // Instalacja zależności produkcyjnych
  await executeCommand(
    `cd ${deployDir} && ${packageManager} install --production`,
    { env: envVars }
  );
  
  // Tworzenie pliku server.js dla uruchomienia Next.js
  const serverJs = `
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
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
  
  await fs.writeFile(path.join(deployDir, 'server.js'), serverJs);
}

/**
 * Budowanie projektu Vue
 * @param {Object} options - Opcje budowania
 * @param {string} variant - Wariant projektu Vue
 * @returns {Promise<void>}
 */
async function buildVueProject(options, variant) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  switch (variant) {
    case 'vue-cli':
      // Budowanie projektu Vue CLI
      await executeCommand(
        `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
        { env: envVars }
      );
      
      // Kopiowanie zbudowanych plików
      await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
      break;
      
    case 'vite':
      // Budowanie projektu Vue z Vite
      await executeCommand(
        `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
        { env: envVars }
      );
      
      // Kopiowanie zbudowanych plików
      await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
      break;
      
    default:
      // Generyczne budowanie projektu Vue
      if (options.projectAnalysis.scripts && options.projectAnalysis.scripts.build) {
        // Użycie skryptu build z package.json
        await executeCommand(
          `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
          { env: envVars }
        );
        
        // Kopiowanie zbudowanych plików
        await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
      } else {
        // Domyślna komenda dla Vue
        await executeCommand(
          `cd ${projectInfo.path} && ${packageManager} install && npx vue-cli-service build`,
          { env: envVars }
        );
        
        // Kopiowanie zbudowanych plików
        await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
      }
  }
}

/**
 * Budowanie projektu Angular
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildAngularProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu Angular
  if (options.projectAnalysis.scripts && options.projectAnalysis.scripts.build) {
    // Użycie skryptu build z package.json
    await executeCommand(
      `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
      { env: envVars }
    );
  } else {
    // Domyślna komenda dla Angular
    await executeCommand(
      `cd ${projectInfo.path} && ${packageManager} install && npx ng build --prod`,
      { env: envVars }
    );
  }
  
  // Kopiowanie zbudowanych plików
  // Angular może tworzyć katalog dist/[nazwa-projektu]
  const distDir = path.join(projectInfo.path, 'dist');
  const distFiles = await fs.readdir(distDir);
  
  if (distFiles.length === 1 && (await fs.stat(path.join(distDir, distFiles[0]))).isDirectory()) {
    // Jeśli w dist jest tylko jeden katalog, skopiuj jego zawartość
    await fs.copy(path.join(distDir, distFiles[0]), deployDir);
  } else {
    // W przeciwnym razie skopiuj całą zawartość dist
    await fs.copy(distDir, deployDir);
  }
}

/**
 * Budowanie projektu Svelte
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildSvelteProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu Svelte
  if (options.projectAnalysis.scripts && options.projectAnalysis.scripts.build) {
    // Użycie skryptu build z package.json
    await executeCommand(
      `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
      { env: envVars }
    );
  } else {
    // Domyślna komenda dla Svelte
    await executeCommand(
      `cd ${projectInfo.path} && ${packageManager} install && npx rollup -c`,
      { env: envVars }
    );
  }
  
  // Kopiowanie zbudowanych plików
  // Svelte może używać katalogu public lub build
  if (await fs.pathExists(path.join(projectInfo.path, 'public'))) {
    await fs.copy(path.join(projectInfo.path, 'public'), deployDir);
  } else if (await fs.pathExists(path.join(projectInfo.path, 'build'))) {
    await fs.copy(path.join(projectInfo.path, 'build'), deployDir);
  } else {
    logger.warn(`Nie znaleziono katalogu public ani build w projekcie Svelte`);
    await fs.copy(projectInfo.path, deployDir);
  }
}

/**
 * Budowanie projektu SvelteKit
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildSvelteKitProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu SvelteKit
  await executeCommand(
    `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
    { env: envVars }
  );
  
  // Kopiowanie zbudowanych plików
  await fs.copy(path.join(projectInfo.path, 'build'), deployDir);
}

/**
 * Budowanie projektu Gatsby
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildGatsbyProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu Gatsby
  await executeCommand(
    `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
    { env: envVars }
  );
  
  // Kopiowanie zbudowanych plików
  await fs.copy(path.join(projectInfo.path, 'public'), deployDir);
}

/**
 * Budowanie projektu Astro
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildAstroProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu Astro
  await executeCommand(
    `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
    { env: envVars }
  );
  
  // Kopiowanie zbudowanych plików
  await fs.copy(path.join(projectInfo.path, 'dist'), deployDir);
}

/**
 * Budowanie projektu Remix
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildRemixProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Budowanie projektu Remix
  await executeCommand(
    `cd ${projectInfo.path} && ${packageManager} install && ${packageManager} run build`,
    { env: envVars }
  );
  
  // Kopiowanie plików Remix
  await fs.copy(path.join(projectInfo.path, 'build'), path.join(deployDir, 'build'));
  
  // Kopiowanie plików publicznych
  if (await fs.pathExists(path.join(projectInfo.path, 'public'))) {
    await fs.copy(path.join(projectInfo.path, 'public'), path.join(deployDir, 'public'));
  }
  
  // Kopiowanie package.json
  await fs.copy(path.join(projectInfo.path, 'package.json'), path.join(deployDir, 'package.json'));
  
  // Instalacja zależności produkcyjnych
  await executeCommand(
    `cd ${deployDir} && ${packageManager} install --production`,
    { env: envVars }
  );
}

/**
 * Budowanie projektu Node.js
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildNodeProject(options) {
  const { projectInfo, deployDir, packageManager, envVars } = options;
  
  // Dla aplikacji Node.js kopiujemy cały projekt
  await fs.copy(projectInfo.path, deployDir);
  
  // Instalacja zależności produkcyjnych
  await executeCommand(
    `cd ${deployDir} && ${packageManager} install --production`,
    { env: envVars }
  );
}

/**
 * Budowanie projektu PHP
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildPhpProject(options) {
  const { projectInfo, deployDir } = options;
  
  // Dla projektów PHP kopiujemy wszystkie pliki
  await fs.copy(projectInfo.path, deployDir);
  
  // Jeśli istnieje composer.json, zainstaluj zależności
  if (await fs.pathExists(path.join(projectInfo.path, 'composer.json'))) {
    try {
      await executeCommand(`cd ${deployDir} && composer install --no-dev`);
    } catch (err) {
      logger.warn(`Nie można zainstalować zależności Composer: ${err.message}`);
    }
  }
}

/**
 * Budowanie projektu Python
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildPythonProject(options) {
  const { projectInfo, deployDir } = options;
  
  // Dla projektów Python kopiujemy wszystkie pliki
  await fs.copy(projectInfo.path, deployDir);
  
  // Tworzenie wirtualnego środowiska
  try {
    await executeCommand(`cd ${deployDir} && python3 -m venv venv`);
    
    // Instalacja zależności
    if (await fs.pathExists(path.join(deployDir, 'requirements.txt'))) {
      await executeCommand(`cd ${deployDir} && . venv/bin/activate && pip install -r requirements.txt`);
    } else if (await fs.pathExists(path.join(deployDir, 'Pipfile'))) {
      await executeCommand(`cd ${deployDir} && . venv/bin/activate && pip install pipenv && pipenv install --deploy`);
    }
  } catch (err) {
    logger.warn(`Nie można utworzyć wirtualnego środowiska Python: ${err.message}`);
  }
}

/**
 * Budowanie projektu statycznego
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildStaticProject(options) {
  const { projectInfo, deployDir } = options;
  
  // Dla projektów statycznych kopiujemy wszystkie pliki
  await fs.copy(projectInfo.path, deployDir);
  
  // Inteligentna obsługa projektów statycznych
  // Sprawdź, czy istnieje index.html
  if (!await fs.pathExists(path.join(deployDir, 'index.html'))) {
    // Znajdź wszystkie pliki HTML
    const htmlFiles = (await fs.readdir(deployDir))
      .filter(file => file.endsWith('.html'));
    
    if (htmlFiles.length === 1) {
      // Jeśli jest tylko jeden plik HTML, skopiuj go jako index.html
      const htmlFile = htmlFiles[0];
      await fs.copy(
        path.join(deployDir, htmlFile),
        path.join(deployDir, 'index.html')
      );
      logger.info(`Skopiowano ${htmlFile} jako index.html`);
    } else if (htmlFiles.length > 1) {
      // Jeśli jest więcej plików HTML, utwórz prosty index.html z linkami
      let indexHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Index</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #333;
    }
    ul {
      list-style-type: none;
      padding: 0;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>Dostępne strony</h1>
  <ul>
`;
      
      for (const htmlFile of htmlFiles) {
        if (htmlFile !== 'index.html') {
          indexHtml += `    <li><a href="${htmlFile}">${htmlFile}</a></li>\n`;
        }
      }
      
      indexHtml += `
  </ul>
</body>
</html>
`;
      
      await fs.writeFile(path.join(deployDir, 'index.html'), indexHtml);
      logger.info(`Utworzono index.html z linkami do wszystkich plików HTML`);
    }
  }
  
  // Obsługa preprocessorów CSS
  const sassFiles = (await fs.readdir(deployDir))
    .filter(file => file.endsWith('.scss') || file.endsWith('.sass'));
  
  if (sassFiles.length > 0) {
    try {
      // Instalacja node-sass
      await executeCommand(`cd ${deployDir} && npm init -y && npm install node-sass`);
      
      // Kompilacja plików SASS
      for (const sassFile of sassFiles) {
        const cssFile = sassFile.replace(/\.s[ac]ss$/, '.css');
        await executeCommand(`cd ${deployDir} && ./node_modules/.bin/node-sass ${sassFile} ${cssFile}`);
        logger.info(`Skompilowano ${sassFile} do ${cssFile}`);
      }
    } catch (err) {
      logger.warn(`Nie można skompilować plików SASS: ${err.message}`);
    }
  }
}

/**
 * Domyślna strategia budowania
 * @param {Object} options - Opcje budowania
 * @returns {Promise<void>}
 */
async function buildDefaultProject(options) {
  const { projectInfo, deployDir } = options;
  
  // Dla nieznanych typów projektów po prostu kopiujemy pliki
  await fs.copy(projectInfo.path, deployDir);
  logger.warn(`Nieznany typ projektu: ${projectInfo.type}, kopiowanie plików bez budowania`);
}

module.exports = {
  buildProject,
  determinePackageManager,
  determineNodeVersion,
  prepareEnvironmentVariables,
  selectBuildStrategy,
  executeCommand
};
