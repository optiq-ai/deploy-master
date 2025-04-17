# DeployMaster - Dokumentacja

## Spis treści

1. [Wprowadzenie](#wprowadzenie)
2. [Architektura systemu](#architektura-systemu)
3. [Wymagania systemowe](#wymagania-systemowe)
4. [Instalacja](#instalacja)
5. [Konfiguracja](#konfiguracja)
6. [Użytkowanie](#użytkowanie)
7. [Komponenty opcjonalne](#komponenty-opcjonalne)
8. [Rozwiązywanie problemów](#rozwiązywanie-problemów)
9. [FAQ](#faq)
10. [Rozwój projektu](#rozwój-projektu)

## Wprowadzenie

DeployMaster to kompleksowe, modularne rozwiązanie DevOps zaprojektowane do automatycznego deploymentu stron www i projektów React. System został zbudowany z myślą o prostocie użytkowania przy jednoczesnym zachowaniu zaawansowanych możliwości konfiguracyjnych.

Główne cechy systemu:
- Automatyczna instalacja pełnego stacka technologicznego poprzez Docker Compose
- Prosty interfejs webowy do wgrywania projektów (HTML lub React)
- Automatyczne wykrywanie typu projektu, budowanie i wdrażanie na odpowiednim porcie
- Elastyczne włączanie/wyłączanie komponentów (bazy danych, monitoring, itd.)
- Wsparcie dla różnych środowisk (dev/test/prod)

## Architektura systemu

System DeployMaster składa się z trzech głównych komponentów:

1. **Orkiestrator** - serwis odpowiedzialny za upload projektów, wykrywanie ich typu, budowanie i wdrażanie
2. **Ruchownik** (Traefik) - reverse-proxy obsługujący routing i certyfikaty SSL
3. **Nadzorca** - komponenty monitorujące i zbierające logi

### Struktura katalogów

```
deploy-stack/
├── README_FIRST.md                # Baza wiedzy projektu - pełna dokumentacja
├── docker-compose.yml             # Główny plik Compose z modułami x-enabled
├── .env.przykład                  # Domyślne wartości (wszystkie ENABLE_* = 0)
├── init.sh                        # Skrypt inicjalizacyjny
├── configure-environment.sh       # Skrypt konfiguracji środowiska
├── orchestrator/                  # Serwis "Orkiestrator" do uploadu i deployu
│   ├── Dockerfile                 # Multi-stage builder + finalny obraz
│   ├── src/
│   │   ├── index.js               # Express + React UI do uploadu
│   │   ├── deploy.js              # Logika parsowania i uruchamiania
│   │   ├── routes.js              # Routing aplikacji
│   │   └── szablony/              # Szablony Handlebars/Mustache
│   └── package.json               # Zależności
├── traefik/                       # "Ruchownik" - reverse-proxy + SSL
│   ├── traefik.yml                # Konfiguracja główna
│   └── dynamic/                   # Konfiguracja dynamiczna
│       ├── middlewares.yml        # Middleware dla bezpieczeństwa
│       ├── services.yml           # Definicje serwisów
│       └── tls.yml                # Konfiguracja TLS
└── monitoring/                    # "Nadzorca" - monitoring i logi
    ├── prometheus.yml             # Konfiguracja Prometheus
    └── grafana/                   # Konfiguracja Grafana
        ├── provisioning/          # Automatyczna konfiguracja
        │   ├── dashboards/        # Konfiguracja dashboardów
        │   └── datasources/       # Konfiguracja źródeł danych
        └── dashboards/            # Definicje dashboardów
```

## Wymagania systemowe

### Minimalne wymagania
- Docker Engine 19.03 lub nowszy
- Docker Compose 1.27 lub nowszy
- 2 GB RAM
- 10 GB wolnego miejsca na dysku
- Dostęp do internetu

### Zalecane wymagania
- Docker Engine 20.10 lub nowszy
- Docker Compose 2.0 lub nowszy
- 4 GB RAM
- 20 GB wolnego miejsca na dysku
- Portainer CE (opcjonalnie, ale zalecane)
- Dostęp do internetu
- Konto Cloudflare (dla automatycznego SSL)

## Instalacja

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

2. Uruchom skrypt inicjalizacyjny:
   ```
   ./init.sh
   ```
   
   Skrypt przeprowadzi Cię przez proces konfiguracji, pytając o:
   - Wybór środowiska (Development, Test, Production)
   - Komponenty do włączenia (bazy danych, Redis, monitoring, itd.)

3. Uruchom stack:
   ```
   docker-compose up -d
   ```

4. Sprawdź, czy wszystkie kontenery zostały uruchomione:
   ```
   docker-compose ps
   ```

5. Otwórz przeglądarkę i przejdź do http://localhost:4000, aby uzyskać dostęp do interfejsu Orkiestratora.

## Konfiguracja

### Plik .env

Główna konfiguracja systemu odbywa się poprzez plik `.env`. Możesz edytować ten plik ręcznie lub użyć skryptu `init.sh` do interaktywnej konfiguracji.

Najważniejsze zmienne konfiguracyjne:

```
# Środowiska
ENABLE_DEV=0/1
ENABLE_TEST=0/1
ENABLE_PROD=0/1

# Komponenty podstawowe
ORCHESTRATOR_PORT=4000

# Komponenty opcjonalne
ENABLE_DB=0/1
DB_TYPE=postgres/mysql/mongodb
DB_USER=dbuser
DB_PASSWORD=dbpassword
DB_NAME=appdb
DB_PORT=5432

ENABLE_REDIS=0/1
REDIS_PORT=6379
REDIS_PASSWORD=redispassword

ENABLE_MONITORING=0/1
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000

ENABLE_MAILHOG=0/1
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

ENABLE_MINIO=0/1
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# Konfiguracja Traefik
ENABLE_TRAEFIK=1
TRAEFIK_DASHBOARD_PORT=8080
CLOUDFLARE_EMAIL=your-email@example.com
CLOUDFLARE_API_KEY=your-api-key
```

### Konfiguracja środowisk

System DeployMaster obsługuje trzy środowiska: Development, Test i Production. Możesz włączyć jedno z nich, ustawiając odpowiednią zmienną na 1 w pliku `.env`:

```
ENABLE_DEV=1
ENABLE_TEST=0
ENABLE_PROD=0
```

Po zmianie konfiguracji środowiska, uruchom skrypt `configure-environment.sh`, aby wygenerować odpowiedni plik `docker-compose.override.yml`:

```
./configure-environment.sh
```

Następnie zrestartuj stack:

```
docker-compose down
docker-compose up -d
```

### Konfiguracja SSL

DeployMaster używa Traefik do obsługi SSL. Domyślnie skonfigurowany jest do używania Cloudflare DNS Challenge dla automatycznego generowania certyfikatów.

Aby skonfigurować SSL:

1. Ustaw zmienne w pliku `.env`:
   ```
   CLOUDFLARE_EMAIL=your-email@example.com
   CLOUDFLARE_API_KEY=your-api-key
   ```

2. Zrestartuj stack:
   ```
   docker-compose down
   docker-compose up -d
   ```

## Użytkowanie

### Interfejs Orkiestratora

Po zainstalowaniu i uruchomieniu systemu, możesz uzyskać dostęp do interfejsu Orkiestratora pod adresem http://localhost:4000 (lub innym porcie, jeśli został zmieniony w konfiguracji).

Interfejs Orkiestratora składa się z następujących sekcji:

1. **Strona główna** - dashboard z informacjami o systemie
2. **Projekty** - lista zdeployowanych projektów
3. **Nowy projekt** - formularz do tworzenia nowego projektu
4. **Ustawienia** - konfiguracja systemu
5. **Monitoring** - statystyki i metryki systemu
6. **Logi** - logi systemowe

### Deployment projektu

Aby zdeployować nowy projekt:

1. Przejdź do sekcji "Nowy projekt" w interfejsie Orkiestratora
2. Wypełnij formularz:
   - Nazwa projektu
   - Typ projektu (statyczna strona HTML, React, Next.js, Vue.js)
   - Plik projektu (ZIP)
   - Środowisko (Development, Test, Production)
   - Usługi do włączenia (bazy danych, Redis, monitoring, itd.)
3. Kliknij "Utwórz projekt"
4. Poczekaj na zakończenie procesu deploymentu
5. Po zakończeniu procesu otrzymasz link do swojej aplikacji

### Zarządzanie projektami

W sekcji "Projekty" możesz zarządzać zdeployowanymi projektami:

- **Status projektu** - informacje o projekcie, uruchomionych kontenerach i włączonych usługach
- **Logi projektu** - logi z kontenerów projektu
- **Zatrzymanie projektu** - zatrzymanie wszystkich kontenerów projektu
- **Restart projektu** - restart wszystkich kontenerów projektu

## Komponenty opcjonalne

DeployMaster oferuje szereg opcjonalnych komponentów, które można włączyć w zależności od potrzeb projektu.

### Bazy danych

System obsługuje trzy typy baz danych:

1. **PostgreSQL** - domyślna baza danych
   - Port: 5432
   - Użytkownik: dbuser (konfigurowalne)
   - Hasło: dbpassword (konfigurowalne)
   - Baza danych: appdb (konfigurowalne)

2. **MySQL**
   - Port: 3306
   - Użytkownik: dbuser (konfigurowalne)
   - Hasło: dbpassword (konfigurowalne)
   - Baza danych: appdb (konfigurowalne)

3. **MongoDB**
   - Port: 27017
   - Użytkownik: dbuser (konfigurowalne)
   - Hasło: dbpassword (konfigurowalne)

### Redis

Redis to szybki magazyn danych w pamięci, który może być używany jako cache lub broker wiadomości.

- Port: 6379
- Hasło: redispassword (konfigurowalne)

### RabbitMQ

RabbitMQ to broker wiadomości, który może być używany do komunikacji między mikrousługami.

- Port: 5672
- Port zarządzania: 15672
- Użytkownik: rabbitmq (konfigurowalne)
- Hasło: rabbitmqpassword (konfigurowalne)

### Monitoring

System monitoringu składa się z następujących komponentów:

1. **Prometheus** - zbieranie i przechowywanie metryk
   - Port: 9090
   - Dostęp: http://localhost:9090 lub http://prometheus.domena (z SSL)

2. **Grafana** - wizualizacja metryk
   - Port: 3000
   - Dostęp: http://localhost:3000 lub http://grafana.domena (z SSL)
   - Użytkownik: admin (konfigurowalne)
   - Hasło: admin (konfigurowalne)

3. **Node Exporter** - eksporter metryk systemu
   - Port: 9100

4. **cAdvisor** - eksporter metryk kontenerów
   - Port: 8080

### MailHog

MailHog to narzędzie do testowania wysyłki e-maili, które przechwytuje wszystkie wychodzące e-maile i wyświetla je w interfejsie webowym.

- Port SMTP: 1025
- Port UI: 8025
- Dostęp: http://localhost:8025 lub http://mail.domena (z SSL)

### MinIO

MinIO to serwer kompatybilny z Amazon S3, który może być używany do przechowywania plików.

- Port API: 9000
- Port konsoli: 9001
- Dostęp: http://localhost:9001 lub http://s3-console.domena (z SSL)
- Użytkownik: minioadmin (konfigurowalne)
- Hasło: minioadmin (konfigurowalne)

## Rozwiązywanie problemów

### Typowe problemy

1. **Problem z dostępem do UI Orkiestratora**
   - Sprawdź, czy kontener jest uruchomiony: `docker ps | grep orchestrator`
   - Sprawdź logi: `docker logs deploy-stack_orchestrator_1`
   - Upewnij się, że port 4000 jest dostępny i nie jest używany przez inną aplikację

2. **Błędy podczas budowania projektu**
   - Sprawdź logi budowania: `docker logs deploy-stack_orchestrator_1`
   - Upewnij się, że projekt ma poprawną strukturę
   - Sprawdź, czy wszystkie zależności są zainstalowane

3. **Problemy z certyfikatami SSL**
   - Sprawdź konfigurację Cloudflare
   - Sprawdź logi Traefik: `docker logs deploy-stack_traefik_1`
   - Upewnij się, że podałeś poprawny email i klucz API Cloudflare

4. **Problemy z bazą danych**
   - Sprawdź, czy kontener bazy danych jest uruchomiony: `docker ps | grep db`
   - Sprawdź logi: `docker logs deploy-stack_postgres_1` (lub mysql/mongodb)
   - Upewnij się, że podałeś poprawne dane dostępowe

### Logi

Logi są kluczowym narzędziem do diagnozowania problemów. Możesz uzyskać dostęp do logów na kilka sposobów:

1. **Logi kontenerów**
   ```
   docker logs deploy-stack_orchestrator_1
   docker logs deploy-stack_traefik_1
   docker logs deploy-stack_prometheus_1
   ```

2. **Logi w interfejsie Orkiestratora**
   - Przejdź do sekcji "Logi" w interfejsie Orkiestratora
   - Wybierz projekt i kontener, którego logi chcesz zobaczyć

3. **Logi projektów**
   - Przejdź do sekcji "Projekty"
   - Wybierz projekt
   - Kliknij "Zobacz logi"

### Restart usług

Jeśli masz problemy z jakąś usługą, możesz ją zrestartować:

```
docker-compose restart orchestrator
docker-compose restart traefik
docker-compose restart prometheus
```

Lub zrestartować cały stack:

```
docker-compose down
docker-compose up -d
```

## FAQ

### Jak zmienić port Orkiestratora?

Edytuj zmienną `ORCHESTRATOR_PORT` w pliku `.env`, a następnie zrestartuj stack:

```
ORCHESTRATOR_PORT=8080
```

```
docker-compose down
docker-compose up -d
```

### Jak włączyć bazę danych?

Edytuj zmienną `ENABLE_DB` w pliku `.env`, a następnie uruchom skrypt `configure-environment.sh` i zrestartuj stack:

```
ENABLE_DB=1
DB_TYPE=postgres
DB_USER=myuser
DB_PASSWORD=mypassword
DB_NAME=mydb
```

```
./configure-environment.sh
docker-compose down
docker-compose up -d
```

### Jak zmienić środowisko?

Edytuj zmienne `ENABLE_DEV`, `ENABLE_TEST` i `ENABLE_PROD` w pliku `.env`, a następnie uruchom skrypt `configure-environment.sh` i zrestartuj stack:

```
ENABLE_DEV=0
ENABLE_TEST=0
ENABLE_PROD=1
```

```
./configure-environment.sh
docker-compose down
docker-compose up -d
```

### Jak uzyskać dostęp do dashboardu Traefik?

Dashboard Traefik jest dostępny pod adresem http://localhost:8080 (lub innym porcie, jeśli został zmieniony w konfiguracji).

Domyślne dane logowania:
- Użytkownik: admin
- Hasło: admin

### Jak uzyskać dostęp do Grafana?

Grafana jest dostępna pod adresem http://localhost:3000 (lub innym porcie, jeśli został zmieniony w konfiguracji).

Domyślne dane logowania:
- Użytkownik: admin
- Hasło: admin

## Rozwój projektu

### Dodawanie nowych komponentów

1. Dodaj nową sekcję w `docker-compose.yml`
2. Dodaj odpowiednią zmienną `ENABLE_*` w pliku `.env.przykład`
3. Zaktualizuj skrypt `configure-environment.sh`
4. Zaktualizuj skrypt `init.sh`
5. Zaktualizuj dokumentację

### Aktualizacja istniejących komponentów

1. Zmień wersję obrazu w `docker-compose.yml`
2. Przetestuj kompatybilność
3. Zaktualizuj dokumentację

### Zgłaszanie błędów

Jeśli znajdziesz błąd w systemie DeployMaster, zgłoś go poprzez system issues na GitHubie:

1. Przejdź do https://github.com/twoje-repo/deploy-stack/issues
2. Kliknij "New issue"
3. Opisz problem, podając jak najwięcej szczegółów
4. Dołącz logi, jeśli to możliwe

### Kontakt

W przypadku pytań lub problemów, skontaktuj się z zespołem DeployMaster:

- Email: support@deploymaster.example.com
- GitHub: https://github.com/twoje-repo/deploy-stack
