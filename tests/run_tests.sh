#!/bin/bash

# Skrypt testowy dla DeployMaster
# Testuje podstawowe funkcjonalności systemu

# Kolory do formatowania wyjścia
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Liczniki testów
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Funkcja do wyświetlania nagłówka testu
function test_header() {
  echo -e "\n${YELLOW}=== Test: $1 ===${NC}"
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

# Funkcja do wyświetlania wyniku testu
function test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ Test passed${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ Test failed: $2${NC}"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# Funkcja do sprawdzania, czy kontener jest uruchomiony
function check_container_running() {
  docker ps | grep $1 > /dev/null
  return $?
}

# Funkcja do sprawdzania, czy port jest otwarty
function check_port_open() {
  nc -z localhost $1
  return $?
}

# Funkcja do sprawdzania, czy endpoint HTTP zwraca poprawny status
function check_http_status() {
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $1)
  if [ "$STATUS" = "$2" ]; then
    return 0
  else
    echo "Oczekiwano statusu $2, otrzymano $STATUS"
    return 1
  fi
}

echo -e "${YELLOW}=== DeployMaster - Testy automatyczne ===${NC}"
echo "Uruchamianie testów..."

# Test 1: Sprawdzenie, czy plik .env istnieje
test_header "Sprawdzenie pliku .env"
if [ -f .env ]; then
  test_result 0
else
  test_result 1 "Plik .env nie istnieje"
fi

# Test 2: Sprawdzenie, czy plik docker-compose.yml istnieje
test_header "Sprawdzenie pliku docker-compose.yml"
if [ -f docker-compose.yml ]; then
  test_result 0
else
  test_result 1 "Plik docker-compose.yml nie istnieje"
fi

# Test 3: Sprawdzenie, czy skrypt configure-environment.sh jest wykonywalny
test_header "Sprawdzenie uprawnień skryptu configure-environment.sh"
if [ -x configure-environment.sh ]; then
  test_result 0
else
  test_result 1 "Skrypt configure-environment.sh nie jest wykonywalny"
fi

# Test 4: Sprawdzenie, czy skrypt init.sh jest wykonywalny
test_header "Sprawdzenie uprawnień skryptu init.sh"
if [ -x init.sh ]; then
  test_result 0
else
  test_result 1 "Skrypt init.sh nie jest wykonywalny"
fi

# Test 5: Sprawdzenie, czy Dockerfile dla Orkiestratora istnieje
test_header "Sprawdzenie Dockerfile dla Orkiestratora"
if [ -f orchestrator/Dockerfile ]; then
  test_result 0
else
  test_result 1 "Plik orchestrator/Dockerfile nie istnieje"
fi

# Test 6: Sprawdzenie, czy package.json dla Orkiestratora istnieje
test_header "Sprawdzenie package.json dla Orkiestratora"
if [ -f orchestrator/package.json ]; then
  test_result 0
else
  test_result 1 "Plik orchestrator/package.json nie istnieje"
fi

# Test 7: Sprawdzenie, czy plik index.js dla Orkiestratora istnieje
test_header "Sprawdzenie index.js dla Orkiestratora"
if [ -f orchestrator/src/index.js ]; then
  test_result 0
else
  test_result 1 "Plik orchestrator/src/index.js nie istnieje"
fi

# Test 8: Sprawdzenie, czy konfiguracja Traefik istnieje
test_header "Sprawdzenie konfiguracji Traefik"
if [ -f traefik/traefik.yml ]; then
  test_result 0
else
  test_result 1 "Plik traefik/traefik.yml nie istnieje"
fi

# Test 9: Sprawdzenie, czy konfiguracja Prometheus istnieje
test_header "Sprawdzenie konfiguracji Prometheus"
if [ -f monitoring/prometheus.yml ]; then
  test_result 0
else
  test_result 1 "Plik monitoring/prometheus.yml nie istnieje"
fi

# Test 10: Sprawdzenie, czy dokumentacja istnieje
test_header "Sprawdzenie dokumentacji"
if [ -f DOCUMENTATION.md ]; then
  test_result 0
else
  test_result 1 "Plik DOCUMENTATION.md nie istnieje"
fi

# Jeśli system jest uruchomiony, wykonaj dodatkowe testy
if docker ps > /dev/null 2>&1; then
  # Test 11: Sprawdzenie, czy kontener Orkiestratora jest uruchomiony
  test_header "Sprawdzenie, czy kontener Orkiestratora jest uruchomiony"
  if check_container_running "orchestrator"; then
    test_result 0
  else
    test_result 1 "Kontener Orkiestratora nie jest uruchomiony"
  fi

  # Test 12: Sprawdzenie, czy kontener Traefik jest uruchomiony
  test_header "Sprawdzenie, czy kontener Traefik jest uruchomiony"
  if check_container_running "traefik"; then
    test_result 0
  else
    test_result 1 "Kontener Traefik nie jest uruchomiony"
  fi

  # Test 13: Sprawdzenie, czy port Orkiestratora jest otwarty
  test_header "Sprawdzenie, czy port Orkiestratora jest otwarty"
  if check_port_open 4000; then
    test_result 0
  else
    test_result 1 "Port 4000 (Orkiestrator) nie jest otwarty"
  fi

  # Test 14: Sprawdzenie, czy port Traefik jest otwarty
  test_header "Sprawdzenie, czy port Traefik jest otwarty"
  if check_port_open 8080; then
    test_result 0
  else
    test_result 1 "Port 8080 (Traefik) nie jest otwarty"
  fi

  # Test 15: Sprawdzenie, czy Orkiestrator zwraca poprawny status HTTP
  test_header "Sprawdzenie, czy Orkiestrator zwraca poprawny status HTTP"
  if check_http_status "http://localhost:4000" "200"; then
    test_result 0
  else
    test_result 1 "Orkiestrator nie zwraca statusu 200"
  fi
else
  echo -e "${YELLOW}System nie jest uruchomiony, pomijanie testów kontenerów i portów${NC}"
fi

# Wyświetlenie podsumowania
echo -e "\n${YELLOW}=== Podsumowanie testów ===${NC}"
echo -e "Wykonano testów: ${TESTS_TOTAL}"
echo -e "${GREEN}Testy zakończone sukcesem: ${TESTS_PASSED}${NC}"
echo -e "${RED}Testy zakończone niepowodzeniem: ${TESTS_FAILED}${NC}"

# Zwrócenie kodu wyjścia
if [ ${TESTS_FAILED} -eq 0 ]; then
  echo -e "${GREEN}Wszystkie testy zakończone sukcesem!${NC}"
  exit 0
else
  echo -e "${RED}Niektóre testy zakończyły się niepowodzeniem.${NC}"
  exit 1
fi
