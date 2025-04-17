# Radykalnie uproszczony Dockerfile dla Orkiestratora
FROM node:16

# Ustawienie katalogu roboczego
WORKDIR /app

# Kopiowanie package.json i package-lock.json (jeśli istnieje)
COPY package*.json ./

# Instalacja zależności z debugowaniem
RUN echo "Instalacja zależności Node.js..." && \
    npm install && \
    echo "Lista zainstalowanych pakietów:" && \
    npm list --depth=0 && \
    echo "Zawartość katalogu node_modules:" && \
    ls -la node_modules

# Kopiowanie kodu źródłowego
COPY src ./src

# Utworzenie katalogów na projekty
RUN mkdir -p /app/projects /app/deployed

# Upewnienie się, że wszystkie katalogi mają odpowiednie uprawnienia
RUN chmod -R 777 /app

# Wyświetlenie zawartości katalogu dla debugowania
RUN echo "Zawartość katalogu /app:" && \
    ls -la /app && \
    echo "Zawartość katalogu /app/node_modules:" && \
    ls -la /app/node_modules | head -n 10

# Ekspozycja portu
EXPOSE 4000

# Uruchomienie aplikacji
CMD ["node", "src/index.js"]
