/**
 * Moduł do zaawansowanego wykrywania typów projektów
 * Implementuje wielopoziomową analizę struktury projektu i rozszerzone wykrywanie frameworków
 */

const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');
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

// Maksymalna głębokość rekurencyjnego skanowania katalogów
const MAX_SCAN_DEPTH = 3;

// Wagi dla różnych wskaźników frameworków
const FRAMEWORK_WEIGHTS = {
  // Pliki konfiguracyjne
  'package.json': 5,
  'angular.json': 10,
  'vue.config.js': 10,
  'nuxt.config.js': 10,
  'next.config.js': 10,
  'gatsby-config.js': 10,
  'svelte.config.js': 10,
  'astro.config.mjs': 10,
  'remix.config.js': 10,
  'vite.config.js': 8,
  'webpack.config.js': 6,
  'tsconfig.json': 4,
  'jsconfig.json': 3,
  'babel.config.js': 3,
  '.babelrc': 2,
  
  // Katalogi
  'node_modules': 3,
  'src': 2,
  'public': 2,
  'dist': 1,
  'build': 1,
  '.next': 10,
  '.nuxt': 10,
  '.svelte-kit': 10,
  '.astro': 10,
  
  // Pliki HTML
  'index.html': 5,
  
  // Pliki PHP
  '.php': 8,
  
  // Pliki Python
  '.py': 8,
  'requirements.txt': 9,
  'Pipfile': 9,
  
  // Pliki Ruby
  '.rb': 8,
  'Gemfile': 9,
  
  // Pliki Java
  '.java': 8,
  'pom.xml': 9,
  'build.gradle': 9,
  
  // Pliki Go
  '.go': 8,
  'go.mod': 9,
  
  // Pliki Rust
  '.rs': 8,
  'Cargo.toml': 9
};

// Mapowanie zależności na frameworki
const DEPENDENCY_FRAMEWORK_MAP = {
  // Frontend
  'react': 'react',
  'react-dom': 'react',
  'next': 'nextjs',
  'vue': 'vue',
  '@vue/cli-service': 'vue',
  'nuxt': 'nuxt',
  '@nuxtjs/composition-api': 'nuxt',
  'angular': 'angular',
  '@angular/core': 'angular',
  '@angular/cli': 'angular',
  'svelte': 'svelte',
  '@sveltejs/kit': 'sveltekit',
  'gatsby': 'gatsby',
  'astro': 'astro',
  '@remix-run/react': 'remix',
  'vite': 'vite',
  
  // Backend
  'express': 'express',
  'koa': 'koa',
  'fastify': 'fastify',
  'nest': 'nestjs',
  '@nestjs/core': 'nestjs',
  'django': 'django',
  'flask': 'flask',
  'rails': 'rails',
  'spring-boot': 'spring',
  'laravel': 'laravel',
  
  // Narzędzia budowania
  'webpack': 'webpack',
  'parcel': 'parcel',
  'rollup': 'rollup',
  'esbuild': 'esbuild',
  'snowpack': 'snowpack',
  'react-scripts': 'create-react-app',
  '@vue/cli-service': 'vue-cli',
  '@angular/cli': 'angular-cli'
};

// Mapowanie typów projektów na podstawie wykrytych frameworków
const FRAMEWORK_PROJECT_TYPE_MAP = {
  'nextjs': 'nextjs',
  'nuxt': 'nuxt',
  'gatsby': 'gatsby',
  'react': 'react',
  'create-react-app': 'react',
  'vue': 'vue',
  'vue-cli': 'vue',
  'angular': 'angular',
  'angular-cli': 'angular',
  'svelte': 'svelte',
  'sveltekit': 'sveltekit',
  'astro': 'astro',
  'remix': 'remix',
  'express': 'node',
  'koa': 'node',
  'fastify': 'node',
  'nestjs': 'node',
  'django': 'python',
  'flask': 'python',
  'rails': 'ruby',
  'spring': 'java',
  'laravel': 'php'
};

/**
 * Główna funkcja do wykrywania typu projektu
 * @param {string} projectDir - Ścieżka do katalogu projektu
 * @returns {Promise<string>} - Wykryty typ projektu
 */
