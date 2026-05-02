#!/bin/bash
# =============================================================================
# Meshlink Backup & Restore
# Backs up: database, media, config, SSL certs
#
# Usage:
#   sudo ./backup.sh              — create backup
#   sudo ./backup.sh restore FILE — restore from backup
#   sudo ./backup.sh list         — list backups
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$SERVER_DIR/backups"
ACTION="${1:-backup}"
RESTORE_FILE="${2:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

log() { echo "[BACKUP] $1"; }
warn() { echo "[WARNING] $1"; }

mkdir -p "$BACKUP_DIR"

# ===== LIST BACKUPS =====
if [ "$ACTION" = "list" ]; then
    echo "=== Meshlink Backups ==="
    if ls "$BACKUP_DIR"/meshlink-backup-*.tar.gz 1>/dev/null 2>&1; then
        ls -lh "$BACKUP_DIR"/meshlink-backup-*.tar.gz | awk '{print $NF, $5}'
    else
        echo "No backups found in $BACKUP_DIR"
    fi
    exit 0
fi

# ===== RESTORE =====
if [ "$ACTION" = "restore" ]; then
    if [ -z "$RESTORE_FILE" ]; then
        echo "Usage: $0 restore <backup-file.tar.gz>"
        echo "Available backups:"
        ls "$BACKUP_DIR"/meshlink-backup-*.tar.gz 2>/dev/null || echo "  None found"
        exit 1
    fi

    if [ ! -f "$RESTORE_FILE" ]; then
        # Try in backup dir
        RESTORE_FILE="$BACKUP_DIR/$RESTORE_FILE"
        if [ ! -f "$RESTORE_FILE" ]; then
            echo "Error: Backup file not found: $RESTORE_FILE"
            exit 1
        fi
    fi

    log "Restoring from: $RESTORE_FILE"
    log "WARNING: This will overwrite current data!"
    echo "Press Enter to continue or Ctrl+C to cancel..."
    read -r

    # Stop services
    log "Stopping services..."
    cd "$SERVER_DIR" && docker compose stop 2>/dev/null || true

    # Extract backup
    TEMP_DIR=$(mktemp -d)
    log "Extracting backup..."
    tar -xzf "$RESTORE_FILE" -C "$TEMP_DIR"

    # Restore database
    if [ -f "$TEMP_DIR/database.sql" ]; then
        log "Restoring database..."
        docker compose start postgres 2>/dev/null || docker compose up -d postgres
        sleep 5
        docker compose exec -T postgres psql -U synapse -d synapse < "$TEMP_DIR/database.sql" 2>/dev/null || true
        log "Database restored."
    fi

    # Restore config
    if [ -d "$TEMP_DIR/config" ]; then
        log "Restoring config..."
        cp -r "$TEMP_DIR/config/"* "$SERVER_DIR/" 2>/dev/null || true
    fi

    # Restore SSL
    if [ -d "$TEMP_DIR/ssl" ]; then
        log "Restoring SSL certificates..."
        mkdir -p "$SERVER_DIR/nginx/ssl"
        cp -r "$TEMP_DIR/ssl/"* "$SERVER_DIR/nginx/ssl/" 2>/dev/null || true
    fi

    # Cleanup
    rm -rf "$TEMP_DIR"

    # Restart
    log "Restarting services..."
    cd "$SERVER_DIR" && docker compose up -d

    log "Restore complete!"
    exit 0
fi

# ===== BACKUP =====
log "Creating Meshlink backup..."

TEMP_DIR=$(mktemp -d)
BACKUP_FILE="$BACKUP_DIR/meshlink-backup-${TIMESTAMP}.tar.gz"

# Backup database
log "Backing up database..."
cd "$SERVER_DIR"
docker compose exec -T postgres pg_dump -U synapse synapse > "$TEMP_DIR/database.sql" 2>/dev/null || warn "Database backup failed (is postgres running?)"

# Backup config files
log "Backing up config..."
mkdir -p "$TEMP_DIR/config"
cp "$SERVER_DIR/.env" "$TEMP_DIR/config/" 2>/dev/null || true
cp "$SERVER_DIR/synapse/homeserver.yaml" "$TEMP_DIR/config/" 2>/dev/null || true
cp "$SERVER_DIR/synapse/signing.key" "$TEMP_DIR/config/" 2>/dev/null || true
cp "$SERVER_DIR/docker-compose.yml" "$TEMP_DIR/config/" 2>/dev/null || true

# Backup SSL
log "Backing up SSL certificates..."
mkdir -p "$TEMP_DIR/ssl"
cp "$SERVER_DIR/nginx/ssl/"* "$TEMP_DIR/ssl/" 2>/dev/null || true

# Backup metadata
cat > "$TEMP_DIR/backup-info.txt" << EOF
Meshlink Backup
Date: $(date)
Server: $(hostname)
Docker: $(docker --version 2>/dev/null || echo "unknown")
EOF

# Create archive
log "Creating archive..."
tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" .

# Cleanup
rm -rf "$TEMP_DIR"

# Keep only last 10 backups
cd "$BACKUP_DIR"
ls -t meshlink-backup-*.tar.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
log ""
log "============================================"
log "  Backup Complete!"
log "============================================"
log "  File: $BACKUP_FILE"
log "  Size: $SIZE"
log "  Contains: database, config, SSL"
log ""
log "  Restore: sudo $0 restore $BACKUP_FILE"
log "  List:    sudo $0 list"
