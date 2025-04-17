#!/bin/bash

# Skrypt do konfiguracji środowisk dla DeployMaster
# Tworzy odpowiednie pliki docker-compose.override.yml w zależności od wybranego środowiska

# Wczytanie zmiennych środowiskowych
source .env

# Sprawdzenie, które środowisko jest włączone
if [ "${ENABLE_DEV}" = "1" ]; then
  ENVIRONMENT="dev"
elif [ "${ENABLE_TEST}" = "1" ]; then
  ENVIRONMENT="test"
elif [ "${ENABLE_PROD}" = "1" ]; then
  ENVIRONMENT="prod"
else
  echo "Żadne środowisko nie jest włączone. Ustawiam domyślne środowisko dev."
  ENVIRONMENT="dev"
fi

echo "Konfigurowanie środowiska: ${ENVIRONMENT}"

# Tworzenie pliku docker-compose.override.yml
cat > docker-compose.override.yml << EOF
version: '3.8'

# Konfiguracja dla środowiska: ${ENVIRONMENT}
services:
EOF

# Dodanie konfiguracji dla Orkiestratora
cat >> docker-compose.override.yml << EOF
  orchestrator:
    environment:
      - NODE_ENV=${ENVIRONMENT}
      - LOG_LEVEL=${LOG_LEVEL:-info}
EOF

# Dodanie bazy danych, jeśli jest włączona
if [ "${ENABLE_DB}" = "1" ]; then
  DB_TYPE=${DB_TYPE:-postgres}
  
  echo "Dodawanie bazy danych: ${DB_TYPE}"
  
  if [ "${DB_TYPE}" = "postgres" ]; then
    cat >> docker-compose.override.yml << EOF
  postgres:
    profiles: []
    environment:
      - POSTGRES_USER=${DB_USER:-dbuser}
      - POSTGRES_PASSWORD=${DB_PASSWORD:-dbpassword}
      - POSTGRES_DB=${DB_NAME:-appdb}
EOF
  elif [ "${DB_TYPE}" = "mysql" ]; then
    cat >> docker-compose.override.yml << EOF
  mysql:
    profiles: []
    environment:
      - MYSQL_ROOT_PASSWORD=${DB_PASSWORD:-dbpassword}
      - MYSQL_DATABASE=${DB_NAME:-appdb}
      - MYSQL_USER=${DB_USER:-dbuser}
      - MYSQL_PASSWORD=${DB_PASSWORD:-dbpassword}
EOF
  elif [ "${DB_TYPE}" = "mongodb" ]; then
    cat >> docker-compose.override.yml << EOF
  mongodb:
    profiles: []
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${DB_USER:-dbuser}
      - MONGO_INITDB_ROOT_PASSWORD=${DB_PASSWORD:-dbpassword}
EOF
  fi
fi

# Dodanie Redis, jeśli jest włączony
if [ "${ENABLE_REDIS}" = "1" ]; then
  echo "Dodawanie Redis"
  cat >> docker-compose.override.yml << EOF
  redis:
    profiles: []
    command: redis-server --requirepass ${REDIS_PASSWORD:-redispassword}
EOF
fi

# Dodanie RabbitMQ, jeśli jest włączony
if [ "${ENABLE_RABBITMQ}" = "1" ]; then
  echo "Dodawanie RabbitMQ"
  cat >> docker-compose.override.yml << EOF
  rabbitmq:
    profiles: []
    environment:
      - RABBITMQ_DEFAULT_USER=${RABBITMQ_USER:-rabbitmq}
      - RABBITMQ_DEFAULT_PASS=${RABBITMQ_PASSWORD:-rabbitmqpassword}
EOF
fi

# Dodanie monitoringu, jeśli jest włączony
if [ "${ENABLE_MONITORING}" = "1" ]; then
  echo "Dodawanie monitoringu"
  cat >> docker-compose.override.yml << EOF
  prometheus:
    profiles: []
  grafana:
    profiles: []
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-admin}
  node-exporter:
    profiles: []
  cadvisor:
    profiles: []
EOF
fi

# Dodanie MailHog, jeśli jest włączony
if [ "${ENABLE_MAILHOG}" = "1" ]; then
  echo "Dodawanie MailHog"
  cat >> docker-compose.override.yml << EOF
  mailhog:
    profiles: []
EOF
fi

# Dodanie MinIO, jeśli jest włączony
if [ "${ENABLE_MINIO}" = "1" ]; then
  echo "Dodawanie MinIO"
  cat >> docker-compose.override.yml << EOF
  minio:
    profiles: []
    environment:
      - MINIO_ROOT_USER=${MINIO_ROOT_USER:-minioadmin}
      - MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-minioadmin}
EOF
fi

echo "Konfiguracja środowiska ${ENVIRONMENT} zakończona. Plik docker-compose.override.yml został utworzony."