async function detectProjectType(projectDir) {
  try {
    logger.info(`Rozpoczęcie zaawansowanej analizy projektu w katalogu: ${projectDir}`);
    
    // Struktura do przechowywania wyników analizy
    const analysis = {
      files: {},
      directories: {},
      fileExtensions: {},
      packageJson: null,
      htmlFiles: [],
      detectedFrameworks: {},
      frameworkScores: {},
      packageManager: 'npm',
      nodeVersion: null
    };
    
    // Wielopoziomowa analiza struktury projektu
    await scanDirectory(projectDir, analysis, 0);
    
    // Analiza package.json
    await analyzePackageJson(projectDir, analysis);
    
    // Analiza plików HTML
    await analyzeHtmlFiles(projectDir, analysis);
    
    // Analiza plików konfiguracyjnych
    await analyzeConfigFiles(projectDir, analysis);
    
    // Obliczenie wag dla wykrytych frameworków
    calculateFrameworkScores(analysis);
    
    // Określenie typu projektu na podstawie analizy
    const projectType = determineProjectType(analysis);
    
    // Zapisanie analizy do pliku w katalogu projektu dla celów diagnostycznych
    await fs.writeJson(path.join(projectDir, 'project-analysis.json'), {
      ...analysis,
      detectedType: projectType
    }, { spaces: 2 });
    
    logger.info(`Wykryty typ projektu: ${projectType}`);
    return projectType;
  } catch (err) {
    logger.error(`Błąd podczas wykrywania typu projektu: ${err.message}`);
    return 'unknown';
  }
}

/**
 * Rekurencyjne skanowanie katalogu
 * @param {string} dir - Ścieżka do katalogu
 * @param {Object} analysis - Obiekt analizy
 * @param {number} depth - Aktualna głębokość rekurencji
 */
async function scanDirectory(dir, analysis, depth) {
  if (depth > MAX_SCAN_DEPTH) return;
  
  try {
    const files = await fs.readdir(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const relativePath = path.relative(dir, filePath);
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        // Ignorowanie node_modules i innych katalogów pomocniczych
        if (file === 'node_modules' || file === '.git' || file === '.idea' || file === '.vscode') {
          analysis.directories[file] = (analysis.directories[file] || 0) + 1;
          continue;
        }
        
        analysis.directories[file] = (analysis.directories[file] || 0) + 1;
        
        // Rekurencyjne skanowanie podkatalogu
        await scanDirectory(filePath, analysis, depth + 1);
      } else {
        // Analiza pliku
        analysis.files[file] = (analysis.files[file] || 0) + 1;
        
        // Analiza rozszerzenia pliku
        const ext = path.extname(file).toLowerCase();
        if (ext) {
          analysis.fileExtensions[ext] = (analysis.fileExtensions[ext] || 0) + 1;
        }
        
        // Zbieranie plików HTML
        if (ext === '.html') {
          analysis.htmlFiles.push(filePath);
        }
      }
    }
  } catch (err) {
    logger.warn(`Błąd podczas skanowania katalogu ${dir}: ${err.message}`);
  }
}

/**
 * Analiza pliku package.json
 * @param {string} projectDir - Ścieżka do katalogu projektu
 * @param {Object} analysis - Obiekt analizy
 */
