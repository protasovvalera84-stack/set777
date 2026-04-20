# Meshlink

Decentralized, self-hosted, end-to-end encrypted messenger.

## Architecture

Meshlink is built on the [Matrix](https://matrix.org/) protocol, providing:

- **End-to-end encryption** (Olm/Megolm, based on Signal Protocol)
- **Voice and video calls** (WebRTC + TURN/STUN)
- **Group chats and channels** with topics
- **File sharing** with encrypted storage
- **Federation** (optional, connect to other Matrix servers)
- **Multi-platform** (Web, Windows, Linux, Android, iOS)

### Components

| Service | Description | Image |
|---------|-------------|-------|
| **Synapse** | Matrix homeserver | `matrixdotorg/synapse` |
| **Element Web** | Web chat client | `vectorim/element-web` |
| **PostgreSQL** | Database | `postgres:16-alpine` |
| **Coturn** | TURN/STUN for calls | `coturn/coturn` |
| **Nginx** | Reverse proxy | `nginx:alpine` |
| **Synapse Admin** | User/room management | `awesometechnologies/synapse-admin` |
| **Admin API** | Server config panel | Custom (Node.js) |

## Quick Start

### Requirements

- Ubuntu 20.04+ server with a public IP
- 2 GB RAM minimum (1 GB for ~10 users)
- 10 GB disk space
- Ports: 80 (HTTP), 3478 (TURN), 5349 (TURN TLS), 49152-49172 (TURN relay)

### Installation

```bash
# Clone the repository
git clone https://github.com/micleberry556-eng/SET121.git
cd SET121/server

# Run the setup script (installs Docker, configures everything)
chmod +x scripts/setup.sh
sudo ./scripts/setup.sh
```

The setup script will:
1. Install Docker and Docker Compose (if not present)
2. Ask for your server IP, admin credentials, and settings
3. Generate secure secrets
4. Start all services
5. Create the first admin user

After setup, you'll see:
- **Web client**: `http://YOUR_IP` (Element Web)
- **Admin panel**: `http://YOUR_IP/admin` (Synapse Admin)
- **Config panel**: `http://YOUR_IP/config` (Server settings)

## Platform Installation

### Windows
Download and run `Meshlink-Install.bat` from `http://YOUR_IP/installers/Meshlink-Install.bat`.
Creates a desktop shortcut that opens Meshlink in your browser.

### Linux
```bash
curl -O http://YOUR_IP/installers/meshlink-install.sh
chmod +x meshlink-install.sh
./meshlink-install.sh
```

### Android
Open `http://YOUR_IP` in Chrome, tap menu (three dots) > "Install app" or "Add to Home screen".

### iOS
Open `http://YOUR_IP` in Safari, tap Share > "Add to Home Screen".

### Desktop (Electron)
```bash
npm install
npm run electron:build:all
```
Builds native apps for Windows (.exe) and Linux (.AppImage, .deb).

## Server Management

### Update all services
```bash
sudo ./server/scripts/update.sh
```

### Backup for migration
```bash
# Create backup
sudo ./server/scripts/migrate.sh backup

# Restore on new server
sudo ./server/scripts/migrate.sh restore meshlink-backup-YYYYMMDD-HHMMSS.tar.gz
```

### Regenerate installers (after changing server IP)
```bash
sudo ./server/scripts/generate-installers.sh
```

### View logs
```bash
cd server && docker compose logs -f
```

### Restart services
```bash
cd server && docker compose restart
```

## Configuration

All settings are in `server/.env`. Key parameters:

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_HOST` | Server IP or domain | Auto-detected |
| `HTTP_PORT` | HTTP port | `80` |
| `ENABLE_REGISTRATION` | Allow new signups | `true` |
| `ELEMENT_BRAND` | Brand name in UI | `Meshlink` |

After changing `.env`, restart services:
```bash
cd server && docker compose restart
```

Or use the web config panel at `http://YOUR_IP/config`.

## Migration to Another Server

1. On the old server: `sudo ./server/scripts/migrate.sh backup`
2. Copy the `.tar.gz` file to the new server
3. Clone this repo on the new server
4. Run: `sudo ./server/scripts/migrate.sh restore <backup-file>`
5. The script auto-detects the new IP and updates all configs

## Adding a Domain Name

1. Point your domain DNS to the server IP
2. Edit `server/.env`: set `SERVER_HOST=yourdomain.com`
3. Update configs: `sudo ./server/scripts/setup.sh` (re-run)
4. Add SSL with Let's Encrypt (recommended)

## Security

- All messages are end-to-end encrypted by default
- Passwords are hashed server-side (bcrypt)
- TURN server uses shared-secret authentication
- Admin API requires authentication
- Rate limiting on login/registration endpoints

## Development

```bash
# Frontend (Meshlink landing page)
npm install
npm run dev

# Run tests
npm test
```

## License

See individual component licenses:
- Synapse: Apache 2.0
- Element Web: Apache 2.0
- Coturn: BSD
