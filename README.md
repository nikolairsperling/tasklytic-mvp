# Tasklytic Prospect MVP

Tasklytic ist ein schlanker MVP zur Erfassung, Bewertung und Ausspielung von Prospect-Daten für deutsche mittelständische Speditionen. Das Projekt enthält ein internes Outreach-Dashboard, regelbasiertes Prospect-Scoring, personalisierte Landingpages, CSV Import/Export, einen Webhook-Import und ein manuell ausgelöstes SMTP-Kampagnensystem.

## Lokale Installation

1. Node.js 20+ und PostgreSQL lokal bereitstellen.
2. Abhängigkeiten installieren:
   `npm install`
3. Umgebungsvariablen anlegen:
   `.env.example` nach `.env` übernehmen
4. Prisma Client erzeugen:
   `npx prisma generate`
5. Datenbank migrieren:
   `npx prisma migrate dev --name init`
6. Dev-Server starten:
   `npm run dev`

## .env Setup

Beispiel in [.env.example](/Users/nikolaisperling/Documents/New%20project/.env.example:1):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:55432/tasklytic?schema=public&connection_limit=10&pool_timeout=20"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/tasklytic_test?schema=public&connection_limit=10&pool_timeout=20"
PERSISTENCE_TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:55432/tasklytic_test?schema=public&connection_limit=10&pool_timeout=20"
POSTGRES_PASSWORD="postgres"
POSTGRES_PORT="55432"
APP_PORT="3000"
APP_URL="https://app.tasklytic.de"
NEXT_PUBLIC_APP_URL="https://app.tasklytic.de"
SESSION_SECRET=change-this-to-a-long-random-secret
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
SMTP_FROM_EMAIL="nikolai@tasklytic.de"
SMTP_FROM_NAME="Tasklytic"
SMTP_REPLY_TO_EMAIL=""
SMTP_SETTINGS_SECRET="change-me-long-random-secret"
MAILBOX_SETTINGS_SECRET="change-me-long-random-secret"
INTEGRATION_SETTINGS_SECRET="change-me-long-random-secret"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
```

`DATABASE_URL` erwartet eine laufende PostgreSQL-Datenbank. Das Projekt nutzt Prisma mit dem PostgreSQL-Provider. Auf dem VPS sollten `connection_limit=10` und `pool_timeout=20` gesetzt sein, damit Prisma den Pool begrenzt und bei Last sauber wartet. Wenn Postgres in Docker Compose läuft, nutzt die App intern den Host `postgres`; für lokale CLI-Befehle wird derselbe Postgres-Service über `127.0.0.1:${POSTGRES_PORT:-55432}` veröffentlicht. So zeigen App, Prisma-CLI und Smoke-Tests auf dieselbe persistente Datenbank.

`SESSION_SECRET` wird für signierte Login-Sessions benötigt. Der Wert muss mindestens 32 Zeichen lang, zufällig generiert und geheim gehalten werden. Nach jeder Änderung an `SESSION_SECRET` muss der Server neu gestartet werden. Ohne gültiges Secret blockiert die Admin-Erstellung und Login-Sessions können nicht erzeugt werden.

Die SMTP-Variablen werden erst beim manuellen Versand fälliger Kampagnenmails validiert. Ohne vollständige SMTP-Konfiguration können Kampagnen und Steps vorbereitet werden, der Versand wird aber abgelehnt.

## Admin-Menüstruktur

Der Adminbereich nutzt ein gemeinsames Layout mit linker Sidebar und Topbar:

- Übersicht: `/admin`
- Setup Center: `/admin/setup`
- Dashboard: `/admin/dashboard`
- Lead Scout: `/admin/lead-scout`
- Impact Studio: `/admin/impact`
- Kampagnen: `/admin/campaigns`
- Hot Leads: `/admin/hot-leads`
- Inbox: `/admin/inbox`
- Analytics: `/admin/analytics`
- Alle Kontakte: `/admin/contacts`
- Prospects: `/admin/prospects`
- Ausschlüsse: `/admin/exclusions`
- Löschanträge: `/admin/deletion-requests`
- Assets: `/admin/assets`
- Einstellungen: `/admin/settings`
- SMTP Einstellungen: `/admin/settings/smtp`
- Mailbox Einstellungen: `/admin/settings/mailbox`
- Integrationen: `/admin/settings/integrations`
- App Einstellungen: `/admin/settings/app`
- Design Einstellungen: `/admin/settings/design`
- Tracking: `/admin/settings/tracking`
- Rechtliches: `/admin/settings/legal`
- Buchungskalender: `/admin/settings/booking`
- Landingpages: `/admin/landingpages`

Das Dashboard zeigt zentrale Kennzahlen zu Prospects, kampagnenfähigen Prospects, Kampagnen, gesendeten E-Mails, fehlgeschlagenen E-Mails und den letzten Versandversuchen.

Desktop nutzt eine feste Sidebar links und eine Topbar. Mobil nutzt das Adminsystem einen Burger-Drawer und Bottom Navigation. Tabellen sind horizontal scrollbar, Formulare laufen mobil einspaltig.

Der Adminbereich unterstützt globalen Light/Dark Mode. Die Einstellung wird in `AppSettings.themeMode` gespeichert und über den Toggle in der Topbar sofort angewendet.

## Admin Login

Der Adminbereich ist per Login geschützt. Beim ersten Start ohne `AdminUser` leitet `/login` auf `/setup/admin` weiter. Dort kann genau der erste Admin angelegt werden; danach ist die Setup-Seite gesperrt.

Geschützt sind:

- `/admin/*`
- mutierende `/api/*` Requests wie `POST`, `PATCH` und `DELETE`
- Settings, Kampagnen, Prospects, Offers und Assets über diese Admin/API-Routen

Öffentlich bleiben:

- `/login`
- `/setup/admin`, solange noch kein Admin existiert
- öffentliche Landingpages `/p/[slug]`
- `/legal/*`
- Tracking-Endpunkte `/api/track/*`

Sessions laufen über ein signiertes `httpOnly` Cookie mit `SameSite=Lax`. In Production wird das Cookie nur als `Secure` gesetzt.

## Domain und SSL

Ziel-Domain: `https://app.tasklytic.de`

DNS:

- A-Record setzen: `app.tasklytic.de -> 148.230.114.53`

Nginx Reverse Proxy auf `localhost:3000`:

```nginx
server {
  server_name app.tasklytic.de;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 120s;
    proxy_connect_timeout 60s;
    proxy_send_timeout 120s;
  }
}
```

SSL mit Certbot:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d app.tasklytic.de
sudo systemctl status certbot.timer
```

Let's Encrypt richtet die automatische Erneuerung über den Certbot Timer ein. Nach DNS-Umstellung sollten `APP_URL` und `NEXT_PUBLIC_APP_URL` auf `https://app.tasklytic.de` zeigen.

Port `3000` darf nicht direkt öffentlich erreichbar sein. In Docker Compose ist der App-Port deshalb nur auf `127.0.0.1:3000` gebunden; nach außen gehen nur `80/443` über Nginx.

## VPS Stabilität

### Prisma Client

Prisma wird zentral über `src/lib/prisma.ts` als Singleton bereitgestellt. API-Routen und Server-Code sollen ausschließlich `prisma` aus `@/lib/prisma` importieren und keinen eigenen `new PrismaClient()` erzeugen. Dadurch werden in Next.js keine neuen DB-Pools pro Request angelegt.

### Docker Compose

Das Repo enthält eine produktionsnahe Compose-Konfiguration in `docker-compose.yml`:

- App und Postgres haben `restart: unless-stopped`
- Postgres nutzt einen `pg_isready` Healthcheck
- die App startet erst nach healthy Postgres
- Postgres-Daten liegen persistent im Volume `postgres_data`
- Postgres ist lokal nur auf `127.0.0.1:${POSTGRES_PORT:-55432}` veröffentlicht, damit CLI-Befehle dieselbe Datenbank wie Docker nutzen
- die App startet mit `npm run persistence:check` und bricht bei nicht-persistenter oder falscher Docker-DB-URL ab
- Logs rotieren mit `max-size: 10m` und `max-file: 5`
- die App ist nur über `127.0.0.1:${APP_PORT:-3000}` erreichbar

Start:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

### Persistenzschutz

Produktive Daten duerfen nicht in In-Memory-State, LocalStorage, temporären JSON-Dateien oder einer nicht-persistenten SQLite-Datei liegen. Die produktiven Modelle fuer Angebote, Leads, API-/E-Mail-Konfigurationen, Buchungskalender, Nachrichtenvorlagen, Briefvorlagen, Landingpage-Vorlagen und Kampagnen werden ueber Prisma in PostgreSQL gespeichert.

Vor dem App-Start und manuell per CLI prueft der Persistenz-Check die Datenbank-Konfiguration:

```bash
npm run persistence:check
```

Tests sind absichtlich gegen produktive Datenbanken gesperrt, weil mehrere Testdateien Tabellen per `deleteMany` leeren. Fuer Tests muss `DATABASE_URL` oder `TEST_DATABASE_URL` auf eine klar erkennbare Test-Datenbank zeigen, z. B. `tasklytic_test`. Nur fuer eine bewusst manuelle lokale Pruefung darf `ALLOW_NON_TEST_DATABASE=1` gesetzt werden.

Persistenz-Smoke-Test auf einer Testdatenbank:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:55432/tasklytic_test?schema=public&connection_limit=10&pool_timeout=20" npm run persistence:smoke
```

Der Smoke-Test legt Testdaten fuer Angebot, Lead-Zuordnung, API-Konfiguration, SMTP-Konfiguration, Buchungskalender, Nachrichtenvorlage, Briefvorlage, Landingpage-Vorlage und Kampagne an, trennt die Prisma-Verbindung und liest alles mit einer neuen Verbindung erneut aus.

### PM2 Alternative

Wenn die App ohne Docker betrieben wird:

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 start npm --name tasklytic -- start
pm2 save
pm2 startup
pm2 install pm2-logrotate
```

### Deployment Reihenfolge

In Production:

```bash
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

Nicht in Production verwenden:

```bash
npx prisma migrate dev
```

### Backups

Ein Backup-Script liegt unter `deploy/scripts/backup-postgres.sh`:

```bash
DATABASE_URL="$DATABASE_URL" BACKUP_DIR="/var/backups/tasklytic" ./deploy/scripts/backup-postgres.sh
```

Das Script erstellt `tasklytic-YYYY-MM-DD.sql` und löscht SQL-Backups nach 14 Tagen. Für tägliche Backups per Cron:

```cron
15 3 * * * cd /var/www/tasklytic && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tasklytic?schema=public&connection_limit=10&pool_timeout=20" BACKUP_DIR="/var/backups/tasklytic" ./deploy/scripts/backup-postgres.sh
```

### Monitoring

Für den VPS sollte Uptime Kuma oder Hetrixtools eingerichtet werden:

- HTTP-Check auf `https://app.tasklytic.de`
- Intervall 60 Sekunden
- Benachrichtigung per Mail oder Telegram

### Smoke Tests nach Deployment

- Server neu starten
- App lädt über Domain
- DB erreichbar
- Angebote bleiben gespeichert
- Leads bleiben gespeichert
- Import-Vorschau lädt
- Import läuft durch
- App startet nach einem Prozess-Crash automatisch neu
- Postgres-Neustart verursacht keinen dauerhaften App-Ausfall

## PWA

Tasklytic ist als installierbare Web-App vorbereitet:

- Manifest: `/manifest.webmanifest`
- App Name: `Tasklytic Outreach`
- Short Name: `Tasklytic`
- Theme Color: `#0f172a`
- Platzhalter-Icon: `/tasklytic-icon.svg`

Es wird keine native App und keine App-Store-App gebaut.

## Kampagnen

Das Kampagnensystem ist unter `/admin/campaigns` erreichbar. Eine Kampagne besteht aus mehreren Steps mit Delay in Tagen, z. B. `0`, `3`, `6`. Prospects können nur hinzugefügt werden, wenn sie eine `decisionMakerEmail` und eine vorbereitete Landingpage (`slug`) besitzen.

Der Versand ist bewusst manuell: Der Button `Fällige Mails senden` versendet maximal 20 fällige E-Mails pro Klick. Es gibt keinen Cron, kein Tracking, keine externe Kampagnenplattform und keine automatische Recherche. Jeder Versandversuch wird als `EmailSendLog` gespeichert und in der Admin-UI angezeigt.

Kampagnen können geplant werden:

- `scheduledStartAt`: frühester Versandzeitpunkt
- `timezone`: Standard `Europe/Berlin`
- `sendWindowStart` / `sendWindowEnd`: optionales Versandfenster, z. B. `08:30` bis `17:30`
- `weekdaysOnly`: standardmäßig aktiv

Diese Regeln werden nur beim manuellen `send-due` geprüft. Es gibt weiterhin keinen Cron.

Verfügbare Template-Variablen:

- `{{companyName}}`
- `{{city}}`
- `{{decisionMakerName}}`
- `{{decisionMakerEmail}}`
- `{{landingpageUrl}}`

## Landingpage Preview und Builder

Prospects und Kontakte haben Aktionen für personalisierte Landingpages:

- `Landingpage generieren`: erstellt den Prospect-Slug, falls noch keiner vorhanden ist.
- `Landingpage Vorschau`: öffnet eine Admin-Vorschau als Modal mit Desktop/Mobile-Umschalter.
- `Landingpage öffnen`: öffnet die öffentliche `/p/[slug]` Landingpage.

Wenn noch kein Slug vorhanden ist, blockiert die Vorschau mit dem Hinweis `Bitte zuerst Landingpage generieren`.

Landingpage-Templates speichern zusätzlich eine abschnittsbasierte Struktur in `sectionsJson` und globale Designwerte in `globalDesignJson`. Der Builder unter `/admin/landingpages/templates/[id]` kann Abschnitte hinzufügen, löschen, umbenennen, duplizieren, deaktivieren und per Hoch/Runter-Buttons sortieren. Die Preview rendert nur aktive Abschnitte in aktueller Reihenfolge.

Header-Logos werden über `headerLogoUrl`, `headerLogoAlt`, `headerLogoWidth`, optional `headerLogoHeight`, `headerLogoPosition`, `headerShowTextFallback` und `headerTextFallback` gespeichert. Wenn kein Logo vorhanden ist, erscheint der Textfallback, standardmäßig `Tasklytic`. Mobile Preview nutzt ca. 390 px Canvas-Breite, Tablet ca. 760 px; Hero, Video und Vergleich laufen mobil einspaltig.

## Impact Studio

`/admin/impact` ist die zentrale Generator-Seite für personalisierte Outreach-Inhalte. V1 enthält Karten für personalisierte Landingpages, personalisierte Videos und personalisierte Briefe sowie eine Job-Historie mit aktiven und vergangenen Jobs.

`ImpactJob` speichert Typ, Name, optionale Kampagne, Status, Fortschritt, Credits, Ergebnisdaten und Fehlermeldungen. Es gibt keinen Cron, keinen Queue-Dienst und keine automatische Massenverarbeitung.

Landingpage Job V1:

- Kampagne oder Prospects auswählen
- Template-Zuordnung optional setzen
- fehlende Prospect-Slugs erzeugen
- Fortschritt als `processedItems/totalItems` speichern

Video und Brief sind als Module vorbereitet. Briefe speichern V1 nur Jobs und Template-/Asset-Bezug, ohne Druck- oder Post-API.

## Personalisierte Videos V1

Prospects können persönliche Videos vorbereiten. Neue Felder am Prospect speichern Video-URL, Skript, Status, Provider, Provider-Job-ID und Fehlermeldung. `VideoTemplate` verwaltet Provider-Vorlagen unter `/admin/assets/videos`.

Der V1-Provider ist `mock`:

- generiert kein echtes Video
- erzeugt ein deutsches Skript per OpenAI, wenn `OPENAI_API_KEY` gesetzt ist
- nutzt ohne Key ein Fallback-Skript
- setzt den Video-Job direkt auf `ready`
- schreibt die Mock-Video-URL zurück an den Prospect

Vorbereitete Provider: `heygen`, `tavus`, `synthesia`, `custom`. Diese Provider führen in V1 keinen externen API-Call aus und zeigen den Hinweis, dass sie vorbereitet, aber noch nicht verbunden sind.

Wichtige Routen:

- `POST /api/ai/generate-video-script`
- `GET|POST /api/videos/templates`
- `PATCH|DELETE /api/videos/templates/[id]`
- `POST /api/videos/generate`
- `GET /api/videos/jobs`
- `GET /api/videos/jobs/[id]`
- `POST /api/videos/jobs/[id]/start`
- `POST /api/videos/jobs/[id]/apply-to-prospect`

`/admin/impact/videos` erstellt synchron Mock-Video-Jobs für ausgewählte Prospects. V1 begrenzt Batches auf 20 Prospects. Auf `/p/[slug]` hat `Prospect.personalVideoUrl` Vorrang vor Template-Videos.

## Datenanreicherung

Prospects können manuell über den Button `Daten automatisch anreichern` ergänzt werden. Die API liegt unter:

- `POST /api/prospects/[id]/enrich`

V1 ist bewusst auf gezielte Einzelanreicherung beschränkt:

- Nur die im Prospect hinterlegte `websiteUrl` wird verwendet.
- Maximal 5 öffentliche Seiten pro Prospect werden abgerufen.
- Es werden nur URLs derselben Domain verarbeitet.
- User-Agent: `TasklyticBot/1.0`.
- Kein Login, keine Captcha-Umgehung, keine Social-Media- oder LinkedIn-Automation.
- Kein Massen-Scraping und kein automatischer Lauf beim Speichern.

Wenn `OPENAI_API_KEY` gesetzt ist, versucht Tasklytic eine strukturierte KI-Extraktion aus den öffentlich sichtbaren Website-Texten. Ohne Key läuft eine Basisanalyse per Regex und Keywords, unter anderem für E-Mail-Adresse, rechtlichen Firmennamen und einfache Logistik-/Transport-Signale. In diesem Fall wird klar gemeldet: `KI-Analyse nicht verfügbar, nur Basisdaten extrahiert`.

Vorschläge überschreiben bestehende Prospect-Felder nicht automatisch. Jeder Lauf wird als `ProspectEnrichmentRun` mit Status, Quelle, Seitenanzahl, Confidence, Vorschlägen und Quellen gespeichert. Im Prospect-Formular werden aktueller Wert, Vorschlag, Quellen und Übernehmen-Aktionen angezeigt.

Datenschutz-Hinweis: Die Anreicherung verarbeitet nur öffentlich zugängliche Inhalte der angegebenen Website. Rohdaten werden nicht dauerhaft als vollständige Website-Kopie gespeichert, API Keys werden nicht geloggt, und personenbezogene Daten dürfen nur aus öffentlich sichtbaren Unternehmensseiten übernommen werden.

## SMTP Einstellungen

SMTP-Zugangsdaten können unter `/admin/settings/smtp` gepflegt werden. Der Mailer nutzt zuerst gespeicherte SMTP-Einstellungen aus der Datenbank und fällt danach auf `.env` zurück.

SMTP-Passwörter werden nicht im Klartext an den Client gesendet. Beim Speichern wird das Passwort serverseitig mit `SMTP_SETTINGS_SECRET` verschlüsselt. Wenn `SMTP_SETTINGS_SECRET` fehlt, wird das Speichern eines Passworts blockiert. Ein leeres Passwortfeld überschreibt ein bestehendes gespeichertes Passwort nicht.

Verfügbare Prüfungen:

- `SMTP Verbindung testen`: prüft per Nodemailer `verify()`, ob der SMTP-Zugang erreichbar ist.
- `Testmail senden`: sendet eine einzelne Testmail an eine manuell eingegebene Adresse.

API-Routen:

- `GET /api/settings/smtp`
- `POST /api/settings/smtp/test-connection`
- `POST /api/settings/smtp/test-email`

## Tracking und Analytics

Kampagnen können Tracking bewusst aktivieren. Standardmäßig ist Tracking deaktiviert. Wenn Tracking aktiv ist, erzeugt Tasklytic eigene interne Tokens pro `EmailSendLog`:

- Open Tracking: `GET /api/track/open/[token]` gibt ein transparentes 1x1 Pixel zurück und erhöht `openCount`.
- Click Tracking: `GET /api/track/click/[token]` erhöht `clickCount` und leitet zur Landingpage weiter.

Es wird kein externes Tracking-Tool, kein Google Analytics und keine externe Plattform verwendet. Tracking sollte datenschutzrechtlich bewusst eingesetzt und vor produktiver Nutzung geprüft werden.

`/admin/analytics` zeigt globale Kennzahlen, Öffnungen, Klicks, Antworten, Termine, Kein-Interesse-Markierungen und Kampagnenvergleiche.

## Inbox und IMAP

`/admin/inbox` zeigt eingehende Antworten aus einem manuell synchronisierten IMAP-Postfach. Die Konfiguration liegt unter `/admin/settings/mailbox`.

V1-Regeln:

- Kein permanenter Hintergrunddienst
- Kein Cron
- Button `Postfach jetzt synchronisieren`
- Maximal 50 neue Mails pro Sync
- Nur `INBOX`
- Keine Löschung im echten Postfach
- Deduplizierung über `messageId`

Mailbox-Passwörter werden mit `MAILBOX_SETTINGS_SECRET` verschlüsselt. Wenn dieses Secret fehlt, kann alternativ `SMTP_SETTINGS_SECRET` verwendet werden. Passwörter werden nicht an den Client gesendet. Matching erfolgt primär über `fromEmail` gegen `decisionMakerEmail`. Bei Match wird der Prospect auf `responded` gesetzt und das letzte aktive Enrollment als Antwort markiert.

## Slack und ClickUp

`/admin/settings/integrations` bereitet Integrationen vor:

- Slack Incoming Webhook speichern und Testnachricht senden
- ClickUp API Token, Team ID, Space ID und List ID speichern
- ClickUp Testverbindung
- ClickUp Task aus Prospect oder Antwort erstellen über API-Vorbereitung

Secrets werden mit `INTEGRATION_SETTINGS_SECRET` verschlüsselt, alternativ mit `SMTP_SETTINGS_SECRET`. Tokens und Webhook URLs werden nie im Client angezeigt. Es gibt kein OAuth, keinen ClickUp-Massensync und keinen automatischen Import aus ClickUp in V1.

Datenschutz-Hinweis: Mailbox-Sync verarbeitet echte E-Mail-Inhalte. Tracking und Inbox-Sync sollten vor produktiver Nutzung rechtlich und organisatorisch geprüft werden.

## ROI Berechnung

Pro Kampagne können geschätzter Dealwert und Kosten pro Lead gepflegt werden. Daraus berechnet Tasklytic:

- Pipeline-Wert = gebuchte Termine × geschätzter Dealwert
- Kosten = Enrollments × Kosten pro Lead
- ROI = `(Pipeline-Wert - Kosten) / Kosten × 100`
- Kosten pro Termin
- Kosten pro Antwort

Wenn keine Kosten gepflegt sind, wird ROI als `nicht genug Daten` angezeigt.

## KI-Texterstellung

Im Kampagnenbereich kann über `E-Mail mit KI erstellen` ein deutscher Step-Entwurf für Prospect-spezifische Outreach-Mails erstellt werden. Benötigt werden:

- `OPENAI_API_KEY`
- optional `OPENAI_MODEL`, Standard: `gpt-4o-mini`

Die API-Route `POST /api/ai/generate-campaign-copy` gibt Step-Vorschläge mit Betreff, Body und Delay zurück. API Keys werden nicht an den Client gesendet und nicht geloggt. KI-Texte sollten vor Versand geprüft werden. Die Prompt-Regeln verlangen, keine Fakten zu erfinden und nur vorhandene Prospect-Daten zu verwenden.

## Landingpage Builder

Landingpages werden über Templates verwaltet:

- `/admin/landingpages`
- `/admin/landingpages/templates`
- `/admin/landingpages/templates/[id]`

Templates enthalten editierbare Bereiche für Header, Hero, persönliches Video, Erklärvideo, Vorher/Nachher-Vergleich, Ansatz, FAQ, Abschluss-CTA, Footer und Design. Der Hero ist vollständig backendseitig bearbeitbar. Prospect-spezifische Felder wie `customHeroHeadline`, `customHeroBodyText`, `personalVideoUrl`, `explainerVideoUrl`, `calendarUrl` und `customHeroCtaUrl` überschreiben Template-Werte.

Unterstützte Variablen:

- `{{vorname}}`
- `{{nachname}}`
- `{{fullName}}`
- `{{companyName}}`
- `{{city}}`
- `{{decisionMakerName}}`
- `{{decisionMakerRole}}`
- `{{landingpageUrl}}`
- `{{videoUrl}}`
- `{{calendarUrl}}`
- `{{painPoint}}`
- `{{businessField}}`
- `{{vehicleCount}}`
- `{{locationsCount}}`

CTA-Fallbacks:

1. Prospect Custom CTA URL oder Template CTA URL
2. Prospect `calendarUrl`
3. Template `defaultCtaUrl`

`/p/[slug]` nutzt das zugewiesene Template, sonst das Standardtemplate. `noindex` bleibt aktiv. KI-Unterstützung für Landingpage-Texte ist über `POST /api/ai/generate-landingpage-copy` vorbereitet; Texte sollten vor Veröffentlichung geprüft werden.

### Interne Buchungsseite

`/p/[slug]/booking` ist kein eigener Kalender. Die Seite bettet eine externe Calendly-, Tidycal- oder Custom-Buchungsseite im Tasklytic-Landingpage-Design per iframe ein. Die externe URL kommt aus `bookingUrl`, mit Fallback auf `calendarUrl`.

Wenn ein Anbieter iframe-Einbettung blockiert oder der Kalender nicht lädt, zeigt die Seite zusätzlich den Button `Termin extern öffnen`, der direkt zur externen `bookingUrl` führt. Es werden keine Termine gespeichert, keine Kalender-API integriert und keine eigene Kalenderlogik gebaut.

Im Template-Tab `Buchung` kann gesteuert werden, ob CTAs auf die interne Embed-Seite (`embedded_page`) oder direkt auf die externe Buchungsseite (`external_link`) führen.

## Asset Library

`/admin/assets` ist die zentrale Asset Library im Dark-SaaS-Stil. Enthalten:

- Verbundene Accounts
- Kampagnen-Sequenzen
- Briefvorlagen
- Videos
- Nachrichtenvorlagen
- Landingpage Vorlagen
- Bilder
- Buchungskalender

Unterseiten:

- `/admin/assets/accounts`
- `/admin/assets/sequences`
- `/admin/assets/email-templates`
- `/admin/assets/videos`
- `/admin/assets/messages`
- `/admin/assets/landingpages`
- `/admin/assets/images`
- `/admin/assets/booking`

V1 kann E-Mail-Templates, Message-Templates, Video-Assets, Image-Assets und Connected Accounts anlegen/listen. Kampagnen-Sequenzen und Booking-Assets sind als saubere V2-Platzhalter vorbereitet. Assets sind so modelliert, dass sie später in Kampagnen und Landingpages auswählbar werden.

## Lead-to-Outreach Workflow

Der zentrale Prozess liegt unter `/admin/workflows/lead-to-outreach`, der Dateiimport unter `/admin/import`.

Der Workflow ist bewusst manuell:

1. CSV/XLSX Datei hochladen
2. Mapping prüfen
3. Leads importieren
4. Importierte Leads manuell anreichern, maximal 20 pro Lauf
5. Firmenstatus prüfen und ungültige Firmen aussortieren
6. Landingpages für gültige Prospects erzeugen
7. E-Mails und Follow-ups erzeugen
8. E-Mail-Signatur prüfen
9. SMTP prüfen
10. Versand manuell starten

Es gibt keinen Cron, kein automatisches Massenscraping und keinen unkontrollierten Massenversand.

### CSV/XLSX Import

Unterstützte Formate:

- `.csv`
- `.xlsx`

Erwartete oder automatisch erkannte Spalten:

- `Name` -> `companyName`
- `Ort` -> `city`
- `PLZ` -> `postalCode`
- `Straße` / `Strasse` -> `street`
- `Tel.` / `Telefon` -> `phone`
- `E-Mail` -> `decisionMakerEmail` oder bei `info@` als `companyEmail`
- `Website` -> `websiteUrl`
- `Ges. Vertreter 1` -> `decisionMakerName`
- `Mitarbeiterzahl` -> `employeeCount`

Die Vorschau zeigt die ersten 20 Zeilen. Das Mapping kann vor dem Import manuell angepasst werden. Leere Zeilen werden übersprungen.

Duplikate werden erkannt über:

- `websiteUrl`
- `companyName` + `city`
- `decisionMakerEmail`
- `companyEmail`

Duplikate werden nicht doppelt angelegt, sondern als bestehende Prospects aktualisiert und im Import-Batch als Duplikat markiert.

### Firmenstatus und Enrichment

`companyStatus` kann `active`, `inactive`, `unclear` oder `unreachable` sein.

Beim manuellen Enrichment werden Website und Domain geprüft. HTTP 404/410 oder nicht erreichbare Domains werden als `unreachable` markiert. Hinweise wie Insolvenz, geschlossen oder nicht mehr aktiv markieren eine Firma als `inactive`. Nur `active` und `unclear` werden weiter für Landingpages und Versand berücksichtigt.

Die bestehende Enrichment-Funktion wird weiterverwendet und speichert Quellen, Confidence und Vorschläge. Enrichment startet nie automatisch nach Upload.

### Landingpages, E-Mails und Signatur

Landingpages werden nur für gültige Prospects mit `companyName` und `city` erzeugt. Fehlende Slugs werden automatisch erstellt. Neue Landingpages starten als Vorschau mit `landingpageReviewStatus = needs_review`.

Review-Status:

- `draft`: Entwurf, blockiert Versand
- `needs_review`: Vorschau erstellt und zu prüfen, blockiert Versand
- `approved`: freigegeben für Kampagnenmail und Tracking-Link

Im Lead-to-Outreach Workflow und im Kontakte-Tab der Kampagne können Vorschau, Mobile Preview und Desktop Preview geöffnet werden. Erst nach Freigabe darf eine Kampagnenmail mit Landingpage-Link erzeugt oder versendet werden.

E-Mails werden mit Bezug auf Firma, Problem/Sig­nale und Landingpage-URL erzeugt. Die Fallback-Sequenz enthält Step 1 und zwei Follow-ups. KI-Copy kann über die vorhandene OpenAI-Integration genutzt werden.

Die Firmen-Signatur wird unter `/admin/settings/email-signature` gepflegt. HTML wird serverseitig bereinigt:

- keine `script` Tags
- keine gefährlichen Event-Attribute wie `onclick`
- kein `javascript:` in Links
- nur begrenzte sichere HTML-Tags

Beim Versand wird die Signatur serverseitig an HTML und Plaintext angehängt. Fehlt eine Signatur, wird ohne Signatur versendet.

### Datei-Uploads für Assets

Der Adminbereich unterstützt lokale Uploads für Assets:

- Bilder: `/admin/assets/images`
- Logos: `/admin/assets/logos`
- Videos: `/admin/assets/videos`

Uploads werden in `AssetFile` gespeichert und lokal unter `public/uploads` abgelegt:

- Bilder: `/public/uploads/images`, URL `/uploads/images/dateiname`
- Logos: `/public/uploads/logos`, URL `/uploads/logos/dateiname`
- Videos: `/public/uploads/videos`, URL `/uploads/videos/dateiname`

Erlaubte Dateien:

- Bilder und Logos: `.png`, `.jpg`, `.jpeg`, `.webp`, maximal 5 MB
- Videos: `.mp4`, `.webm`, `.mov`, maximal 100 MB
- SVG ist in V1 deaktiviert, weil kein Sanitizer eingebunden ist

Uploads prüfen Dateiendung und MIME-Type. Dateinamen werden serverseitig eindeutig erzeugt; Originalnamen werden nicht als Pfad verwendet. HTML, Scripts und ausführbare Dateien sind nicht erlaubt.

Die Asset Library kann URLs kopieren und Dateien löschen. Gelöschte Assets entfernen den DB-Eintrag und, falls vorhanden, die lokale Datei. Im Landingpage-Builder können Header-Logos, Video-URLs und Thumbnails direkt aus der Asset Library übernommen oder neu hochgeladen werden. Unter `/admin/settings/email-signature` können Logos und Bilder als `<img>` in die HTML-Signatur eingefügt werden.

### SMTP Versand

Der Versand nutzt das bestehende SMTP-System. Versand wird blockiert, wenn SMTP nicht vollständig konfiguriert ist, wenn keine E-Mail vorhanden ist, wenn `companyStatus` `inactive` oder `unreachable` ist, wenn die Landingpage nicht `approved` ist oder wenn `info@` durch die Versandregel blockiert wird. Versand wird in `EmailSendLog` mit Open- und Click-Tracking gespeichert.

Kampagnen senden nur, wenn alle Regeln erfüllt sind:

- `manualGoApproved = true`
- `scheduledStartAt` ist erreicht
- aktuelle Zeit liegt im Versandfenster `sendWindowStart` bis `sendWindowEnd`
- `weekdaysOnly` wird berücksichtigt
- Prospect hat eine freigegebene Landingpage und eine gültige E-Mail

Der Auto-Flow darf Landingpages erstellen, E-Mail-Entwürfe generieren und Versand vorbereiten. Er sendet nicht automatisch. Versand erfolgt über „Fällige Mails senden“ und nur nach Kampagnenfreigabe plus Zeitregeln.

### Landingpage Mobile und PageSpeed

Öffentliche Landingpages unter `/p/[slug]` bleiben server-rendered und `noindex`. Mobile Regeln:

- Hero einspaltig, Video unter Text
- Navigation auf Mobile ausgeblendet
- große, klickbare CTA Buttons
- Vergleichskarten untereinander auf kleinen Viewports
- keine horizontalen Overflow-Workarounds
- Bilder mit `loading`/`decoding` Attributen
- Buchungs-Iframe lädt lazy
- keine schweren externen Libraries auf der Landingpage

## Prisma Befehle

- `npx prisma generate`
- Lokal: `npx prisma migrate dev --name init`
- Production: `npx prisma migrate deploy`

## Test und Build

- Tests ausführen: `npm test`
- Production Build ausführen: `npm run build`

## Wichtige Routen

- Admin: `/admin/prospects`
- Dashboard: `/admin`
- Kampagnen: `/admin/campaigns`
- Kontakte: `/admin/contacts`
- Einstellungen: `/admin/settings`
- Landingpage: `/p/[slug]`
- Prospect-Liste API: `/api/prospects`
- Kampagnen API: `/api/campaigns`
- Analytics: `/admin/analytics`
- Inbox: `/admin/inbox`
- Mailbox Settings API: `/api/settings/mailbox`
- Inbox Sync API: `/api/inbox/sync`
- KI Copy API: `/api/ai/generate-campaign-copy`
- Assets: `/admin/assets`
- Webhook Import: `/api/prospects/import`
- CSV Import: `/api/prospects/import/csv`
- CSV/XLSX Import Wizard: `/admin/import`
- CSV/XLSX Preview API: `/api/prospects/import/file`
- CSV/XLSX Confirm API: `/api/prospects/import/file/confirm`
- Lead Workflow: `/admin/workflows/lead-to-outreach`
- E-Mail Signatur: `/admin/settings/email-signature`
- CSV Export: `/api/prospects/export`

## Bekannte offene Punkte für V2

- Authentifizierung für den Adminbereich
- Token-geschützte Landingpages statt reinem `noindex`
- feinere Bulk-Fehlerauswertung beim CSV-Import
- Prospect-Historie und Änderungsprotokoll
