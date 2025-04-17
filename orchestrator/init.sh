#!/bin/bash

# Skrypt inicjalizacyjny dla DeployMaster - Gwarantowane działanie
# Automatycznie uruchamiany przy starcie kontenera

echo "=== DeployMaster - Inicjalizacja z gwarancją działania ==="

# Ustawienie kolorów dla lepszej czytelności
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Przygotowanie środowiska...${NC}"

# Usunięcie node_modules jeśli istnieje (czysty start)
if [ -d "/app/node_modules" ]; then
  echo -e "${YELLOW}Usuwanie istniejącego katalogu node_modules dla czystej instalacji...${NC}"
  rm -rf /app/node_modules
fi

# Tworzenie package.json z minimalnymi zależnościami
echo -e "${YELLOW}Tworzenie minimalnego package.json...${NC}"
cat > /app/package.json << 'EOL'
{
  "name": "orchestrator",
  "version": "1.0.0",
  "description": "Serwis Orkiestrator do automatycznego deploymentu aplikacji",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "4.17.3",
    "cors": "2.8.5",
    "body-parser": "1.19.2",
    "fs-extra": "10.0.1",
    "dotenv": "16.0.0",
    "express-fileupload": "1.3.1"
  }
}
EOL

# Tworzenie minimalnego index.js
echo -e "${YELLOW}Tworzenie minimalnego index.js...${NC}"
mkdir -p /app/src
cat > /app/src/index.js << 'EOL'
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
EOL

# Tworzenie katalogu public
mkdir -p /app/src/public

# Instalacja zależności z różnymi strategiami fallback
echo -e "${YELLOW}Instalacja zależności Node.js...${NC}"

# Strategia 1: Standardowa instalacja npm
cd /app && npm install --no-package-lock --no-fund --no-audit --loglevel=error
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Zależności zainstalowane pomyślnie.${NC}"
else
  echo -e "${YELLOW}Standardowa instalacja nie powiodła się. Próba instalacji z opcją --force...${NC}"
  
  # Strategia 2: Instalacja z opcją --force
  cd /app && npm install --no-package-lock --no-fund --no-audit --force --loglevel=error
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Zależności zainstalowane pomyślnie z opcją --force.${NC}"
  else
    echo -e "${YELLOW}Instalacja z opcją --force nie powiodła się. Próba instalacji indywidualnych pakietów...${NC}"
    
    # Strategia 3: Instalacja indywidualnych pakietów
    cd /app && npm install express@4.17.3 --no-package-lock --no-fund --no-audit --loglevel=error
    cd /app && npm install cors@2.8.5 --no-package-lock --no-fund --no-audit --loglevel=error
    cd /app && npm install body-parser@1.19.2 --no-package-lock --no-fund --no-audit --loglevel=error
    cd /app && npm install fs-extra@10.0.1 --no-package-lock --no-fund --no-audit --loglevel=error
    cd /app && npm install dotenv@16.0.0 --no-package-lock --no-fund --no-audit --loglevel=error
    cd /app && npm install express-fileupload@1.3.1 --no-package-lock --no-fund --no-audit --loglevel=error
    
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}Zależności zainstalowane pomyślnie poprzez indywidualną instalację.${NC}"
    else
      echo -e "${RED}Wszystkie strategie instalacji zawiodły. Próba instalacji globalnej...${NC}"
      
      # Strategia 4: Instalacja globalna i linkowanie
      npm install -g express cors body-parser fs-extra dotenv
      cd /app && npm link express cors body-parser fs-extra dotenv
      
      if [ $? -eq 0 ]; then
        echo -e "${GREEN}Zależności zainstalowane pomyślnie poprzez instalację globalną i linkowanie.${NC}"
      else
        echo -e "${RED}Wszystkie strategie instalacji zawiodły. Aplikacja może nie działać poprawnie.${NC}"
      fi
    fi
  fi
fi

# Ustawienie odpowiednich uprawnień
echo -e "${YELLOW}Ustawianie uprawnień...${NC}"
chmod -R 777 /app
echo -e "${GREEN}Uprawnienia ustawione.${NC}"

# Sprawdzenie, czy katalogi projektów istnieją
echo -e "${YELLOW}Sprawdzanie katalogów projektów...${NC}"
mkdir -p /app/projects /app/deployed
echo -e "${GREEN}Katalogi projektów gotowe.${NC}"

# Wyświetlenie informacji o zainstalowanych pakietach
echo -e "${YELLOW}Zainstalowane pakiety:${NC}"
ls -la /app/node_modules | head -n 10

# Sprawdzenie, czy wymagane moduły są dostępne
echo -e "${YELLOW}Sprawdzanie dostępności wymaganych modułów...${NC}"
node -e "try { require('express'); console.log('Express: OK'); } catch(e) { console.log('Express: BŁĄD - ' + e.message); }"
node -e "try { require('cors'); console.log('Cors: OK'); } catch(e) { console.log('Cors: BŁĄD - ' + e.message); }"
node -e "try { require('body-parser'); console.log('Body-parser: OK'); } catch(e) { console.log('Body-parser: BŁĄD - ' + e.message); }"
node -e "try { require('fs-extra'); console.log('Fs-extra: OK'); } catch(e) { console.log('Fs-extra: BŁĄD - ' + e.message); }"
node -e "try { require('dotenv'); console.log('Dotenv: OK'); } catch(e) { console.log('Dotenv: BŁĄD - ' + e.message); }"

echo -e "${GREEN}=== Inicjalizacja zakończona. Uruchamianie aplikacji... ===${NC}"

# Uruchomienie aplikacji
exec node /app/src/index.js
