#!/bin/bash
# Meshlink SSL Auto-Renewal — renews Let's Encrypt certificates.
# Run via cron: 0 4 * * 1 /path/to/ssl-renew.sh
# Checks if cert expires within 30 days, renews if needed.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$SERVER_DIR/logs/ssl-renew.log"

mkdir -p "$SERVER_DIR/logs"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] SSL: $1" | tee -a "$LOG_FILE"; }

# Get domain from .env
source "$SERVER_DIR/.env" 2>/dev/null
SERVER_HOST="${SERVER_HOST:-72.56.244.207}"
NIP_DOMAIN=$(echo "$SERVER_HOST" | tr '.' '-').nip.io

log "Checking SSL certificate for $NIP_DOMAIN..."

# Check if cert exists and when it expires
CERT_FILE="/etc/letsencrypt/live/$NIP_DOMAIN/fullchain.pem"
if [ -f "$CERT_FILE" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s 2>/dev/null)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    log "Certificate expires in $DAYS_LEFT days ($EXPIRY)"

    if [ "$DAYS_LEFT" -gt 30 ]; then
        log "Certificate still valid. No renewal needed."
        exit 0
    fi
    log "Certificate expiring soon. Renewing..."
else
    log "No certificate found. Requesting new one..."
fi

# Stop nginx temporarily for standalone renewal
cd "$SERVER_DIR"
docker compose stop nginx 2>/dev/null
sleep 2

# Renew certificate
certbot renew --standalone --non-interactive 2>&1 | tee -a "$LOG_FILE"
RESULT=$?

# Restart nginx
docker compose start nginx 2>/dev/null

if [ $RESULT -eq 0 ]; then
    log "SSL renewal successful."
    # Reload nginx to pick up new cert
    docker compose exec -T nginx nginx -s reload 2>/dev/null
else
    log "SSL renewal failed (exit code $RESULT)."
fi
