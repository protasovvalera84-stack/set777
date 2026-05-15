#!/bin/bash
# Meshlink Watchdog — monitors all services and auto-restarts on failure.
# Run via cron every minute: * * * * * /path/to/watchdog.sh
#
# Checks: Synapse, PostgreSQL, Nginx, disk, memory.
# Auto-fixes: restart containers, fix permissions, clean disk.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$SERVER_DIR/logs/watchdog.log"
ALERT_FILE="$SERVER_DIR/logs/alerts.log"

mkdir -p "$SERVER_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
alert() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $1" >> "$ALERT_FILE"; log "ALERT: $1"; }

cd "$SERVER_DIR" || exit 1

# ===== 1. Check Synapse =====
SYNAPSE_OK=false
if docker compose exec -T synapse python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8008/health')" 2>/dev/null; then
    SYNAPSE_OK=true
fi

if [ "$SYNAPSE_OK" = "false" ]; then
    alert "Synapse is DOWN — attempting restart"

    # Fix permissions first
    docker run --rm -v server_synapse_data:/data alpine sh -c \
        "mkdir -p /data/media_store /data/uploads /data/log && chown -R 991:991 /data && chmod -R 755 /data" 2>/dev/null

    docker compose restart synapse 2>/dev/null
    sleep 30

    # Check again
    if docker compose exec -T synapse python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8008/health')" 2>/dev/null; then
        log "Synapse recovered after restart"
    else
        alert "Synapse FAILED to recover — check logs: docker compose logs synapse"
    fi
else
    log "Synapse: OK"
fi

# ===== 2. Check PostgreSQL =====
if docker compose exec -T postgres pg_isready -U synapse 2>/dev/null; then
    log "PostgreSQL: OK"
else
    alert "PostgreSQL is DOWN — restarting"
    docker compose restart postgres 2>/dev/null
    sleep 10
    if docker compose exec -T postgres pg_isready -U synapse 2>/dev/null; then
        log "PostgreSQL recovered"
        # Restart Synapse too (needs DB)
        docker compose restart synapse 2>/dev/null
    else
        alert "PostgreSQL FAILED to recover"
    fi
fi

# ===== 3. Check Nginx =====
if curl -sf http://localhost/health >/dev/null 2>&1; then
    log "Nginx: OK"
else
    alert "Nginx is DOWN — restarting"
    docker compose restart nginx 2>/dev/null
    sleep 5
    if curl -sf http://localhost/health >/dev/null 2>&1; then
        log "Nginx recovered"
    else
        alert "Nginx FAILED to recover"
    fi
fi

# ===== 4. Check Disk Space =====
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
    alert "Disk usage CRITICAL: ${DISK_USAGE}%"
    # Clean Docker
    docker system prune -f --volumes 2>/dev/null
    # Clean old logs
    find "$SERVER_DIR/logs" -name "*.log" -mtime +7 -delete 2>/dev/null
    # Clean Synapse media cache (older than 30 days)
    docker compose exec -T synapse python3 -c "
import urllib.request, json
req = urllib.request.Request('http://localhost:8008/_synapse/admin/v1/purge_media_cache?before_ts=$(date -d '30 days ago' +%s)000', method='POST')
urllib.request.urlopen(req)
" 2>/dev/null || true
    log "Disk cleanup performed"
elif [ "$DISK_USAGE" -gt 80 ]; then
    alert "Disk usage WARNING: ${DISK_USAGE}%"
else
    log "Disk: ${DISK_USAGE}% used"
fi

# ===== 5. Check Memory =====
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ "$MEM_USAGE" -gt 90 ]; then
    alert "Memory CRITICAL: ${MEM_USAGE}%"
    # Restart Synapse (biggest memory user)
    docker compose restart synapse 2>/dev/null
elif [ "$MEM_USAGE" -gt 80 ]; then
    alert "Memory WARNING: ${MEM_USAGE}%"
else
    log "Memory: ${MEM_USAGE}% used"
fi

# ===== 6. Check Container Status =====
for svc in synapse postgres nginx synapse-admin; do
    STATUS=$(docker compose ps "$svc" --format "{{.Status}}" 2>/dev/null | head -1)
    if echo "$STATUS" | grep -qi "restarting\|exited\|dead"; then
        alert "Container $svc is $STATUS — restarting"
        if [ "$svc" = "synapse" ]; then
            # Fix permissions before restarting Synapse
            docker run --rm -v server_synapse_data:/data alpine sh -c \
                "mkdir -p /data/media_store /data/uploads && chown -R 991:991 /data" 2>/dev/null
        fi
        docker compose restart "$svc" 2>/dev/null
    fi
done

# ===== 7. Rotate watchdog log =====
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 10485760 ]; then
    mv "$LOG_FILE" "$LOG_FILE.old"
    log "Log rotated"
fi
