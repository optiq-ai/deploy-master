#!/bin/bash

# Skrypt inicjalizacyjny dla DeployMaster
# Automatycznie uruchamiany przy starcie kontenera

echo "=== DeployMaster - Inicjalizacja ==="

# Ustawienie kolorów dla lepszej czytelności
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Sprawdzanie środowiska...${NC}"

# Usunięcie node_modules jeśli istnieje (czysty start)
if [ -d "/app/node_modules" ]; then
  echo -e "${YELLOW}Usuwanie istniejącego katalogu node_modules dla czystej instalacji...${NC}"
  rm -rf /app/node_modules
fi

# Instalacja zależności
echo -e "${YELLOW}Instalacja zależności Node.js...${NC}"
cd /app && npm install --no-package-lock --no-fund --no-audit --loglevel=error
if [ $? -eq 0 ]; then
  echo -e "${GREEN}Zależności zainstalowane pomyślnie.${NC}"
else
  echo -e "${YELLOW}Próba ponownej instalacji z opcją --force...${NC}"
  cd /app && npm install --no-package-lock --no-fund --no-audit --force --loglevel=error
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Zależności zainstalowane pomyślnie z opcją --force.${NC}"
  else
    echo -e "${YELLOW}Instalacja indywidualnych pakietów...${NC}"
    cd /app && npm install express@4.17.3 express-fileupload@1.3.1 handlebars@4.7.7 fs-extra@10.0.1 dotenv@16.0.0 --no-package-lock --no-fund --no-audit --loglevel=error
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

echo -e "${GREEN}=== Inicjalizacja zakończona. Uruchamianie aplikacji... ===${NC}"

# Uruchomienie aplikacji
exec node /app/src/index.js
