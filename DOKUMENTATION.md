# FDIM — Forget / Fuck Doing It Manually
## Umfassende Technische Dokumentation & Administrator-Handbuch
*Version 2.4 — Enterprise Edition für Windows Active Directory-Umgebungen*

---

## 📑 Inhaltsverzeichnis

1. [Executive Summary & Produktübersicht](#1-executive-summary--produktübersicht)
2. [Architektur & Technologie-Stack](#2-architektur--technologie-stack)
3. [Installation & Betriebsmodi](#3-installation--betriebsmodi)
   - 3.1 Docker Compose mit Nginx & SSL (Produktionsempfehlung)
   - 3.2 Standalone Docker Container
   - 3.3 Lokaler Bare-Metal Betrieb (Node.js & tsx)
   - 3.4 Umgebungsvariablen & Konfigurationsparameter
   - 3.5 SSL/TLS-Zertifikate & Intranet-Betrieb
4. [Stammdaten & Mandantenkonfiguration](#4-stammdaten--mandantenkonfiguration)
   - 4.1 Kunden- & Mandantenprofile (Multi-Tenancy)
   - 4.2 System Configuration Switches & OS-Härtung
   - 4.3 Software-Katalog (UNC-Shares & Winget)
   - 4.4 First-Run Snippets Bibliothek & User-Logon Staging
   - 4.5 Active Directory, LDAP & Single Sign-On (Keycloak)
5. [Die 4 Bereitstellungs- & Ausführungsmethoden](#5-die-4-bereitstellungs--ausführungsmethoden)
   - 5.1 Methode 1: Central Server Runner (Agentless Remote WinRM)
   - 5.2 Methode 2: Live Provisioning Cockpit (Echtzeit-Web-Terminal)
   - 5.3 Methode 3: Autonomer Client Agent & Offline Wait-Queue
   - 5.4 Methode 4: Standalone Master PowerShell Skript
6. [Echtzeit-Monitoring & Log-Streaming-Engine](#6-echtzeit-monitoring--log-streaming-engine)
   - 6.1 Server-Sent Events (SSE) Architektur
   - 6.2 Adaptives Long-Polling Fallback
   - 6.3 Ring-Buffer-Speicher & Terminal-Darstellung
7. [Paketverwaltung, Silent-Installer & Sandbox](#7-paketverwaltung-silent-installer--sandbox)
   - 7.1 Silent-Switch Matrix für Enterprise-Installer
   - 7.2 Das WinGet Session-0 / SYSTEM Problem (-196608 / 0xFFFD0000)
   - 7.3 Microsoft Outlook Classic via Office Deployment Tool (ODT)
   - 7.4 Proxmox VE Sandbox & Automatischer Snapshot-Rollback
   - 7.5 AI Silent Switch Detective (Google Gemini 2.5)
8. [First-Logon Staging & Active Setup](#8-first-logon-staging--active-setup)
   - 8.1 Active Setup Architektur (`HKLM:\SOFTWARE\Microsoft\Active Setup`)
   - 8.2 Maschinenseitige vs. Benutzerspezifische Drucker (`printui.dll /ga`)
   - 8.3 Persistente Netzlaufwerke & Umgebungsvariablen (`%USERNAME%`)
9. [Fehlerbehebung, Diagnose & Exit-Codes](#9-fehlerbehebung-diagnose--exit-codes)
   - 9.1 Exit-Code Referenztabelle
   - 9.2 WinRM Fehler & TrustedHosts
   - 9.3 Berechtigungen & SMB/UNC Zugriff
   - 9.4 SQLite Wartung & Backup
10. [Vollständige REST-API Dokumentation](#10-vollständige-rest-api-dokumentation)
11. [Sicherheitskonzept & Audit-Zertifikate](#11-sicherheitskonzept--audit-zertifikate)

---

## 1. Executive Summary & Produktübersicht

**FDIM** (**Fuck Doing It Manually** / **Forget Doing It Manually**) ist eine vollautomatisierte Provisionierungs- und Software-Deployment-Plattform für IT-Systemadministratoren, Managed Service Provider (MSPs) und Helpdesk-Teams. 

### Der Problemraum in der klassischen IT-Administration
In herkömmlichen Unternehmensnetzwerken erfolgt die Bereitstellung neuer oder reinstallierter Windows 10/11-Clients häufig über manuelle Checklisten:
- Der Rechner wird der Domäne hinzugefügt.
- Ein lokaler Administrator wird manuell mit wechselnden Kennwörtern angelegt.
- RDP wird per GUI aktiviert.
- Ein Dutzend Standardprogramme (7-Zip, Browser, VLC, PDF-Reader, ERP-Clients) werden nacheinander per Hand installiert und bestätigt.
- Netzlaufwerke und Drucker müssen manuell im Profil des jeweiligen Endanwenders konfiguriert werden, sobald dieser sich das erste Mal anmeldet.
- Der temporäre Setup-Benutzer (`install` oder `admin`), der während des Windows OOBE-Setups eingerichtet wurde, verbleibt als Sicherheitsrisiko ungelöscht auf dem System.

### Die FDIM-Lösung
FDIM transformiert diesen fehleranfälligen, zeitraubenden Prozess in einen hochgradig standardisierten, reproduzierbaren **Zero-Touch-Workflow**:
1. **Zentrale Steuerung**: Alle Systemkonfigurationen, Mandantenprofile, Netzwerkfreigaben und Softwarepakete werden über eine zentrale Web-Oberfläche verwaltet.
2. **Dual-Acronym Engine (SFW & Uncensored)**: Jeder Administrator kann individuell wählen, ob das interne humorvolle IT-Akronym (*Fuck Doing It Manually*) oder die kunden- und revisionssichere Formulierung (*Forget Doing It Manually*) in Titelleisten, Berichten und Zertifikaten angezeigt wird.
3. **4 flexible Ausführungswege**: Vom interaktiven Web-Terminal über autonome Hintergrund-Agenten und agentloses WinRM bis hin zum autarken USB-Powershell-Skript.
4. **Active Setup First-Logon Staging**: Überwindung der Schranke zwischen maschinenweiter Installation (SYSTEM) und benutzerspezifischer Umgebung (Kerberos-Token des Mitarbeiters) für Netzlaufwerke, Drucker und Outlook-Signaturen.
5. **Revisionssichere Audit-Zertifikate**: Nach Abschluss jeder Bereitstellung generiert FDIM ein kryptografisch gekennzeichnetes Übergabezertifikat mit Hardwaredaten, Paketstatus und Konfigurations-Hashes.

---

## 2. Architektur & Technologie-Stack

FDIM ist als modulare, leichtgewichtige Full-Stack-Webapplikation konzipiert, die ohne schwerfällige externe Datenbankserver (wie SQL Server oder Oracle) auskommt.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT BROWSER (UI)                             │
│       React 19 • TypeScript • Tailwind CSS v4 • Lucide Icons • Motion       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Primäre Navigation: [PC Setup] [AD Computers] [Live Runner] [Menu ▾]   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│         ┌────────────────────────────┴────────────────────────────┐         │
│         ▼                                                         ▼         │
│  ┌───────────────────────────────┐      ┌────────────────────────────────┐  │
│  │ Betrieb & Überwachung         │      │ Konfiguration & Kataloge       │  │
│  │ • Quick Software Deploy       │      │ • Mandanten- & Firmenprofile   │  │
│  │ • Client-Agent & Warteschlange│      │ • First-Run Snippets Bibliothek│  │
│  │ • Bereitstellungshistorie     │      │ • Software-Katalog (UNC/Winget)│  │
│  │ • Live-Terminal-Monitor (SSE) │      │ • AI Silent Switch Detective   │  │
│  └───────────────────────────────┘      └────────────────────────────────┘  │
│                                      │                                      │
│                Browser LocalStorage Draft-Cache (300ms Debounce)            │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / JSON REST APIs / SSE EventStream
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        BACKEND: Node.js 22 & Express 4                      │
│                              (server.ts / tsx)                              │
│                                                                             │
│  • Mandanten-Store (Multi-Tenant)   • First-Run Logon Snippets Library      │
│  • Dynamic System Switches Engine   • PowerShell Script Generator Engine    │
│  • Autonomer Client Agent Dispatch  • WinRM Server-Runner Daemon (Remote)   │
│  • Bereitstellungshistorie & Logs   • Google Gemini AI Installer Analyse    │
│  • AD / LDAP Authentifizierungs-Hub • Native SQLite Engine (node:sqlite)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Dateizugriff / WAL-Modus
                                       ▼
                     ┌───────────────────────────────────┐
                     │   SQLite Datenbank (/app/data)    │
                     │  - customers    - queued_tasks    │
                     │  - packages     - ad_computers    │
                     │  - switches     - deployments     │
                     │  - snippets     - settings/users  │
                     └───────────────────────────────────┘
```

### Komponenten im Detail

| Schicht | Technologie | Zweck & Implementierung |
| :--- | :--- | :--- |
| **Frontend UI** | React 19, Vite, Tailwind CSS v4 | Moderne, reaktive Benutzeroberfläche mit Dark-Mode-Optik, flüssigen Animationen und sofortiger Validierung. |
| **State Persistence** | Browser `localStorage` (300ms) | Automatisches Speichern aller Eingaben im Assistenten. Kein Datenverlust bei Tab-Wechseln oder Browser-Reloads. |
| **Backend-Server** | Node.js v22 (LTS), Express 4, tsx | Typisierter TypeScript-Server für REST-Routen, PowerShell-Skript-Synthese, SSE-Streaming und AD/LDAP-Abfragen. |
| **Datenhaltung** | `node:sqlite` (SQLite 3 integriert) | Integrierter Node.js 22 SQLite-Treiber (`DatabaseSync`). Benötigt keine nativen C++-Kompilierungen (`node-gyp`) und speichert alle Daten in einer einzigen Datei mit WAL-Journaling. |
| **Echtzeit-Pipes** | Server-Sent Events (SSE) & Long-Polling | Unidirektionales Streaming von Konsolenausgaben und Remote-Agenten-Logs direkt in die Weboberfläche. |
| **KI-Engine** | `@google/genai` (Gemini 2.5 Flash) | Optionale Analyse von Installer-Dateien zur Ermittlung von Silent-Switches und Erkennung von blockierenden Dialogboxen. |
| **PowerShell Target** | PowerShell 5.1 & PowerShell 7+ | Kompatibel mit Windows 10/11 Pro & Enterprise sowie Windows Server 2016-2025. |

---

## 3. Installation & Betriebsmodi

### 3.1 Docker Compose mit Nginx & SSL (Produktionsempfehlung)

Die empfohlene Bereitstellungsform für Rechenzentren, IT-Verwaltungs-VMs und MSP-Infrastrukturen ist der Multi-Container-Stack via **Docker Compose**.

#### Vorteile der Docker-Bereitstellung
- **Keine Host-Abhängigkeiten**: Node.js, npm und Build-Tools müssen nicht auf dem Host-Betriebssystem installiert sein.
- **Integrierter Nginx Reverse Proxy**: Behandelt SSL/TLS-Terminierung (HTTPS Port 443), leitet Port 80 automatisch um und setzt HTTP-Security-Header.
- **Ungepuffertes Terminal-Streaming**: Spezielle Konfiguration (`proxy_buffering off;`) garantiert verzögerungsfreies SSE/WebSocket-Streaming für das Live-Terminal.
- **Persistente Datenbindung**: Das Verzeichnis `./data` auf dem Host wird direkt in den Container gemountet (`/app/data`). Updates und Neustarts löschen keine Datenbankdaten.

#### Schnellstart in 3 Schritten

1. **SSL-Zertifikat vorbereiten**:
   Für Intranet- oder Testumgebungen generiert das Hilfsskript ein 2048-Bit RSA-Zertifikat:
   ```bash
   chmod +x docker/generate-ssl.sh
   ./docker/generate-ssl.sh
   ```
   *(Für Produktionsumgebungen kopieren Sie Ihre gültigen `cert.pem` und `key.pem` direkt nach `./docker/nginx/ssl/`)*.

2. **Umgebungskonfiguration anlegen**:
   ```bash
   cp .env.example .env
   ```
   Passen Sie die Werte in `.env` an:
   ```env
   PORT=3000
   NODE_ENV=production
   # Optional: Google Gemini API-Schlüssel für die KI-Installer-Erkennung
   GEMINI_API_KEY=AIzaSy...
   ```

3. **Container-Stack starten**:
   ```bash
   docker compose up -d --build
   ```
   Die Weboberfläche ist anschließend über `https://<server-ip-oder-hostname>` erreichbar.

---

### 3.2 Standalone Docker Container

Falls bereits ein übergeordneter Reverse-Proxy (z. B. Traefik, Caddy, HAProxy, Cloudflare Tunnel oder Microsoft IIS) existiert:

```bash
# 1. Production Docker-Image erstellen
docker build -t fdim-deploy:latest .

# 2. Container mit Datenbindung starten
docker run -d \
  --name fdim-suite \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  fdim-deploy:latest
```

---

### 3.3 Lokaler Bare-Metal Betrieb (Node.js & tsx)

Für Entwicklungszwecke oder IT-Umgebungen auf Windows Server ohne Docker:

1. **Voraussetzungen**: Node.js v20.0.0+ (empfohlen v22 LTS), npm v9+.
2. **Repository klonen & Abhängigkeiten installieren**:
   ```bash
   git clone https://github.com/dbiendara/FDIM---Fuck-Doing-It-Manually.git
   cd FDIM---Fuck-Doing-It-Manually
   npm install
   ```
3. **Entwicklungsmodus starten**:
   ```bash
   npm run dev
   ```
4. **Produktions-Build erstellen und starten**:
   ```bash
   npm run build
   npm run start
   ```

---

### 3.4 Umgebungsvariablen & Konfigurationsparameter

Die Konfiguration wird über Umgebungsvariablen gesteuert:

| Variable | Standardwert | Beschreibung |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port, auf dem der Node.js Express Backend-Server lauscht. |
| `NODE_ENV` | `development` | Betriebsumgebung (`production` aktiviert optimierte Builds und Sicherheitsrichtlinien). |
| `GEMINI_API_KEY` | *(leer)* | Google Gemini API-Schlüssel. Wenn nicht gesetzt oder ungültig, wird das Menü „AI Installer Detective“ vollständig ausgeblendet und die App läuft 100% lokal ohne Cloud-Abhängigkeiten. |
| `GEMINI_ENABLED` | `true` | Kann auf `false` gesetzt werden, um KI-Funktionen explizit systemweit zu deaktivieren. |
| `DISABLE_GEMINI` | `false` | Alternative Flag zur vollständigen Unterdrückung von Gemini-Modulen. |

---

### 3.5 SSL/TLS-Zertifikate & Intranet-Betrieb

Der integrierte Nginx-Container (`docker/nginx/nginx.conf`) ist für moderne kryptografische Standards gehärtet:
- **TLS-Protokolle**: TLSv1.2 und TLSv1.3.
- **Header**: `Strict-Transport-Security`, `X-Frame-Options SAMEORIGIN`, `X-Content-Type-Options nosniff`.
- **Upload-Limit**: `client_max_body_size 50M;` zur Unterstützung des Uploads von Installer-Konfigurationsdateien (z. B. `.tvopt` oder XML-Skripte).
- **Streaming-Pufferung**: `proxy_buffering off;` und `proxy_cache off;` für Pfade unter `/api/agent/live-logs/stream` und `/api/deployments/live/`.

---

## 4. Stammdaten & Mandantenkonfiguration

### 4.1 Kunden- & Mandantenprofile (Multi-Tenancy)
Über **Menu ▾ > Configuration & Libraries > Company Profiles** verwalten Sie Mandantenprofile. Jedes Profil definiert:
- **Unternehmensname & Kunden-Kürzel**: Zur Strukturierung von Logs und Ablagen.
- **Active Directory Domäne**: NetBIOS- oder FQDN-Name (z. B. `acme.corp` oder `CORP`).
- **Delegierte AD-Administratorgruppe**: Die Sicherheitsgruppe (z. B. `CORP\IT-WorkstationAdmins`), die automatisch in die lokale Gruppe `Administratoren` aufgenommen werden soll.
- **Primäres UNC-Software-Repository**: Netzwerkpfad (z. B. `\\fs01.acme.corp\software$\deploy`), auf dem MSI- und EXE-Dateien bereitliegen.
- **Standard-Softwarepakete**: Eine Liste von Programmen, die im Bereitstellungs-Assistenten für diesen Kunden standardmäßig vorausgewählt sind.
- **Standard-Netzlaufwerke & Drucker**: Unternehmensspezifische Freigaben, die jedem Arbeitsplatzrechner zugeordnet werden.
- **Standard First-Run Snippets**: Zuordnung von vordefinierten Benutzeranmeldeskripten (z. B. Signatur-Templates, Edge-Startseite).

---

### 4.2 System Configuration Switches & OS-Härtung
Über **System Switches** können grundlegende Betriebssystemeinstellungen definiert werden. Jeder Schalter besteht aus Metadaten, Parametern und einem idempotent geschriebenen PowerShell-Codeblock:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   FDIM System-Härtungs-Schalter                        │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Lokaler Administrator Account (SID S-1-5-21-*-500)                  │
│    - Ermittelt den Built-in Admin unabhängig von der Windows-Sprache   │
│    - Aktiviert das Konto (Enable-LocalUser)                            │
│    - Setzt kryptografisches Kennwort & PasswordNeverExpires = $true    │
├────────────────────────────────────────────────────────────────────────┤
│ 2. OOBE Setup-Account Bereinigung ("install", "setup", "temp")         │
│    - Sucht temporäre Konten aus der Windows OOBE-Erstinstallation      │
│    - Löscht Konto via Remove-LocalUser                                 │
│    - Bereinigt Benutzerprofil aus WMI (Win32_UserProfile) & C:\Users  │
│    - Safe RunOnce Fallback, falls der Runner im aktiven Kontext läuft  │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Remote Desktop (RDP) & Network Level Authentication (NLA)           │
│    - Setzt fDenyTSConnections = 0                                      │
│    - Erzwingt UserAuthentication = 1 (NLA)                             │
│    - Aktiviert Windows Firewall-Regeln für RemoteDesktop               │
├────────────────────────────────────────────────────────────────────────┤
│ 4. Delegierte AD-Admin-Gruppen zuweisen                                │
│    - Prüft Domänen-Erreichbarkeit vor Gruppen-Auflösung                │
│    - Add-LocalGroupMember -Group 'Administrators' -Member 'DOMAIN\...' │
├────────────────────────────────────────────────────────────────────────┤
│ 5. Power Management (powercfg)                                         │
│    - Standardisiert AC-Bildschirm- und Standby-Timeouts                │
│    - Verhindert ungewolltes Einschlafen während Wartungsfenstern       │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 4.3 Software-Katalog (UNC-Shares & Winget)
Der Software-Katalog (**Software Catalog**) unterstützt zwei Quellen:
1. **Lokale UNC/SMB Netzwerkfreigaben**: Für unternehmenseigene, lizenzierte oder proprietäre Software (z. B. `\\server\share\Installer.msi`).
2. **Microsoft Windows Package Manager (Winget)**: Für standardisierte Standard-Software direkt aus den offiziellen Microsoft-Repositories (z. B. 7-Zip, Google Chrome, Adobe Acrobat Reader DC).

#### Unterstützte Installer-Typen und Standard-Argumente

| Typ | Standard Silent-Argumente | Besonderheiten |
| :--- | :--- | :--- |
| **MSI** | `/qn /norestart ALLUSERS=1` | Unterstützt Public Properties wie `ASSIGNMENTOPTIONS=...` oder `APITOKEN=...`. |
| **Inno Setup** | `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-` | Unterdrückt alle Dialoge und Assistentenfenster. |
| **NSIS** | `/S` | Case-Sensitive: Großes `/S` ist zwingend erforderlich. |
| **WiX** | `/quiet /norestart` | Microsoft WiX Toolset Standardflags. |
| **Winget** | `install --id "<ID>" --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity --scope machine` | Durch den FDIM-Fix mit voller Session-0-Kompatibilität. |
| **ODT (Office)** | `/configure configuration-outlook.xml` | Microsoft Click-to-Run Setup für Outlook Classic. |
| **TeamViewer** | `/qn IMPORTREGFILE=1` | Automatischer Import von `.tvopt` Einstellungsdateien vor der Installation. |

---

### 4.4 First-Run Snippets Bibliothek & User-Logon Staging
Da Betriebssystem-Installationen im Kontext von `NT AUTHORITY\SYSTEM` oder des lokalen Administrators laufen, können sie keine benutzerspezifischen Einstellungen (`HKCU`, benutzerspezifische Netzlaufwerke, benutzereigene Drucker) vornehmen.

Die **First-Run Snippets Bibliothek** löst dieses fundamentale Problem:
- Skripte werden in der zentralen Bibliothek (**First-Run Snippets**) verwaltet und kategorisiert (*Outlook & Mail*, *Browser & Web*, *Shortcuts & Desktop*, *OneDrive & Cloud*, *Security & Policies*, *Custom*).
- Die Skripte werden vom Bereitstellungs-Assistenten zusammengefasst und als autarkes Skript nach `C:\ProgramData\FDIM\UserLogonSetup.ps1` geschrieben.
- Registrierung über **Active Setup** (`HKLM:\SOFTWARE\Microsoft\Active Setup\Installed Components\FDIM_UserProvisioning`).
- Beim allerersten Anmelden eines beliebigen Benutzers führt die Windows-Shell das Skript im Sicherheitskontext des Benutzers mit dessen Kerberos-Ticket transparent aus.

---

### 4.5 Active Directory, LDAP & Single Sign-On (Keycloak)
FDIM unterstützt drei Authentifizierungsmodi (**Settings > Authentication & Directory**):
1. **Lokale Datenbankkonten**: Standardmäßig für Systembetreuer mit lokalen Passwörtern (PBKDF2/SHA256 Hash).
2. **Active Directory / LDAPS**: Direkte Anbindung an Windows Domain Controller über Port 389 (LDAP) oder 636 (LDAPS) mit konfigurierbarem Base-DN, Bind-Service-Account und automatischer Gruppenvalidierung.
3. **Keycloak / OpenID Connect (OIDC)**: Integration in moderne Enterprise SSO-Infrastrukturen mit JWT-Token-Validierung.

---

## 5. Die 4 Bereitstellungs- & Ausführungsmethoden

FDIM bietet vier unterschiedliche Ausführungspfade, um jeden betrieblichen Anwendungsfall optimal abzudecken:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DIE 4 AUSFÜHRUNGSWEGE IN FDIM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Central Server Runner   │ Zero-Agent Remote-WinRM Ausführung             │
│    (Zentraler Server-Dienst│ - Kein Agent auf dem Client erforderlich       │
│     über WinRM 5985/5986)  │ - Server pollt Aufgaben & führt PowerShell aus │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 2. Live Provisioning       │ Interaktives Web-Terminal für Techniker        │
│    Cockpit                 │ - Echtzeit-Streaming per SSE in den Browser    │
│    (Interaktive Konsole)   │ - Schritt-für-Schritt Status & Fehlerkontrolle │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 3. Autonomer Client Agent  │ Lokaler Windows Task für Offline-Rechner       │
│    (Windows Scheduled Task │ - Läuft unter NT AUTHORITY\SYSTEM              │
│     mit Heartbeat)         │ - Führt Wait-Tasks bei Systemstart autonom aus │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 4. Standalone Master Skript│ Autarke .ps1 Datei für manuelle Ausführung     │
│    (Offline / USB / Turnkey│ - Unabhängig von Serververbindung              │
│     PowerShell-Datei)      │ - Vollständiges Logging nach C:\ProgramData   │
└────────────────────────────┴────────────────────────────────────────────────┘
```

---

### 5.1 Methode 1: Central Server Runner (Agentless Remote WinRM)

Der **Central Server Runner** ermöglicht die vollständig agentenlose Bereitstellung über das Netzwerk mittels PowerShell Remoting (WinRM):
- Ein Hintergrund-Dienst pollt die FDIM-Warteschlange (`POST /api/server-runner/poll`).
- Sobald ein Task vorliegt, beansprucht der Runner den Task (`POST /api/server-runner/tasks/:id/claim`).
- Der Runner baut eine WinRM-Sitzung zum Ziel-PC auf:
  ```powershell
  Invoke-Command -ComputerName $TargetPC -Credential $Credential -ScriptBlock { ... }
  ```
- Konsolenzeilen werden in Echtzeit als Streaming-Logs an den Server zurückgemeldet.
- **UTF-8 Encoding Fix**: Um Umlautprobleme und Zeichenfehler in Windows-Konsolenausgaben zu verhindern, erzwingt der Runner:
  ```powershell
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  ```

#### Installation des Server Runner Host-Dienstes
Auf dem zentralen IT-Verwaltungsserver (oder Domain Controller) kann der Runner als nativer Windows-Dienst installiert werden:
```powershell
irm http://<fdim-server>:3000/api/server-runner/installer | iex
```

---

### 5.2 Methode 2: Live Provisioning Cockpit (Echtzeit-Web-Terminal)

Das **Live Provisioning Cockpit** ist das interaktive Terminal für Techniker vor Ort oder am Leitstand:
- Ermöglicht das Verfolgen einzelner Installationsschritte (Vorbereitung, Switches, Softwarepakete, Finalisierung).
- Zeigt verstrichene Zeit, aktuellen Schritt-Status (Ausstehend, Läuft, Erfolgreich, Warnung, Fehler) und Ausführungszeiten.
- Protokolliert alle `stdout` und `stderr` Meldungen in einem integrierten ANSI-kompatiblen Web-Terminal.
- Nach erfolgreichem Durchlauf kann sofort das **Revisionssichere Übergabezertifikat** erzeugt und gedruckt werden.

---

### 5.3 Methode 3: Autonomer Client Agent & Offline Wait-Queue

Der **FDIM Client Agent** ist speziell für Laptops und Clients konzipiert, die während der Auftragserteilung ausgeschaltet oder unterwegs sind:
- **Unsichtbare Windows Aufgabe**: Wird als geplante Aufgabe `FDIM-ClientAgent` unter dem lokalen Systemkonto (`NT AUTHORITY\SYSTEM`) eingerichtet.
- **Boot-Verzögerung**: Startet automatisch 3–5 Minuten nach dem Systemstart (stellt sicher, dass Netzwerkadapter, DHCP-Leases und DNS-Dienste vollständig initialisiert sind).
- **Zyklischer Heartbeat**: Meldet sich alle 15, 30 oder 60 Minuten per REST-API (`POST /api/agent/heartbeat`) mit Hardware- und Status-Informationen (OS-Version, aktive Benutzer, Uptime, installierte Pakete).
- **Offline Wait-Queue**: Wenn ein Techniker Software für einen ausgeschalteten PC bereitstellt, wird der Task in der Warteschlange (`queued_tasks`) zwischengespeichert. Sobald der PC hochfährt und seinen Heartbeat sendet, erhält er die Aufgabe, führt sie autonom aus und meldet das Ergebnis zurück.

#### 1-Liner Installation des Agenten:
```powershell
irm http://<fdim-server>:3000/api/agent/script/installer | iex
```

---

### 5.4 Methode 4: Standalone Master PowerShell Skript

Für isolierte Netzwerke (Air-Gapped), USB-Stick-Installationen oder manuelle Ausführung erzeugt der Assistent ein vollständig autarkes PowerShell-Skript:
- Enthält die Direktive `#Requires -RunAsAdministrator`.
- Prüft die Domänen-Erreichbarkeit und Netzwerkfreigaben vor Beginn.
- Erstellt ein lokales Transkript unter `C:\ProgramData\FDIM\Logs\Provisioning_<Computername>_<Datum>.log`.
- Behandelt Fehler mit sauberen Exit-Codes und führt ein automatisches Rollback durch, falls erforderliche Abhängigkeiten fehlen.

Aufruf auf dem Ziel-Client:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Deploy-Workstation.ps1
```

---

## 6. Echtzeit-Monitoring & Log-Streaming-Engine

Um die Ausführung von Silent-Installationen auf entfernten Rechnern in Sekundenschnelle transparent zu machen, besitzt FDIM eine integrierte Streaming-Engine:

```
┌─────────────────┐       POST /api/agent/logs        ┌───────────────────────┐
│ Ziel-PC / Agent │ ────────────────────────────────> │ FDIM Backend Server   │
│ (PowerShell)    │   Payload: [machine, line, level] │ (In-Memory RingBuffer)│
└─────────────────┘                                   └──────────┬────────────┘
                                                                 │
                                    ┌────────────────────────────┴────────────────────────────┐
                                    │ SSE: /api/agent/live-logs/stream                        │ Long-Polling Fallback
                                    ▼                                                         ▼
                      ┌───────────────────────────────┐                         ┌───────────────────────────────┐
                      │ Browser Terminal (SSE Client) │                         │ Browser Terminal (Polling)    │
                      └───────────────────────────────┘                         └───────────────────────────────┘
```

### 6.1 Server-Sent Events (SSE) Architektur
- Der Endpunkt `GET /api/agent/live-logs/stream` hält eine persistente HTTP-Verbindung mit dem MIME-Typ `text/event-stream`.
- Jeder eingehende Log-Eintrag von entfernten Agenten oder dem Server-Runner wird sofort als formatiertes JSON-Event an alle verbundenen Web-Clients übertragen.
- Automatische Reconnect-Logik im Frontend verhindert Verbindungsverluste bei Netzwerkunterbrechungen.

### 6.2 Adaptives Long-Polling Fallback
Für Umgebungen mit restriktiven Firewalls oder Proxies, die persistente HTTP-Streams blockieren, schaltet die UI automatisch auf Long-Polling um:
- Endpunkt: `GET /api/agent/live-logs?poll=true&cursor=<ID>&limit=100`.
- Der Server antwortet erst, wenn neue Logs vorliegen oder ein Timeout von 15 Sekunden erreicht ist.

### 6.3 Log-Level & Farbcodierung
Das Terminal formatiert Ausgaben automatisch nach Schweregrad:
- `[INFO]` (Weiß/Grau): Reguläre Statusmeldungen und Fortschrittsschritte.
- `[SUCCESS]` (Grün): Erfolgreich abgeschlossene Installationen und verifizierte Erkennungsregeln.
- `[WARN]` (Gelb): Nicht-kritische Hinweise (z. B. empfohlener Neustart mit Exit-Code 3010).
- `[ERROR]` (Rot): Fehlgeschlagene Prozesse, Netzwerk-Timeouts oder ungültige Exit-Codes.
- `[PROGRESS]` (Cyan): Prozentuale Download- und Entpack-Fortschritte.
- `[SYSTEM]` (Blau/Lila): Interne Runner-Signale und Heartbeat-Ereignisse.

---

## 7. Paketverwaltung, Silent-Installer & Sandbox

### 7.1 Silent-Switch Matrix für Enterprise-Installer

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         ENTERPRISE INSTALLER MATRIX                              │
├───────────────────┬───────────────────────────────────────────┬──────────────────┤
│ Format / Engine   │ Empfohlene Silent-Argumente               │ Exit-Codes       │
├───────────────────┼───────────────────────────────────────────┼──────────────────┤
│ MSI (Windows Inst)│ /qn /norestart ALLUSERS=1                 │ 0 (OK), 3010 (Re)│
│ Inno Setup        │ /VERYSILENT /SUPPRESSMSGBOXES /NORESTART  │ 0 (OK)           │
│ NSIS (Nullsoft)   │ /S                                        │ 0 (OK)           │
│ WiX Toolset       │ /quiet /norestart                         │ 0 (OK), 3010 (Re)│
│ Winget Package    │ install --id "ID" --exact --silent ...    │ 0 (OK)           │
│ ODT Office C2R    │ /configure configuration-outlook.xml      │ 0 (OK)           │
│ InstallShield     │ /s /v"/qn /norestart"                     │ 0 (OK)           │
└───────────────────┴───────────────────────────────────────────┴──────────────────┘
```

---

### 7.2 Das WinGet Session-0 / SYSTEM Problem (-196608 / 0xFFFD0000)

#### Ursachenanalyse
Wenn der FDIM-Agent als Windows Scheduled Task unter `NT AUTHORITY\SYSTEM` läuft, befindet sich der Prozess in **Session 0** (der isolierten Nicht-Interaktiven Sitzung für Hintergrunddienste).

Wird in diesem Kontext der Standard-Befehl `winget install ...` aufgerufen, bricht die Ausführung reproduzierbar mit dem Fehlercode **`-196608`** (Hexadezimal **`0xFFFD0000`**) ab.
- **Der Grund**: Der Standardbefehl `winget` ruft einen AppX-Ausführungsalias (`%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe`) auf. Für das Dienstkonto `NT AUTHORITY\SYSTEM` existiert jedoch kein Benutzerprofil mit installierten AppX-Paketen. Der Trampoline-Loader stürzt beim Versuch ab, den Windows Store Desktop App Installer aufzurufen.

#### Die FDIM-Lösung
FDIM generiert für alle Winget-Aufrufe automatisch einen abgesicherten Wrapper-Block in PowerShell:
1. **Direkte Pfadauflösung**: Das Skript umgeht den AppX-Alias und sucht direkt nach der nativen 64-Bit Binärdatei im Systemverzeichnis:
   ```powershell
   $wingetBinary = (Resolve-Path "$env:ProgramFiles\WindowsApps\Microsoft.DesktopAppInstaller_*_*__8wekyb3d8bbwe\winget.exe" -ErrorAction SilentlyContinue | Select-Object -Last 1).Path
   if (-not $wingetBinary -or -not (Test-Path $wingetBinary)) {
       $wingetBinary = "winget.exe"
   }
   ```
2. **Erzwingen des Maschinen-Kontexts**: An jeden Aufruf wird zwingend das Argument `--scope machine` angehängt.
3. **Vollständige Befehlszeile**:
   ```powershell
   & $wingetBinary install --id "VideoLAN.VLC" --exact --silent --accept-package-agreements --accept-source-agreements --disable-interactivity --scope machine
   ```
Damit laufen Winget-Installationen auch unter dem SYSTEM-Account und über WinRM fehlerfrei durch.

---

### 7.3 Microsoft Outlook Classic via Office Deployment Tool (ODT)

Microsoft stellt über das moderne Microsoft 365 / Winget-Repository standardmäßig nur das neue, Webview-basierte "New Outlook" bereit. In Enterprise-Domänen mit COM-Add-ins, DATEV, CRM-Integrationen oder Exchange On-Premises ist jedoch zwingend das **klassische Outlook** erforderlich.

FDIM enthält hierfür das Spezialpaket `pkg-outlook-classic`:
- Nutzt das offizielle **Office Deployment Tool (ODT)**.
- Erzeugt on-the-fly eine `configuration-outlook.xml`:
  ```xml
  <Configuration>
    <Add OfficeClientEdition="64" Channel="Current">
      <Product ID="O365ProPlusRetail">
        <Language ID="MatchOS" />
        <ExcludeApp ID="Access" />
        <ExcludeApp ID="Excel" />
        <ExcludeApp ID="Groove" />
        <ExcludeApp ID="Lync" />
        <ExcludeApp ID="OneDrive" />
        <ExcludeApp ID="OneNote" />
        <ExcludeApp ID="PowerPoint" />
        <ExcludeApp ID="Publisher" />
        <ExcludeApp ID="Teams" />
        <ExcludeApp ID="Word" />
      </Product>
    </Add>
    <Display Level="None" AcceptEULA="TRUE" />
    <Property Name="AUTOACTIVATE" Value="1" />
  </Configuration>
  ```
- Führt `setup.exe /configure configuration-outlook.xml` silent aus und installiert ausschließlich die vollwertige Desktop-Version von Outlook Classic.

---

### 7.4 Proxmox VE Sandbox & Automatischer Snapshot-Rollback
Für neue oder ungetestete Installer-Pakete bietet FDIM eine direkte Schnittstelle zu **Proxmox VE**:
1. FDIM startet eine Test-VM basierend auf einem Windows 10/11 Gold-Master-Image über die Proxmox REST-API.
2. Das Paket wird mit den konfigurierten Parametern auf der Test-VM ausgeführt.
3. FDIM überwacht Laufzeit, Exit-Code und verifiziert die Erkennungsregeln (Registry oder Dateisystem).
4. Unmittelbar nach Abschluss wird die VM über den Snapshot `clean-baseline` wieder in den Ursprungszustand zurückversetzt.

---

### 7.5 AI Silent Switch Detective (Google Gemini 2.5)
Ist in `.env` ein gültiger `GEMINI_API_KEY` hinterlegt, steht im Menü der **AI Silent Switch Detective** zur Verfügung:
- Ermittelt anhand von Dateinamen, Hersteller-Strings und PE-Header-Hinweisen den genauen Installer-Typ (z. B. InstallShield vs. Inno Setup).
- Schlägt exakte Silent-Argumente und Protokollierungs-Flags vor.
- Warnt vor potenziell blockierenden Benutzerdialogen oder automatischen Neustarts.
- *Hinweis: Ist kein API-Schlüssel konfiguriert, wird der Menüpunkt automatisch ausgeblendet; die Kernfunktionen von FDIM bleiben zu 100% lokal funktionsfähig.*

---

## 8. First-Logon Staging & Active Setup

### 8.1 Active Setup Architektur
Windows **Active Setup** ist ein nativer Mechanismus des Windows Explorer-Subsystems:
- Registrierungsschlüssel:
  `HKLM:\SOFTWARE\Microsoft\Active Setup\Installed Components\<GUID oder Name>`
- Eigenschaften:
  - `StubPath`: Auszuführender Befehl (z. B. `powershell.exe -WindowStyle Hidden -File C:\ProgramData\FDIM\UserLogonSetup.ps1`).
  - `Version`: Versionsstring (z. B. `1,0,0`).
- **Funktionsweise**: Wenn sich ein Benutzer an Windows anmeldet, prüft die Shell, ob der Schlüssel in `HKCU:\Software\Microsoft\Active Setup\Installed Components\` mit der gleichen Version existiert. Fehlt der Schlüssel, führt Windows den `StubPath` im Sicherheitskontext des neu angemeldeten Benutzers aus und markiert die Version als verarbeitet.

### 8.2 Maschinenseitige vs. Benutzerspezifische Drucker
- **Maschinenseitige Bereitstellung (Empfohlen)**:
  Wird während der Hauptprovisionierung ausgeführt:
  ```powershell
  rundll32 printui.dll,PrintUIEntry /ga /n"\\printserver.corp\Zentraldrucker"
  ```
  Der Schalter `/ga` (Global Add) bindet den Drucker auf Kernelebene ein, sodass er für jeden aktuellen und künftigen Benutzer ohne Anmeldeskripte sofort verfügbar ist.
- **Benutzerspezifische Standarddrucker**:
  Werden über `UserLogonSetup.ps1` bei der Erstanmeldung per WScript-Network COM-Objekt zugewiesen:
  ```powershell
  (New-Object -ComObject WScript.Network).SetDefaultPrinter('\\printserver.corp\Zentraldrucker')
  ```

### 8.3 Persistente Netzlaufwerke & `%USERNAME%`
Das Anmeldeskript unterstützt die dynamische Auflösung benutzerspezifischer Pfade:
```powershell
net use S: "\\fs01.corp\Abteilung" /persistent:yes
net use H: "\\fs01.corp\Home\$env:USERNAME" /persistent:yes
```

---

## 9. Fehlerbehebung, Diagnose & Exit-Codes

### 9.1 Exit-Code Referenztabelle

| Exit Code | Hexadezimal | Bedeutung | Empfohlene Maßnahme |
| :--- | :--- | :--- | :--- |
| `0` | `0x00000000` | Erfolgreich abgeschlossen. | Keine Maßnahme erforderlich. |
| `3010` | `0x00000BC2` | Installation erfolgreich, Systemneustart erforderlich. | FDIM markiert den Schritt als erfolgreich; Neustart einplanen. |
| `1603` | `0x00000643` | Schwerwiegender MSI-Installationsfehler. | MSI-Logfile unter `C:\ProgramData\FDIM\Logs\` auf fehlende Abhängigkeiten prüfen. |
| `1619` | `0x00000653` | Installationspaket konnte nicht geöffnet werden. | UNC-Pfad und NTFS/SMB-Berechtigungen auf Freigabe prüfen. |
| `-196608` | `0xFFFD0000` | WinGet Session-0 AppX Trampoline Crash. | Sicherstellen, dass die native Binary `$env:ProgramFiles\WindowsApps\...` genutzt wird. |
| `5` | `0x00000005` | Zugriff verweigert (Access Denied). | Ausführungskontext prüfen; Elevation (`#Requires -RunAsAdministrator`) erzwingen. |
| `1602` | `0x00000642` | Benutzerabbruch / Interaktiver Prompt blockiert. | Silent-Switches prüfen (`/qn` bzw. `/VERYSILENT` ergänzen). |

---

### 9.2 WinRM Fehler & TrustedHosts
Tritt beim Verbindungsaufbau über den Central Server Runner ein WinRM-Fehler auf:
1. **WinRM auf dem Ziel-PC aktivieren**:
   ```powershell
   Enable-PSRemoting -Force -SkipNetworkProfileCheck
   ```
2. **TrustedHosts in Nicht-Domänen- oder Test-Umgebungen**:
   ```powershell
   Set-Item WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
   ```
3. **Firewall-Regel für Port 5985 (HTTP) / 5986 (HTTPS) prüfen**:
   ```powershell
   Get-NetFirewallRule -Name "WINRM-HTTP-In-TCP*" | Enable-NetFirewallRule
   ```

---

### 9.3 Berechtigungen & SMB/UNC Zugriff
Läuft ein Deployment unter `NT AUTHORITY\SYSTEM`, greift der Rechner über sein **Active Directory Computerkonto** (`DOMAIN\COMPUTERNAME$`) auf das Netzwerk zu.
- **Wichtig**: Auf der UNC-Freigabe (`\\server\software$`) muss entweder die Gruppe `Domänen-Computer` (Domain Computers) oder `Authentifizierte Benutzer` (Authenticated Users) Leserechte besitzen.

---

### 9.4 SQLite Wartung & Backup
Die SQLite-Datenbank liegt im Container unter `/app/data/fdim.sqlite` (auf dem Host unter `./data/`).
- **Online-Backup ohne Betriebsunterbrechung**:
  ```bash
  tar -czvf fdim-backup-$(date +%F).tar.gz ./data
  ```
- **Integritätsprüfung**:
  ```bash
  sqlite3 data/fdim.sqlite "PRAGMA integrity_check;"
  ```

---

## 10. Vollständige REST-API Dokumentation

Alle Endpunkte liefern und akzeptieren JSON (`Content-Type: application/json`).

### 📦 Software-Pakete (`/api/packages`)
- `GET /api/packages`: Gibt alle registrierten Softwarepakete zurück.
- `POST /api/packages`: Registriert ein neues Softwarepaket.
  - *Payload*: `SoftwarePackage` Objekt (Name, Version, uncPath, silentArgs, installerType, etc.).
- `PUT /api/packages/:id`: Aktualisiert ein bestehendes Paket.
- `DELETE /api/packages/:id`: Löscht ein Paket aus dem Katalog.
- `POST /api/packages/:id/sandbox-test`: Initiiert einen Proxmox VE Sandbox-Testlauf.

### 🏢 Kunden- & Mandantenprofile (`/api/profiles` / `/api/customers`)
- `GET /api/profiles`: Liste aller Kundenprofile.
- `GET /api/profiles/:id`: Detaildaten eines Profils inklusive Standardsoftware und Netzlaufwerke.
- `POST /api/profiles`: Erstellt ein neues Mandantenprofil.
- `PUT /api/profiles/:id`: Aktualisiert ein Mandantenprofil.
- `DELETE /api/profiles/:id`: Entfernt ein Profil mit Sicherheitsvalidierung gegen verwaiste Referenzen.

### ⚙️ System Configuration Switches (`/api/system-switches`)
- `GET /api/system-switches`: Liste aller Systemhärtungs-Schalter.
- `POST /api/system-switches`: Erstellt einen neuen Konfigurationsschalter mit PowerShell-Snippet.
- `PUT /api/system-switches/:id`: Aktualisiert Status, Parameter oder Skriptcode eines Schalters.

### 📜 First-Run Snippets (`/api/snippets`)
- `GET /api/snippets`: Liste aller Benutzeranmelde-Skripte mit Kategorien und Tags.
- `POST /api/snippets`: Erstellt ein neues Snippet.
- `PUT /api/snippets/:id`: Bearbeitet ein bestehendes Snippet.
- `DELETE /api/snippets/:id`: Löscht ein Snippet.
- `POST /api/snippets/reset-defaults`: Setzt alle Vorlagen auf den Auslieferungsstandard zurück.

### 🖥️ Active Directory Computer & Inventar (`/api/ad-computers`)
- `GET /api/ad-computers`: Gibt alle inventarisierten AD-Arbeitsplatzrechner zurück.
- `POST /api/ad-computers/sync`: Startet einen LDAP-Synchronisationslauf gegen den konfigurierten Domain Controller.
- `POST /api/ad-computers/ping`: Führt einen ICMP/WinRM Erreichbarkeitstest für angegebene Hostnamen durch.
- `POST /api/ad-computers/bulk-import`: Importiert Rechnerlisten per CSV oder Hostnamensliste.
- `POST /api/ad-computers/deploy-agent`: Verteilt den Client-Agenten remote via WMI/WinRM auf Ziel-PCs.

### 🤖 Autonomer Client Agent & Warteschlange (`/api/agent`)
- `POST /api/agent/heartbeat`: Empfängt Statusdaten (OS, Uptime, User, IP) von installierten Agenten.
  - *Response*: Enthält anstehende Aufgaben (`pendingTasks`) für diesen spezifischen Rechner.
- `GET /api/agent/tasks`: Fragt die aktuelle Aufgabenwarteschlange ab.
- `POST /api/agent/tasks`: Stellt eine neue Installationsaufgabe für einen Offline-Rechner in die Warteschlange.
- `POST /api/agent/tasks/:id/report`: Empfängt den Abschlussbericht eines Tasks inklusive Exit-Code und Log.
- `GET /api/agent/script/installer`: Liefert das dynamische PowerShell 1-Liner Installationsskript für den Agenten.

### 📡 Server Runner (WinRM Daemon) (`/api/server-runner`)
- `GET /api/server-runner/status`: Status des zentralen Remoting-Daemons.
- `POST /api/server-runner/poll`: Abfrage anstehender Remote-Aufträge.
- `POST /api/server-runner/tasks/:id/claim`: Beansprucht einen Task zur exklusiven Bearbeitung.
- `GET /api/server-runner/script`: Liefert das PowerShell-Steuerungsskript für den WinRM-Dienst.

### 🔴 Echtzeit-Logs & Streaming (`/api/agent/live-logs`)
- `GET /api/agent/live-logs/stream`: **Server-Sent Events (SSE)** Stream für Live-Konsolenausgaben.
- `GET /api/agent/live-logs`: REST-Endpunkt mit adaptivem Long-Polling (`?poll=true`).
- `POST /api/agent/logs`: Nimmt Logzeilen von PowerShell-Skripten und Agenten entgegen.
- `POST /api/agent/live-logs/clear`: Bereinigt den flüchtigen Terminal-Puffer.

### ⚡ Skript-Synthese & Ausführung (`/api/scripts`)
- `POST /api/scripts/generate`: Synthetisiert das komplette Master-PowerShell-Bereitstellungsskript basierend auf gewählten Switches, Paketen und Snippets.
- `POST /api/scripts/generate-quick`: Erzeugt ein fokussiertes Silent-Installationsskript für Schnellrollouts.

### 🤖 AI Installer Detective (`/api/ai`)
- `GET /api/ai/status`: Prüft Verfügbarkeit und Initialisierungsstatus der Gemini API.
- `POST /api/ai/detect-switches`: Analysiert Installer-Metadaten und liefert strukturierte Silent-Parameter.

---

## 11. Sicherheitskonzept & Audit-Zertifikate

### 11.1 Keine hartcodierten Anmeldedaten
- Alle generierten PowerShell-Skripte nutzen ausschließlich die Sicherheitskontexte des ausführenden Technikers oder des lokalen Systemkontos (`NT AUTHORITY\SYSTEM`).
- Kennwörter für lokale Administratoren werden bei der Generierung verschlüsselt oder dynamisch als SecureString übergeben.

### 11.2 Netztrennung & Freigabeüberprüfung
- Skripte testen vor Beginn die Erreichbarkeit des Domain Controllers (`Test-Connection`) und die Zugreifbarkeit der UNC-Freigaben (`Test-Path`).
- Bricht ein Schritt ab, wird kein unvollständiges System hinterlassen; Fehler werden mit Transkript gesichert.

### 11.3 Revisionssichere Audit-Zertifikate
Nach jeder erfolgreichen Bereitstellung dokumentiert FDIM das Ergebnis:
- **Metadaten**: Hostname, IP-Adresse, MAC-Adresse, Windows Build-Version, ausführender Techniker.
- **Konfigurations-Nachweis**: Liste aller aktivierten Systemsicherheits-Schalter und angewendeten GPO-Admin-Gruppen.
- **Software-Inventur**: Exakte Liste aller installierten Softwarepakete inklusive Version und Verifizierungs-Exit-Code.
- **Kryptografische Signatur**: Eindeutiger SHA256-Prüfsummen-Hash über den gesamten Transkript-Inhalt.
- **Druck & PDF-Export**: Direktes Drucken oder Archivieren als Übergabeprotokoll für Kunden oder interne Compliance-Prüfungen (z. B. ISO 27001, BSI IT-Grundschutz).

---

*FDIM — Forget / Fuck Doing It Manually | Enterprise Workstation Automation Platform*
