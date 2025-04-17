#!/bin/bash

# Skrypt do inicjalizacji projektu DeployMaster
# Tworzy kopię pliku .env.przykład do .env i uruchamia konfigurację środowiska

# Sprawdzenie, czy plik .env już istnieje
if [ -f .env ]; then
  echo "Plik .env już istnieje. Czy chcesz go nadpisać? (t/n)"
  read odpowiedz
  if [ "$odpowiedz" != "t" ]; then
    echo "Anulowano inicjalizację."
    exit 0
  fi
fi

# Kopiowanie pliku .env.przykład do .env
echo "Kopiowanie pliku .env.przykład do .env..."
cp .env.przykład .env

# Pytanie o środowisko
echo "Wybierz środowisko do włączenia:"
echo "1) Development"
echo "2) Test"
echo "3) Production"
read -p "Wybór (1-3): " srodowisko

# Ustawienie wybranego środowiska
case $srodowisko in
  1)
    sed -i 's/ENABLE_DEV=0/ENABLE_DEV=1/' .env
    echo "Włączono środowisko Development."
    ;;
  2)
    sed -i 's/ENABLE_TEST=0/ENABLE_TEST=1/' .env
    echo "Włączono środowisko Test."
    ;;
  3)
    sed -i 's/ENABLE_PROD=0/ENABLE_PROD=1/' .env
    echo "Włączono środowisko Production."
    ;;
  *)
    echo "Nieprawidłowy wybór. Pozostawiono domyślne ustawienia."
    ;;
esac

# Pytanie o komponenty do włączenia
echo "Wybierz komponenty do włączenia (wpisz t, aby włączyć):"

read -p "Baza danych (t/n): " db
if [ "$db" = "t" ]; then
  sed -i 's/ENABLE_DB=0/ENABLE_DB=1/' .env
  
  echo "Wybierz typ bazy danych:"
  echo "1) PostgreSQL"
  echo "2) MySQL"
  echo "3) MongoDB"
  read -p "Wybór (1-3): " db_type
  
  case $db_type in
    1)
      sed -i 's/DB_TYPE=postgres/DB_TYPE=postgres/' .env
      ;;
    2)
      sed -i 's/DB_TYPE=postgres/DB_TYPE=mysql/' .env
      ;;
    3)
      sed -i 's/DB_TYPE=postgres/DB_TYPE=mongodb/' .env
      ;;
    *)
      echo "Nieprawidłowy wybór. Pozostawiono PostgreSQL."
      ;;
  esac
  
  echo "Włączono bazę danych."
fi

read -p "Redis (t/n): " redis
if [ "$redis" = "t" ]; then
  sed -i 's/ENABLE_REDIS=0/ENABLE_REDIS=1/' .env
  echo "Włączono Redis."
fi

read -p "RabbitMQ (t/n): " rabbitmq
if [ "$rabbitmq" = "t" ]; then
  sed -i 's/ENABLE_RABBITMQ=0/ENABLE_RABBITMQ=1/' .env
  echo "Włączono RabbitMQ."
fi

read -p "Monitoring (Prometheus + Grafana) (t/n): " monitoring
if [ "$monitoring" = "t" ]; then
  sed -i 's/ENABLE_MONITORING=0/ENABLE_MONITORING=1/' .env
  echo "Włączono monitoring."
fi

read -p "MailHog (t/n): " mailhog
if [ "$mailhog" = "t" ]; then
  sed -i 's/ENABLE_MAILHOG=0/ENABLE_MAILHOG=1/' .env
  echo "Włączono MailHog."
fi

read -p "MinIO (S3) (t/n): " minio
if [ "$minio" = "t" ]; then
  sed -i 's/ENABLE_MINIO=0/ENABLE_MINIO=1/' .env
  echo "Włączono MinIO."
fi

# Uruchomienie skryptu konfiguracji środowiska
echo "Uruchamianie konfiguracji środowiska..."
./configure-environment.sh

echo "Inicjalizacja zakończona. Możesz teraz uruchomić system za pomocą polecenia:"
echo "docker-compose up -d"
