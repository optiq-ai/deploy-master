# Multi-stage build dla Orkiestratora
# Stage 1: Builder image z wszystkimi narzędziami
FROM node:16-alpine AS builder

# Instalacja podstawowych narzędzi
RUN apk add --no-cache git curl bash unzip zip python3 make g++

# Instalacja menedżerów pakietów
RUN npm install -g yarn pnpm

# Instalacja frameworków i narzędzi
RUN npm install -g create-react-app @vitejs/create-app next \
    typescript @babel/cli @babel/core \
    eslint prettier webpack webpack-cli rollup parcel-bundler vite \
    pm2 nodemon \
    jest @testing-library/react cypress \
    @storybook/cli tailwindcss postcss-cli

# Stage 2: Finalny obraz
FROM node:16-alpine

# Instalacja podstawowych narzędzi
RUN apk add --no-cache git curl bash unzip zip python3

# Utworzenie katalogu aplikacji
WORKDIR /app

# Kopiowanie plików package.json i instalacja zależności
COPY ./package.json ./
RUN npm install

# Kopiowanie kodu źródłowego
COPY ./src ./src

# Utworzenie katalogów na projekty
RUN mkdir -p /app/projects /app/deployed

# Ekspozycja portu
EXPOSE 4000

# Uruchomienie aplikacji
CMD ["node", "src/index.js"]
