# Meshlink

Self-hosted, end-to-end encrypted social network built on the Matrix protocol.

## Features

- **End-to-end encryption** -- all messages encrypted by default
- **Voice and video calls** (WebRTC + TURN/STUN)
- **Group chats and channels** with topics
- **File sharing** with encrypted storage
- **Multi-platform** (Web, Windows, Linux, Android, iOS)
- **Self-hosted** -- you own your data, runs on any server

## Quick Start

### Requirements

- Ubuntu 20.04+ server with a public IP
- 2 GB RAM minimum
- 10 GB disk space
- Ports: 80, 3478, 5349, 49152-49172

### Installation

```bash
git clone https://github.com/micleberry556-eng/SET121.git
cd SET121/server
chmod +x scripts/setup.sh
sudo ./scripts/setup.sh
```

The setup script will:
1. Install Docker (if not present)
2. Ask for your server IP, admin credentials, and settings
3. Build the Meshlink UI
4. Start all services
5. Create the first admin user

After setup:
- **Meshlink**: `http://YOUR_IP`
- **Admin panel**: `http://YOUR_IP/admin`
- **Config panel**: `http://YOUR_IP/config`

## Platform Installation

### Windows
Download and run `Meshlink-Install.bat` from `http://YOUR_IP/installers/Meshlink-Install.bat`

### Linux
```bash
curl -O http://YOUR_IP/installers/meshlink-install.sh
chmod +x meshlink-install.sh
./meshlink-install.sh
```

### Android
Open `http://YOUR_IP` in Chrome > menu > "Install app"

### iOS
Open `http://YOUR_IP` in Safari > Share > "Add to Home Screen"

### Desktop (Electron)
```bash
npm install
npm run electron:build:all
```

## Server Management

### Update
```bash
sudo ./server/scripts/update.sh
```

### Backup / Migrate
```bash
sudo ./server/scripts/migrate.sh backup
sudo ./server/scripts/migrate.sh restore <backup-file>
```

### Logs
```bash
cd server && docker compose logs -f
```

## Configuration

All settings are in `server/.env`. Edit and restart:
```bash
cd server && docker compose restart
```

Or use the web config panel at `http://YOUR_IP/config`.

## Security

- All messages are end-to-end encrypted by default
- No phone number or email required for registration
- TURN server uses shared-secret authentication
- Rate limiting on login/registration endpoints
- Admin API requires authentication

## Development

```bash
npm install
npm run dev    # Start dev server
npm test       # Run tests
npm run build  # Production build
```

## License

Meshlink is proprietary software. All rights reserved.
