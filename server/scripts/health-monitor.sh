#!/bin/bash
# =============================================================================
# Meshlink Health Monitor
# Checks all services and alerts on failures
# Run via cron: */5 * * * * /path/to/health-monitor.sh
#
# Usage:
#   sudo ./health-monitor.sh          — check once
#   sudo ./health-monitor.sh install  — install cron job
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="/var/log/meshlink-health.log"
ALERT_FILE="/tmp/meshlink-alert-sent"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# Install cron job
if [ "${1:-}" = "install" ]; then
    CRON_CMD="*/5 * * * * $SCRIPT_DIR/health-monitor.sh >> $LOG_FILE 2>&1"
    if ! crontab -l 2>/dev/null | grep -q "health-monitor.sh"; then
        (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
        echo "Health monitor cron installed (every 5 minutes)."
    else
        echo "Health monitor cron already installed."
    fi
    exit 0
fi

ISSUES=0
DETAILS=""

# Check Docker
if ! command -v docker &>/dev/null; then
    ISSUES=$((ISSUES + 1))
    DETAILS="$DETAILS\n  - Docker not installed"
fi

# Check containers
cd "$SERVER_DIR" 2>/dev/null || { log "ERROR: Server dir not found"; exit 1; }

for SERVICE in synapse postgres nginx; do
    STATUS=$(docker compose ps --format '{{.State}}' "$SERVICE" 2>/dev/null || echo "missing")
    if [ "$STATUS" != "running" ]; then
        ISSUES=$((ISSUES + 1))
        DETAILS="$DETAILS\n  - $SERVICE: $STATUS"

        # Auto-restart failed container
        log "Auto-restarting $SERVICE..."
        docker compose up -d "$SERVICE" 2>/dev/null || true
    fi
done

# Check Synapse health endpoint
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:80/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    ISSUES=$((ISSUES + 1))
    DETAILS="$DETAILS\n  - HTTP health check failed (code: $HTTP_CODE)"
fi

# Check disk space (alert if < 10%)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 90 ]; then
    ISSUES=$((ISSUES + 1))
    DETAILS="$DETAILS\n  - Disk usage: ${DISK_USAGE}% (critical!)"
fi

# Check memory (alert if < 10% free)
MEM_FREE=$(free | awk '/Mem:/ {printf "%.0f", $7/$2 * 100}')
if [ "$MEM_FREE" -lt 10 ]; then
    ISSUES=$((ISSUES + 1))
    DETAILS="$DETAILS\n  - Memory free: ${MEM_FREE}% (critical!)"
fi

# Check CPU load
LOAD=$(cat /proc/loadavg | awk '{print $1}')
CORES=$(nproc 2>/dev/null || echo 1)
LOAD_INT=$(echo "$LOAD" | cut -d. -f1)
if [ "$LOAD_INT" -gt "$((CORES * 3))" ]; then
    ISSUES=$((ISSUES + 1))
    DETAILS="$DETAILS\n  - CPU load: $LOAD (${CORES} cores)"
fi

# Check SSL certificate expiry
if [ -f "$SERVER_DIR/nginx/ssl/meshlink.crt" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "$SERVER_DIR/nginx/ssl/meshlink.crt" 2>/dev/null | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null || echo 0)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    if [ "$DAYS_LEFT" -lt 7 ]; then
        ISSUES=$((ISSUES + 1))
        DETAILS="$DETAILS\n  - SSL cert expires in ${DAYS_LEFT} days!"
    fi
fi

# Report
if [ "$ISSUES" -gt 0 ]; then
    log "ALERT: $ISSUES issues found:$DETAILS"

    # Auto-backup on critical issues
    if [ "$ISSUES" -gt 2 ] && [ ! -f "$ALERT_FILE" ]; then
        log "Creating emergency backup..."
        bash "$SCRIPT_DIR/backup.sh" 2>/dev/null || true
        touch "$ALERT_FILE"
    fi
else
    log "OK: All services healthy. Disk: ${DISK_USAGE}%, Mem free: ${MEM_FREE}%, Load: $LOAD"
    rm -f "$ALERT_FILE" 2>/dev/null || true
fi