async function analyzePackageJson(projectDir, analysis) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  
  if (await fs.pathExists(packageJsonPath)) {
    try {
      const packageJson = await fs.readJson(packageJsonPath);
      analysis.packageJson = packageJson;
      
      // Wykrywanie zależności
      if (packageJson.dependencies) {
        for (const [dep, version] of Object.entries(packageJson.dependencies)) {
          const framework = DEPENDENCY_FRAMEWORK_MAP[dep];
          if (framework) {
            analysis.detectedFrameworks[framework] = (analysis.detectedFrameworks[framework] || 0) + 5;
          }
        }
      }
      
      // Wykrywanie devDependencies
      if (packageJson.devDependencies) {
        for (const [dep, version] of Object.entries(packageJson.devDependencies)) {
          const framework = DEPENDENCY_FRAMEWORK_MAP[dep];
          if (framework) {
            analysis.detectedFrameworks[framework] = (analysis.detectedFrameworks[framework] || 0) + 3;
          }
        }
      }
      
      // Wykrywanie skryptów
      if (packageJson.scripts) {
        analysis.scripts = packageJson.scripts;
        
        // Wykrywanie frameworków na podstawie skryptów
        if (packageJson.scripts.start && packageJson.scripts.start.includes('react-scripts')) {
          analysis.detectedFrameworks['create-react-app'] = (analysis.detectedFrameworks['create-react-app'] || 0) + 8;
        }
        
        if (packageJson.scripts.dev && packageJson.scripts.dev.includes('next')) {
          analysis.detectedFrameworks['nextjs'] = (analysis.detectedFrameworks['nextjs'] || 0) + 8;
        }
        
        if (packageJson.scripts.dev && packageJson.scripts.dev.includes('nuxt')) {
          analysis.detectedFrameworks['nuxt'] = (analysis.detectedFrameworks['nuxt'] || 0) + 8;
        }
        
        if (packageJson.scripts.dev && packageJson.scripts.dev.includes('vite')) {
          analysis.detectedFrameworks['vite'] = (analysis.detectedFrameworks['vite'] || 0) + 8;
        }
      }
      
      // Wykrywanie menedżera pakietów
      if (await fs.pathExists(path.join(projectDir, 'yarn.lock'))) {
        analysis.packageManager = 'yarn';
      } else if (await fs.pathExists(path.join(projectDir, 'pnpm-lock.yaml'))) {
        analysis.packageManager = 'pnpm';
      } else {
        analysis.packageManager = 'npm';
      }
      
      // Wykrywanie wersji Node.js
      if (packageJson.engines && packageJson.engines.node) {
        analysis.nodeVersion = packageJson.engines.node;
      }
    } catch (err) {
      logger.warn(`Błąd podczas analizy package.json: ${err.message}`);
    }
  }
}

/**
 * Analiza plików HTML
 * @param {string} projectDir - Ścieżka do katalogu projektu
 * @param {Object} analysis - Obiekt analizy
 */
async function analyzeHtmlFiles(projectDir, analysis) {
  if (analysis.htmlFiles.length > 0) {
    analysis.hasHtmlFiles = true;
    analysis.htmlFilesCount = analysis.htmlFiles.length;
    
    // Sprawdzenie, czy istnieje index.html
    const hasIndexHtml = analysis.htmlFiles.some(file => path.basename(file) === 'index.html');
    analysis.hasIndexHtml = hasIndexHtml;
    
    if (analysis.htmlFilesCount > 0 && !analysis.hasIndexHtml) {
      // Jeśli nie ma index.html, ale są inne pliki HTML, to prawdopodobnie jest to projekt statyczny
      analysis.detectedFrameworks['static-html'] = (analysis.detectedFrameworks['static-html'] || 0) + 8;
    }
  }
}

/**
 * Analiza plików konfiguracyjnych
 * @param {string} projectDir - Ścieżka do katalogu projektu
 * @param {Object} analysis - Obiekt analizy
 */
async function analyzeConfigFiles(projectDir, analysis) {
  // Sprawdzenie plików konfiguracyjnych dla różnych frameworków
  const configFiles = [
    { file: 'angular.json', framework: 'angular' },
    { file: 'vue.config.js', framework: 'vue' },
    { file: 'nuxt.config.js', framework: 'nuxt' },
    { file: 'next.config.js', framework: 'nextjs' },
    { file: 'gatsby-config.js', framework: 'gatsby' },
    { file: 'svelte.config.js', framework: 'svelte' },
    { file: 'astro.config.mjs', framework: 'astro' },
    { file: 'remix.config.js', framework: 'remix' },
    { file: 'vite.config.js', framework: 'vite' },
    { file: 'webpack.config.js', framework: 'webpack' },
    { file: 'tsconfig.json', framework: 'typescript' },
    { file: 'jsconfig.json', framework: 'javascript' },
    { file: 'babel.config.js', framework: 'babel' },
    { file: '.babelrc', framework: 'babel' },
    { file: 'requirements.txt', framework: 'python' },
    { file: 'Pipfile', framework: 'python' },
    { file: 'Gemfile', framework: 'ruby' },
    { file: 'pom.xml', framework: 'java' },
    { file: 'build.gradle', framework: 'java' },
    { file: 'go.mod', framework: 'go' },
    { file: 'Cargo.toml', framework: 'rust' }
  ];
  
  for (const { file, framework } of configFiles) {
    if (await fs.pathExists(path.join(projectDir, file))) {
      analysis.detectedFrameworks[framework] = (analysis.detectedFrameworks[framework] || 0) + 10;
    }
  }
  
  // Sprawdzenie katalogów specyficznych dla frameworków
  const frameworkDirs = [
    { dir: '.next', framework: 'nextjs' },
    { dir: '.nuxt', framework: 'nuxt' },
    { dir: '.svelte-kit', framework: 'sveltekit' },
    { dir: '.astro', framework: 'astro' }
  ];
  
  for (const { dir, framework } of frameworkDirs) {
    if (await fs.pathExists(path.join(projectDir, dir))) {
      analysis.detectedFrameworks[framework] = (analysis.detectedFrameworks[framework] || 0) + 10;
    }
  }
  
  // Sprawdzenie rozszerzeń plików dla różnych języków
  const filePatterns = [
    { pattern: '**/*.php', framework: 'php' },
    { pattern: '**/*.py', framework: 'python' },
    { pattern: '**/*.rb', framework: 'ruby' },
    { pattern: '**/*.java', framework: 'java' },
    { pattern: '**/*.go', framework: 'go' },
    { pattern: '**/*.rs', framework: 'rust' }
  ];
  
  for (const { pattern, framework } of filePatterns) {
    try {
      const files = glob.sync(pattern, { cwd: projectDir, nodir: true, ignore: ['node_modules/**', '.git/**'] });
      if (files.length > 0) {
        analysis.detectedFrameworks[framework] = (analysis.detectedFrameworks[framework] || 0) + Math.min(files.length, 10);
      }
    } catch (err) {
      logger.warn(`Błąd podczas wyszukiwania plików ${pattern}: ${err.message}`);
    }
  }
}

