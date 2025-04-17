# DeployMaster - Automatyczny System Deployowania Aplikacji

## Wprowadzenie

DeployMaster to kompleksowe, modularne rozwiązanie DevOps zaprojektowane do automatycznego deploymentu stron www i projektów React. System został zbudowany z myślą o prostocie użytkowania przy jednoczesnym zachowaniu zaawansowanych możliwości konfiguracyjnych.

## Architektura systemu

System składa się z trzech głównych komponentów:

1. **Orkiestrator** - serwis odpowiedzialny za upload projektów, wykrywanie ich typu, budowanie i wdrażanie
2. **Ruchownik** (Traefik) - reverse-proxy obsługujący routing i certyfikaty SSL
3. **Nadzorca** - komponenty monitorujące i zbierające logi

### Struktura repozytorium

```
deploy-stack/
├── README_FIRST.md                # Baza wiedzy projektu - pełna dokumentacja
├── docker-compose.yml             # Główny plik Compose z modułami x-enabled
├── .env.przykład                  # Domyślne wartości (wszystkie ENABLE_* = 0)
├── orchestrator/                  # Serwis "Orkiestrator" do uploadu i deployu
│   ├── Dockerfile                 # Multi-stage builder + finalny obraz
│   ├── src/
│   │   ├── index.js               # Express + React UI do uploadu
│   │   ├── deploy.js              # Logika parsowania i uruchamiania
│   │   └── szablony/              # Szablony Handlebars/Mustache
│   └── package.json               # Zależności
├── traefik/                       # "Ruchownik" - reverse-proxy + SSL
│   └── traefik.yml                # Konfiguracja z Cloudflare DNS-challenge
└── monitoring/                    # "Nadzorca" - monitoring i logi
    └── prometheus.yml
```

## Technologie i komponenty

### Podstawowe

- Docker Compose v3.8 + Portainer CE
- Node.js 16-alpine (multi-stage build)
- Git, curl, bash, unzip, zip, python3

### Preinstalowane narzędzia (builder image)

- Menedżery pakietów: yarn, npm, pnpm
- Frameworki: create-react-app, Vite, Next.js
- Języki: TypeScript, Babel CLI/Core
- Narzędzia: ESLint, Prettier, Webpack, Rollup, Parcel, Vite
- Runtime: PM2, nodemon
- Testowanie: Jest, React Testing Library, Cypress
- UI: Storybook, Tailwind CSS, PostCSS CLI

### Biblioteki React

- react-router-dom, @reduxjs/toolkit, react-query
- styled-components, emotion, Chakra UI, Material-UI
- axios, SWR

### Opcjonalne komponenty (włączane flagami 0/1)

- Bazy danych: PostgreSQL, MySQL, MongoDB
- Cache: Redis
- Kolejki: RabbitMQ
- Monitoring: Prometheus, Grafana, Loki, ELK stack
- Narzędzia mail: MailHog
- Storage: MinIO (S3-compatible)

## Funkcjonalność systemu

### Konfiguracja przez .env

Użytkownik może włączać/wyłączać komponenty poprzez zmienne:

```
# Środowiska
ENABLE_DEV=0
ENABLE_TEST=0
ENABLE_PROD=0

# Komponenty
ENABLE_DB=0
ENABLE_REDIS=0
ENABLE_MONITORING=0
ENABLE_MAILHOG=0
ENABLE_MINIO=0
```

### Przepływ pracy

1. Push repozytorium do Gita
2. W Portainerze: New Stack → URL Git → Deploy
3. Autoinstalacja podstawowego stacka
4. Dostęp do UI przez http://host:4000
5. Upload ZIP z projektem
6. Wybór usług do włączenia
7. Automatyczny deploy, budowanie i uruchomienie aplikacji na wolnym porcie
8. Aplikacja dostępna pod http://host:[wolny_port]

### Obsługa SSL i domen

- Integracja z Cloudflare DNS (DNS-challenge)
- Automatyczne zarządzanie certyfikatami SSL
- Traefik jako reverse-proxy

### Logowanie

- Szczegółowe logi na poziomie DEBUG
- Mechanizm rotacji logów
- Centralne zbieranie logów (Loki/ELK)

## Instrukcja instalacji

### Wymagania wstępne

- Docker i Docker Compose zainstalowane na serwerze
- Portainer CE (opcjonalnie, ale zalecane)
- Dostęp do Cloudflare DNS (dla automatycznego SSL)

### Instalacja przez Portainer

1. Zaloguj się do Portainer
2. Przejdź do Stacks → Add stack
3. Wybierz metodę "Git repository"
4. Wprowadź URL repozytorium
5. Kliknij "Deploy the stack"
6. Poczekaj na zakończenie instalacji

### Instalacja manualna

1. Sklonuj repozytorium:
   ```
   git clone https://github.com/twoje-repo/deploy-stack.git
   cd deploy-stack
   ```

2. Skopiuj plik .env.przykład do .env i dostosuj ustawienia:
   ```
   cp .env.przykład .env
   nano .env
   ```

3. Uruchom stack:
   ```
   docker-compose up -d
   ```

## Użytkowanie

1. Otwórz przeglądarkę i przejdź do http://host:4000
2. Zaloguj się do interfejsu Orkiestratora
3. Prześlij plik ZIP z projektem (HTML lub React)
4. Wybierz komponenty, które chcesz włączyć
5. Kliknij "Deploy"
6. Po zakończeniu procesu otrzymasz link do swojej aplikacji

## Rozwiązywanie problemów

### Typowe problemy

1. **Problem z dostępem do UI Orkiestratora**
   - Sprawdź, czy kontener jest uruchomiony: `docker ps | grep orchestrator`
   - Sprawdź logi: `docker logs deploy-stack_orchestrator_1`

2. **Błędy podczas budowania projektu**
   - Sprawdź logi budowania: `docker logs deploy-stack_orchestrator_1`
   - Upewnij się, że projekt ma poprawną strukturę

3. **Problemy z certyfikatami SSL**
   - Sprawdź konfigurację Cloudflare
   - Sprawdź logi Traefik: `docker logs deploy-stack_traefik_1`

## Rozwój projektu

### Dodawanie nowych komponentów

1. Dodaj nową sekcję w docker-compose.yml
2. Dodaj odpowiednią zmienną ENABLE_* w pliku .env.przykład
3. Zaktualizuj logikę w deploy.js
4. Zaktualizuj dokumentację

### Aktualizacja istniejących komponentów

1. Zmień wersję obrazu w docker-compose.yml
2. Przetestuj kompatybilność
3. Zaktualizuj dokumentację

## Licencja

Ten projekt jest udostępniany na licencji MIT.

## Kontakt

W przypadku pytań lub problemów, skontaktuj się z zespołem DeployMaster.
