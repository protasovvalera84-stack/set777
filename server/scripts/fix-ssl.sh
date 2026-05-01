#!/bin/bash
# =============================================================================
# Fix SSL certificate for Meshlink
# Run this if browsers show "dangerous site" warning
#
# Usage: sudo ./fix-ssl.sh [your-domain.com]
# Without domain: tries nip.io
# With domain: uses your custom domain (recommended)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$SERVER_DIR/nginx/ssl"
ENV_FILE="$SERVER_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE not found. Run setup.sh first."
    exit 1
fi

source "$ENV_FILE"

CUSTOM_DOMAIN="${1:-}"

echo "============================================"
echo "  Meshlink SSL Certificate Fix"
echo "============================================"
echo ""

# Install certbot
if ! command -v certbot &>/dev/null; then
    echo "Installing certbot..."
    apt-get update -qq && apt-get install -y -qq certbot
fi

# Determine domain
if [ -n "$CUSTOM_DOMAIN" ]; then
    DOMAIN="$CUSTOM_DOMAIN"
    echo "Using custom domain: $DOMAIN"
    echo ""
    echo "IMPORTANT: Make sure DNS A record points to this server IP ($SERVER_HOST)"
    echo "Press Enter to continue or Ctrl+C to cancel..."
    read -r
else
    DOMAIN=$(echo "$SERVER_HOST" | tr '.' '-').nip.io
    echo "Using nip.io domain: $DOMAIN"
fi

echo ""
echo "Step 1: Stopping nginx..."
cd "$SERVER_DIR"
docker compose stop nginx 2>/dev/null || true
sleep 2

echo "Step 2: Requesting Let's Encrypt certificate..."
echo ""

# Try standalone mode first (most reliable)
certbot certonly --standalone \
    --non-interactive --agree-tos \
    --register-unsafely-without-email \
    -d "$DOMAIN" \
    --preferred-challenges http \
    --force-renewal \
    2>&1

if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo ""
    echo "Step 3: Installing certificate..."
    mkdir -p "$SSL_DIR"
    cp "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" "$SSL_DIR/meshlink.crt"
    cp "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" "$SSL_DIR/meshlink.key"
    chmod 644 "$SSL_DIR/meshlink.crt"
    chmod 600 "$SSL_DIR/meshlink.key"

    echo "Step 4: Restarting nginx..."
    docker compose start nginx 2>/dev/null || docker compose up -d --no-deps nginx

    # Setup auto-renewal
    RENEW_CMD="0 4 * * * certbot renew --quiet --deploy-hook 'cp /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ${SSL_DIR}/meshlink.crt && cp /etc/letsencrypt/live/${DOMAIN}/privkey.pem ${SSL_DIR}/meshlink.key && cd ${SERVER_DIR} && docker compose restart nginx' >> /var/log/meshlink-certbot.log 2>&1"
    if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
        (crontab -l 2>/dev/null; echo "$RENEW_CMD") | crontab -
        echo "Auto-renewal cron installed."
    fi

    # Update .env with new domain if custom
    if [ -n "$CUSTOM_DOMAIN" ]; then
        sed -i "s/^SERVER_HOST=.*/SERVER_HOST=$CUSTOM_DOMAIN/" "$ENV_FILE"
        echo ""
        echo "Updated SERVER_HOST to $CUSTOM_DOMAIN in .env"
        echo "You may need to rebuild: cd $SERVER_DIR && docker compose restart"
    fi

    echo ""
    echo "============================================"
    echo "  SSL Certificate Installed Successfully!"
    echo "============================================"
    echo ""
    echo "  URL: https://$DOMAIN"
    echo "  Certificate: Let's Encrypt (trusted by all browsers)"
    echo "  Auto-renewal: Every day at 4:00 AM"
    echo ""
    echo "  No more browser warnings!"
    echo ""
else
    echo ""
    echo "============================================"
    echo "  Certificate request FAILED"
    echo "============================================"
    echo ""
    echo "Possible reasons:"
    echo "  1. Port 80 is blocked by firewall"
    echo "  2. DNS doesn't point to this server"
    echo "  3. Let's Encrypt rate limit reached"
    echo ""
    echo "Solutions:"
    echo "  1. Open port 80: ufw allow 80/tcp"
    echo "  2. Open port 443: ufw allow 443/tcp"
    echo "  3. Use a real domain: sudo $0 your-domain.com"
    echo "  4. Wait 1 hour and try again (rate limit)"
    echo ""

    # Restart nginx with existing cert
    docker compose start nginx 2>/dev/null || docker compose up -d --no-deps nginx
fi
