# DeployMaster - Baza Wiedzy

## Spis treści
1. [Wprowadzenie](#wprowadzenie)
2. [Architektura systemu](#architektura-systemu)
3. [Komponenty systemu](#komponenty-systemu)
4. [Instalacja i konfiguracja](#instalacja-i-konfiguracja)
5. [Użytkowanie systemu](#użytkowanie-systemu)
6. [Rozwiązywanie problemów](#rozwiązywanie-problemów)
7. [Najczęściej zadawane pytania (FAQ)](#najczęściej-zadawane-pytania-faq)
8. [Historia rozwoju i wyzwania](#historia-rozwoju-i-wyzwania)

## Wprowadzenie

DeployMaster to kompleksowy system do automatycznego deploymentu aplikacji, zaprojektowany z myślą o prostocie użytkowania i niezawodności. System umożliwia łatwe wdrażanie różnych typów aplikacji (React, Next.js, Vue.js, Angular, statyczne strony HTML) poprzez intuicyjny interfejs webowy.

Główne cechy systemu:
- Automatyczne wykrywanie typu projektu
- Automatyczne budowanie i deployment aplikacji
- Zarządzanie kontenerami Docker
- Obsługa wielu środowisk (dev/test/prod)
- Monitoring i logi
- Skalowalność i modułowość

## Architektura systemu

DeployMaster składa się z kilku kluczowych komponentów, które współpracują ze sobą, tworząc kompleksowe rozwiązanie do deploymentu aplikacji:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Orkiestrator  │────▶│    Ruchownik    │────▶│    Aplikacje    │
│    (Node.js)    │     │    (Traefik)    │     │  (Kontenery)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │                       │
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│      Baza       │     │     Nadzorca    │     │      Cache      │
│   (PostgreSQL)  │     │  (Prometheus)   │     │     (Redis)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### Przepływ danych

1. Użytkownik przesyła projekt przez interfejs Orkiestratora
2. Orkiestrator analizuje typ projektu i przygotowuje konfigurację
3. Orkiestrator buduje i uruchamia kontener z aplikacją
4. Ruchownik (Traefik) konfiguruje routing do nowej aplikacji
5. Nadzorca (Prometheus) rozpoczyna monitoring nowej aplikacji
6. Użytkownik otrzymuje URL do swojej wdrożonej aplikacji

## Komponenty systemu

### Orkiestrator

Orkiestrator to centralny komponent systemu, odpowiedzialny za zarządzanie całym procesem deploymentu. Jest to aplikacja Node.js, która udostępnia interfejs webowy oraz API do zarządzania projektami.

**Funkcje Orkiestratora:**
- Przyjmowanie plików projektów (upload)
- Analiza typu projektu
- Budowanie i uruchamianie kontenerów
- Zarządzanie konfiguracją
- Udostępnianie interfejsu użytkownika

**Technologie:**
- Node.js
- Express
- Docker API
- Handlebars (szablony)

### Ruchownik (Traefik)

Ruchownik to reverse proxy, który zarządza ruchem sieciowym do aplikacji. Automatycznie wykrywa nowe kontenery i konfiguruje routing.

**Funkcje Ruchownika:**
- Routing ruchu do odpowiednich aplikacji
- Load balancing
- Obsługa SSL/TLS
- Automatyczne wykrywanie nowych usług

**Technologie:**
- Traefik
- Docker provider

### Nadzorca (Monitoring)

Nadzorca to system monitoringu, który zbiera metryki z aplikacji i infrastruktury, umożliwiając monitorowanie stanu systemu.

**Funkcje Nadzorcy:**
- Zbieranie metryk
- Wizualizacja danych
- Alerty
- Analiza wydajności

**Technologie:**
- Prometheus
- Grafana

### Baza danych

System wykorzystuje bazę danych PostgreSQL do przechowywania informacji o projektach, użytkownikach i konfiguracji.

**Przechowywane dane:**
- Informacje o projektach
- Konfiguracje deploymentu
- Dane użytkowników
- Logi i historia operacji

### Cache (Redis)

Redis jest wykorzystywany jako szybki cache dla często używanych danych oraz do obsługi kolejek zadań.

**Zastosowania:**
- Przechowywanie sesji
- Kolejkowanie zadań budowania
- Cache dla często używanych danych
- Komunikacja między komponentami

## Instalacja i konfiguracja

### Wymagania systemowe

- Docker Engine 20.10+
- Docker Compose 2.0+
- Minimum 2GB RAM
- Minimum 10GB wolnego miejsca na dysku
- Dostęp do internetu

### Instalacja przez Portainer

1. Zaloguj się do Portainer
2. Przejdź do Stacks → Add stack
3. Wybierz metodę "Git repository"
4. Wprowadź URL repozytorium: `https://github.com/optiq-ai/deploy-master.git`
5. Kliknij "Deploy the stack"
6. Poczekaj na zakończenie instalacji

### Instalacja manualna

1. Sklonuj repozytorium:
   ```
   git clone https://github.com/optiq-ai/deploy-master.git
   cd deploy-master
   ```

2. Uruchom stack:
   ```
   docker-compose up -d
   ```

3. Otwórz przeglądarkę i przejdź do http://localhost:4000, aby uzyskać dostęp do interfejsu Orkiestratora.

### Konfiguracja środowisk

System obsługuje trzy środowiska: dev, test i prod. Domyślnie używane jest środowisko dev.

Aby zmienić środowisko, edytuj plik `.env`:

```
ENVIRONMENT=prod  # Możliwe wartości: dev, test, prod
```

### Konfiguracja komponentów opcjonalnych

System ma modułową architekturę, która pozwala włączać i wyłączać poszczególne komponenty. Domyślnie włączone są:
- PostgreSQL
- Redis
- Monitoring (Prometheus + Grafana)
- MailHog (do testowania emaili)

Aby włączyć/wyłączyć komponenty, edytuj plik `.env`:

```
ENABLE_DB=1        # Baza danych PostgreSQL
ENABLE_REDIS=1     # Redis cache
ENABLE_MONITORING=1  # Prometheus + Grafana
ENABLE_MAILHOG=1   # MailHog do testowania emaili
```

## Użytkowanie systemu

### Interfejs użytkownika

Interfejs użytkownika Orkiestratora jest dostępny pod adresem http://localhost:4000. Główne sekcje interfejsu:

- **Dashboard** - przegląd systemu i statystyki
- **Projekty** - lista wdrożonych projektów
- **Nowy projekt** - formularz do wgrywania nowych projektów
- **Monitoring** - statystyki i wykresy
- **Ustawienia** - konfiguracja systemu

### Wdrażanie projektu

1. Przejdź do sekcji "Nowy projekt"
2. Wybierz plik projektu (ZIP, TAR.GZ) lub podaj URL repozytorium Git
3. Wybierz typ projektu (lub pozostaw automatyczne wykrywanie)
4. Wybierz środowisko (dev/test/prod)
5. Kliknij "Wdróż projekt"
6. Poczekaj na zakończenie procesu budowania i wdrażania
7. Po zakończeniu otrzymasz URL do swojej aplikacji

### Zarządzanie projektami

W sekcji "Projekty" możesz:
- Przeglądać listę wdrożonych projektów
- Sprawdzać status projektów
- Przeglądać logi projektów
- Restartować projekty
- Usuwać projekty

### Monitorowanie

W sekcji "Monitoring" możesz:
- Przeglądać statystyki użycia zasobów
- Monitorować wydajność aplikacji
- Przeglądać logi systemowe
- Konfigurować alerty

## Rozwiązywanie problemów

### Typowe problemy i rozwiązania

#### Problem: Kontener Orkiestratora restartuje się

**Przyczyna:** Najczęściej problem z zależnościami Node.js.

**Rozwiązanie:**
1. Sprawdź logi kontenera: `docker logs deploy-orchestrator`
2. Upewnij się, że wszystkie zależności są poprawnie zainstalowane
3. Jeśli widzisz błędy "Cannot find module", zrestartuj stack: `docker-compose down && docker-compose up -d`
4. Jeśli problem nadal występuje, upewnij się, że pakiet `express-fileupload` jest poprawnie zainstalowany i skonfigurowany w pliku `index.js`

#### Problem: Błędy ACME w logach Traefik

**Przyczyna:** Problemy z konfiguracją SSL/TLS.

**Rozwiązanie:**
1. Sprawdź, czy zmienna `CLOUDFLARE_EMAIL` jest poprawnie ustawiona
2. Jeśli nie używasz Cloudflare, wyłącz obsługę SSL w konfiguracji Traefik
3. Zrestartuj kontener Traefik: `docker restart deploy-traefik`

#### Problem: Nie można wgrać plików przez formularz

**Przyczyna:** Brak middleware express-fileupload lub niepoprawna konfiguracja endpointu /api/upload.

**Rozwiązanie:**
1. Upewnij się, że pakiet `express-fileupload` jest zainstalowany: `npm list express-fileupload`
2. Sprawdź, czy middleware jest poprawnie skonfigurowany w pliku `index.js`
3. Zweryfikuj, czy endpoint `/api/upload` jest poprawnie zaimplementowany
4. Sprawdź, czy formularz HTML ma atrybut `enctype="multipart/form-data"`
5. Zrestartuj kontener Orkiestratora: `docker restart deploy-orchestrator`

#### Problem: Błędy Content Security Policy (CSP) blokujące zasoby

**Przyczyna:** Brak lub nieprawidłowa konfiguracja nagłówków Content Security Policy w aplikacji, co powoduje blokowanie zasobów takich jak favicon.ico, skrypty czy style.

**Rozwiązanie:**
1. Zainstaluj pakiet `helmet` do obsługi nagłówków bezpieczeństwa: `npm install helmet --save`
2. Dodaj konfigurację helmet w pliku `index.js`:
   ```javascript
   const helmet = require('helmet');
   
   app.use(helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         scriptSrc: ["'self'", "'unsafe-inline'"],
         styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
         imgSrc: ["'self'", "data:", "http://localhost:4000"],
         connectSrc: ["'self'"],
         fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
         objectSrc: ["'none'"],
         mediaSrc: ["'self'"],
         frameSrc: ["'none'"],
       }
     }
   }));
   ```
3. Dostosuj dyrektywy CSP do potrzeb aplikacji, upewniając się, że wszystkie używane zasoby są dozwolone
4. Zrestartuj kontener Orkiestratora: `docker restart deploy-orchestrator`
5. Sprawdź w konsoli przeglądarki, czy nadal występują błędy CSP

### Logi systemowe

Logi poszczególnych komponentów można przeglądać za pomocą:

```
docker logs deploy-orchestrator  # Logi Orkiestratora
docker logs deploy-traefik       # Logi Ruchownika
docker logs deploy-prometheus    # Logi Nadzorcy
```

Wszystkie logi można przeglądać jednocześnie:

```
docker-compose logs -f
```

## Najczęściej zadawane pytania (FAQ)

### Ogólne

**P: Czy DeployMaster obsługuje aplikacje w różnych językach programowania?**

O: Tak, DeployMaster obsługuje różne typy aplikacji, w tym:
- JavaScript/TypeScript (React, Vue.js, Angular, Next.js)
- Statyczne strony HTML
- PHP
- Python
- Java
- Go

**P: Czy mogę używać własnych obrazów Docker?**

O: Tak, możesz dostarczyć własny Dockerfile wraz z projektem, który zostanie użyty do budowania kontenera.

**P: Czy DeployMaster obsługuje bazy danych?**

O: Tak, DeployMaster może automatycznie tworzyć i konfigurować bazy danych dla Twoich aplikacji, w tym:
- PostgreSQL
- MySQL
- MongoDB
- Redis

### Techniczne

**P: Jak działa automatyczne wykrywanie typu projektu?**

O: DeployMaster analizuje strukturę plików projektu, szukając charakterystycznych plików konfiguracyjnych (package.json, angular.json, vue.config.js, itp.) oraz wzorców katalogów.

**P: Czy DeployMaster obsługuje mikrousługi?**

O: Tak, możesz wdrażać wiele powiązanych ze sobą aplikacji, które będą mogły komunikować się ze sobą w ramach sieci Docker.

**P: Czy mogę skalować aplikacje?**

O: Tak, możesz określić liczbę replik dla każdej aplikacji, a Ruchownik (Traefik) automatycznie skonfiguruje load balancing.

**P: Czy DeployMaster obsługuje CI/CD?**

O: Tak, DeployMaster udostępnia API, które można integrować z narzędziami CI/CD, takimi jak Jenkins, GitHub Actions czy GitLab CI.

## Historia rozwoju i wyzwania

Projekt DeployMaster przeszedł przez kilka kluczowych etapów rozwoju, podczas których napotkaliśmy i rozwiązaliśmy różne wyzwania:

### Etap 1: Podstawowa struktura i architektura

Początkowo stworzyliśmy podstawową strukturę projektu, definiując kluczowe komponenty:
- Orkiestrator (Node.js)
- Ruchownik (Traefik)
- Nadzorca (Prometheus + Grafana)

Głównym wyzwaniem było zaprojektowanie modułowej architektury, która pozwalałaby na elastyczną konfigurację.

### Etap 2: Rozwiązywanie problemów z zależnościami

Jednym z największych wyzwań były problemy z zależnościami Node.js w kontenerze Orkiestratora. Rozwiązaliśmy to poprzez:
1. Uproszczenie Dockerfile
2. Stworzenie skryptu inicjalizacyjnego, który sam tworzy pliki i instaluje zależności
3. Implementację wielu strategii fallback dla instalacji zależności

### Etap 3: Konfiguracja SSL i Traefik

Napotkaliśmy problemy z konfiguracją SSL w Traefik, które powodowały błędy ACME. Rozwiązaliśmy to poprzez:
1. Uproszczenie konfiguracji Traefik
2. Usunięcie problematycznych elementów związanych z SSL
3. Zapewnienie podstawowej funkcjonalności reverse proxy

### Etap 4: Implementacja API i interfejsu użytkownika

Zaimplementowaliśmy kompletne API i interfejs użytkownika dla Orkiestratora, umożliwiając:
1. Upload projektów
2. Zarządzanie wdrożonymi aplikacjami
3. Monitoring i logi
4. Konfigurację systemu

### Etap 5: Testowanie i dokumentacja

Ostatnim etapem było kompleksowe testowanie systemu i stworzenie dokumentacji, w tym:
1. Automatyczne testy
2. Szablony dla różnych typów aplikacji
3. Dokumentacja dla użytkowników
4. Baza wiedzy (ten dokument)

Dzięki metodycznemu podejściu do rozwiązywania problemów, udało nam się stworzyć niezawodny i elastyczny system do automatycznego deploymentu aplikacji.
