#!/bin/bash

# Skrypt inicjalizacyjny dla DeployMaster
# Automatycznie uruchamiany przy starcie kontenera

echo "=== DeployMaster - Inicjalizacja ==="

# Ustawienie kolorów dla lepszej czytelności
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Sprawdzanie środowiska...${NC}"

# Sprawdzenie, czy katalog node_modules istnieje
if [ ! -d "/app/node_modules" ]; then
  echo -e "${YELLOW}Instalacja zależności Node.js...${NC}"
  cd /app && npm install
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Zależności zainstalowane pomyślnie.${NC}"
  else
    echo -e "Błąd podczas instalacji zależności. Próba ponownej instalacji z opcją --force..."
    cd /app && npm install --force
  fi
else
  echo -e "${GREEN}Katalog node_modules już istnieje.${NC}"
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
npm list --depth=0

# Wyświetlenie zawartości katalogu node_modules
echo -e "${YELLOW}Zawartość katalogu node_modules:${NC}"
ls -la /app/node_modules | head -n 10

echo -e "${GREEN}=== Inicjalizacja zakończona. Uruchamianie aplikacji... ===${NC}"

# Uruchomienie aplikacji
exec node /app/src/index.js