/**
 * Obliczenie wag dla wykrytych frameworków
 * @param {Object} analysis - Obiekt analizy
 */
function calculateFrameworkScores(analysis) {
  // Inicjalizacja wag
  analysis.frameworkScores = {};
  
  // Dodanie wag na podstawie plików
  for (const [file, count] of Object.entries(analysis.files)) {
    const weight = FRAMEWORK_WEIGHTS[file];
    if (weight) {
      for (const [framework, score] of Object.entries(analysis.detectedFrameworks)) {
        if (file.includes(framework.toLowerCase())) {
          analysis.frameworkScores[framework] = (analysis.frameworkScores[framework] || 0) + weight * count;
        }
      }
    }
  }
  
  // Dodanie wag na podstawie katalogów
  for (const [dir, count] of Object.entries(analysis.directories)) {
    const weight = FRAMEWORK_WEIGHTS[dir];
    if (weight) {
      for (const [framework, score] of Object.entries(analysis.detectedFrameworks)) {
        if (dir.includes(framework.toLowerCase())) {
          analysis.frameworkScores[framework] = (analysis.frameworkScores[framework] || 0) + weight * count;
        }
      }
    }
  }
  
  // Dodanie wag na podstawie wykrytych frameworków
  for (const [framework, score] of Object.entries(analysis.detectedFrameworks)) {
    analysis.frameworkScores[framework] = (analysis.frameworkScores[framework] || 0) + score;
  }
}

/**
 * Określenie typu projektu na podstawie analizy
 * @param {Object} analysis - Obiekt analizy
 * @returns {string} - Wykryty typ projektu
 */
function determineProjectType(analysis) {
  // Sortowanie frameworków według wag
  const sortedFrameworks = Object.entries(analysis.frameworkScores || {})
    .sort((a, b) => b[1] - a[1]);
  
  logger.debug(`Posortowane frameworki według wag: ${JSON.stringify(sortedFrameworks)}`);
  
  // Jeśli nie wykryto żadnych frameworków
  if (sortedFrameworks.length === 0) {
    // Sprawdzenie, czy to projekt statyczny HTML
    if (analysis.htmlFilesCount > 0) {
      return 'static';
    }
    
    // Sprawdzenie rozszerzeń plików
    if (analysis.fileExtensions['.php'] > 0) {
      return 'php';
    }
    
    if (analysis.fileExtensions['.py'] > 0) {
      return 'python';
    }
    
    return 'unknown';
  }
  
  // Wybór frameworka z najwyższą wagą
  const [topFramework, topScore] = sortedFrameworks[0];
  
  // Mapowanie frameworka na typ projektu
  const projectType = FRAMEWORK_PROJECT_TYPE_MAP[topFramework] || 'unknown';
  
  return projectType;
}

module.exports = {
  detectProjectType,
  analyzePackageJson,
  analyzeHtmlFiles,
  analyzeConfigFiles,
  calculateFrameworkScores,
  determineProjectType
};
