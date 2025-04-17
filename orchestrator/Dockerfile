# Multi-stage build dla Orkiestratora
# Stage 1: Builder image z wszystkimi narzędziami
FROM node:16-alpine AS builder

# Instalacja podstawowych narzędzi
RUN apk add --no-cache git curl bash unzip zip python3 make g++

# Utworzenie katalogu aplikacji
WORKDIR /app

# Kopiowanie plików package.json i instalacja zależności
COPY package.json ./
RUN npm install

# Kopiowanie kodu źródłowego
COPY src ./src

# Stage 2: Finalny obraz
FROM node:16-alpine

# Instalacja podstawowych narzędzi
RUN apk add --no-cache git curl bash unzip zip python3

# Utworzenie katalogu aplikacji
WORKDIR /app

# Kopiowanie zainstalowanych zależności i kodu z builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src

# Utworzenie katalogów na projekty
RUN mkdir -p /app/projects /app/deployed

# Ekspozycja portu
EXPOSE 4000

# Uruchomienie aplikacji
CMD ["node", "src/index.js"]
