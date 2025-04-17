# Uproszczony Dockerfile dla Orkiestratora
FROM node:16-alpine

# Instalacja podstawowych narzędzi
RUN apk add --no-cache git curl bash unzip zip python3 make g++

# Utworzenie katalogu aplikacji
WORKDIR /app

# Kopiowanie plików package.json i instalacja zależności
COPY package.json ./
RUN npm install

# Kopiowanie kodu źródłowego
COPY src ./src

# Utworzenie katalogów na projekty
RUN mkdir -p /app/projects /app/deployed

# Upewnienie się, że wszystkie katalogi mają odpowiednie uprawnienia
RUN chmod -R 755 /app

# Ekspozycja portu
EXPOSE 4000

# Uruchomienie aplikacji
CMD ["node", "src/index.js"]
