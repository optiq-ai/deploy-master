const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Konfiguracja środowiska
dotenv.config();

// Inicjalizacja Express
const app = express();
const PORT = process.env.ORCHESTRATOR_PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Statyczne pliki dla UI
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint główny - UI do uploadu
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>DeployMaster - Orkiestrator</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f7fa;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
          background-color: white;
          padding: 20px;
          border-radius: 5px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
          color: #3f51b5;
          text-align: center;
        }
        .status {
          padding: 15px;
          background-color: #e8f5e9;
          border-radius: 5px;
          margin-bottom: 20px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>DeployMaster - Orkiestrator</h1>
        <div class="status">
          <h2>System działa poprawnie!</h2>
          <p>Wszystkie komponenty zostały pomyślnie uruchomione.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// API endpoint testowy
app.get('/api/status', (req, res) => {
  res.json({
    status: "ok",
    message: "System działa poprawnie",
    timestamp: new Date().toISOString()
  });
});

// Uruchomienie serwera
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orkiestrator uruchomiony na porcie ${PORT}`);
});

// Obsługa zamknięcia
process.on('SIGTERM', () => {
  console.log('Zamykanie serwera Orkiestratora...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Zamykanie serwera Orkiestratora...');
  process.exit(0);
});
