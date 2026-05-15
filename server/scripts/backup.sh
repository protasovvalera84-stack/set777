#!/bin/bash
# Meshlink Backup System — automated PostgreSQL + media backups.
# Run via cron: 0 */6 * * * /path/to/backup.sh
#
# Creates: timestamped backup in /backups/
# Keeps: last 7 days of backups
# Restores: ./backup.sh restore <timestamp>

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$SERVER_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="$SERVER_DIR/logs/backup.log"

mkdir -p "$BACKUP_DIR" "$SERVER_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] BACKUP: $1" | tee -a "$LOG_FILE"; }

# ===== RESTORE MODE =====
if [ "$1" = "restore" ]; then
    RESTORE_TS="${2:?Usage: $0 restore <timestamp>}"
    RESTORE_DIR="$BACKUP_DIR/$RESTORE_TS"

    if [ ! -d "$RESTORE_DIR" ]; then
        echo "Backup not found: $RESTORE_DIR"
        echo "Available backups:"
        ls -1 "$BACKUP_DIR/" 2>/dev/null || echo "  (none)"
        exit 1
    fi

    log "Restoring from $RESTORE_TS..."

    cd "$SERVER_DIR"

    # Stop Synapse (keep postgres running)
    docker compose stop synapse 2>/dev/null

    # Restore database
    if [ -f "$RESTORE_DIR/database.sql.gz" ]; then
        log "Restoring PostgreSQL..."
        gunzip -c "$RESTORE_DIR/database.sql.gz" | docker compose exec -T postgres psql -U synapse -d synapse 2>/dev/null
        log "Database restored."
    fi

    # Restore media
    if [ -f "$RESTORE_DIR/media.tar.gz" ]; then
        log "Restoring media..."
        docker run --rm -v server_synapse_data:/data -v "$RESTORE_DIR":/backup alpine sh -c \
            "cd /data && tar xzf /backup/media.tar.gz 2>/dev/null; chown -R 991:991 /data"
        log "Media restored."
    fi

    # Restore config
    if [ -f "$RESTORE_DIR/env.backup" ]; then
        cp "$RESTORE_DIR/env.backup" "$SERVER_DIR/.env"
        log "Config restored."
    fi

    # Start Synapse
    docker compose start synapse
    log "Restore complete from $RESTORE_TS"
    exit 0
fi

# ===== BACKUP MODE =====
CURRENT_BACKUP="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$CURRENT_BACKUP"

log "Starting backup to $CURRENT_BACKUP..."

cd "$SERVER_DIR"

# 1. Backup PostgreSQL
log "Backing up PostgreSQL..."
docker compose exec -T postgres pg_dump -U synapse synapse 2>/dev/null | gzip > "$CURRENT_BACKUP/database.sql.gz"
DB_SIZE=$(du -h "$CURRENT_BACKUP/database.sql.gz" | cut -f1)
log "Database: $DB_SIZE"

# 2. Backup media files
log "Backing up media..."
docker run --rm -v server_synapse_data:/data -v "$CURRENT_BACKUP":/backup alpine sh -c \
    "cd /data && tar czf /backup/media.tar.gz media_store 2>/dev/null || true"
if [ -f "$CURRENT_BACKUP/media.tar.gz" ]; then
    MEDIA_SIZE=$(du -h "$CURRENT_BACKUP/media.tar.gz" | cut -f1)
    log "Media: $MEDIA_SIZE"
else
    log "Media: no files to backup"
fi

# 3. Backup config
cp "$SERVER_DIR/.env" "$CURRENT_BACKUP/env.backup" 2>/dev/null || true
cp "$SERVER_DIR/synapse/homeserver.yaml" "$CURRENT_BACKUP/homeserver.yaml.backup" 2>/dev/null || true
log "Config backed up."

# 4. Write backup info
cat > "$CURRENT_BACKUP/info.txt" << EOF
Meshlink Backup
Timestamp: $TIMESTAMP
Date: $(date)
Database: $DB_SIZE
Server: $(hostname)
EOF

# 5. Cleanup old backups (keep 7 days)
log "Cleaning old backups..."
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
BACKUP_COUNT=$(ls -1d "$BACKUP_DIR"/20* 2>/dev/null | wc -l)
log "Backup complete. Total backups: $BACKUP_COUNT"

# 6. Summary
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Total backup storage: $TOTAL_SIZE"
log "Restore with: $0 restore $TIMESTAMP"
