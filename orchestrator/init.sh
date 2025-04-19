#!/bin/bash

# Skrypt do instalacji zależności i konfiguracji orchestratora
# Autor: Manus AI
# Data: 2025-04-19

echo "=== DeployMaster - Inicjalizacja z gwarancją działania ==="
echo "Przygotowanie środowiska..."

# Ustawienie zmiennych środowiskowych
export NODE_ENV=production
export DEBUG=express:*,app:*

# Upewnij się, że katalog node_modules jest czysty
echo "Usuwanie istniejącego katalogu node_modules dla czystej instalacji..."
rm -rf node_modules

# Tworzenie minimalnego package.json
echo "Tworzenie minimalnego package.json..."
cat > package.json << EOF
{
  "name": "deploy-master-orchestrator",
  "version": "1.0.0",
  "description": "Orchestrator for DeployMaster",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "cors": "^2.8.5",
    "body-parser": "^1.19.0",
    "fs-extra": "^10.0.0",
    "dotenv": "^10.0.0",
    "express-fileupload": "^1.2.1",
    "helmet": "^4.6.0",
    "find-free-port": "^2.0.0",
    "debug": "^4.3.1",
    "extract-zip": "^2.0.1",
    "glob": "^7.1.7"
  }
}
EOF

# Instalacja zależności
echo "Instalacja zależności Node.js..."
npm install

echo "Zależności zainstalowane pomyślnie."

# Ustawienie uprawnień
echo "Ustawianie uprawnień..."
chmod -R 777 .
echo "Uprawnienia ustawione."

# Sprawdzenie katalogów projektów
echo "Sprawdzanie katalogów projektów..."
mkdir -p projects
mkdir -p deployed
chmod -R 777 projects
chmod -R 777 deployed
echo "Katalogi projektów gotowe."

# Wyświetlenie zainstalowanych pakietów
echo "Zainstalowane pakiety:"
ls -la node_modules

# Sprawdzenie dostępności wymaganych modułów
echo "Sprawdzanie dostępności wymaganych modułów..."
node -e "try { require('express'); console.log('Express: OK'); } catch(e) { console.error('Express: BRAK'); }"
node -e "try { require('cors'); console.log('Cors: OK'); } catch(e) { console.error('Cors: BRAK'); }"
node -e "try { require('body-parser'); console.log('Body-parser: OK'); } catch(e) { console.error('Body-parser: BRAK'); }"
node -e "try { require('fs-extra'); console.log('Fs-extra: OK'); } catch(e) { console.error('Fs-extra: BRAK'); }"
node -e "try { require('dotenv'); console.log('Dotenv: OK'); } catch(e) { console.error('Dotenv: BRAK'); }"
node -e "try { require('express-fileupload'); console.log('Express-fileupload: OK'); } catch(e) { console.error('Express-fileupload: BRAK'); }"
node -e "try { require('helmet'); console.log('Helmet: OK'); } catch(e) { console.error('Helmet: BRAK'); }"
node -e "try { require('find-free-port'); console.log('Find-free-port: OK'); } catch(e) { console.error('Find-free-port: BRAK'); }"
node -e "try { require('extract-zip'); console.log('Extract-zip: OK'); } catch(e) { console.error('Extract-zip: BRAK'); }"
node -e "try { require('glob'); console.log('Glob: OK'); } catch(e) { console.error('Glob: BRAK'); }"

# Sprawdzenie, czy plik index.js istnieje
echo "Sprawdzanie pliku index.js..."
if [ -f "src/index.js" ]; then
  echo "Plik index.js istnieje."
else
  echo "BŁĄD: Plik index.js nie istnieje!"
  exit 1
fi

# Dodanie obsługi wyjątków do pliku index.js
echo "Dodawanie obsługi wyjątków do pliku index.js..."
cat > src/index.js.new << EOF
// Dodanie obsługi wyjątków globalnych
process.on('uncaughtException', (err) => {
  console.error('Nieobsłużony wyjątek:', err);
  console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Nieobsłużona obietnica:', reason);
});

$(cat src/index.js)

// Upewnienie się, że serwer nasłuchuje
if (!module.parent) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Serwer uruchomiony na http://0.0.0.0:\${PORT}\`);
  });
  
  server.on('error', (err) => {
    console.error('Błąd serwera:', err);
    if (err.code === 'EADDRINUSE') {
      console.error(\`Port \${PORT} jest już używany. Spróbuj innego portu.\`);
    }
  });
}
EOF

# Sprawdzenie, czy plik został utworzony
if [ -f "src/index.js.new" ]; then
  mv src/index.js.new src/index.js
  echo "Plik index.js został zaktualizowany."
else
  echo "BŁĄD: Nie udało się zaktualizować pliku index.js!"
  exit 1
fi

echo "=== Inicjalizacja zakończona. Uruchamianie aplikacji... ==="
echo "Uruchamianie aplikacji z pełnym logowaniem błędów..."
node src/index.js
