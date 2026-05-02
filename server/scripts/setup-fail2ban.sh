#!/bin/bash
# =============================================================================
# Install and configure fail2ban for Meshlink
# Auto-bans IPs that show attack patterns
# =============================================================================

set -euo pipefail

log() { echo "[FAIL2BAN] $1"; }

log "Installing fail2ban..."
apt-get update -qq && apt-get install -y -qq fail2ban

# Create Meshlink jail configuration
log "Configuring Meshlink jails..."

cat > /etc/fail2ban/jail.d/meshlink.conf << 'EOF'
# =============================================================================
# Meshlink fail2ban jails
# =============================================================================

[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 10
banaction = iptables-multiport

# --- Ban IPs that get rate-limited by Nginx (429 errors) ---
[meshlink-ratelimit]
enabled = true
port = http,https
filter = meshlink-ratelimit
logpath = /var/log/nginx/access.log
maxretry = 20
findtime = 60
bantime = 1800

# --- Ban IPs that cause too many 4xx errors (scanners) ---
[meshlink-scanner]
enabled = true
port = http,https
filter = meshlink-scanner
logpath = /var/log/nginx/access.log
maxretry = 30
findtime = 300
bantime = 3600

# --- Ban IPs that try to brute-force login ---
[meshlink-login]
enabled = true
port = http,https
filter = meshlink-login
logpath = /var/log/nginx/access.log
maxretry = 10
findtime = 300
bantime = 7200

# --- Ban IPs that flood with connections ---
[meshlink-connflood]
enabled = true
port = http,https
filter = meshlink-connflood
logpath = /var/log/nginx/error.log
maxretry = 5
findtime = 60
bantime = 3600

# --- SSH brute-force protection ---
[sshd]
enabled = true
port = ssh
maxretry = 5
findtime = 300
bantime = 3600
EOF

# Create filter for rate-limited requests (429)
cat > /etc/fail2ban/filter.d/meshlink-ratelimit.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* 429 .*$
ignoreregex =
EOF

# Create filter for scanners (404, 403, 444)
cat > /etc/fail2ban/filter.d/meshlink-scanner.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* (403|404|444) .*$
            ^<HOST> .* "(GET|POST|HEAD) /(wp-admin|wp-login|phpmyadmin|xmlrpc|\.env|\.git).*$
ignoreregex = ^<HOST> .* "(GET|POST) /_matrix.*$
              ^<HOST> .* 404 .* "\.(js|css|png|jpg|ico|svg|woff)".*$
EOF

# Create filter for login brute-force
cat > /etc/fail2ban/filter.d/meshlink-login.conf << 'EOF'
[Definition]
failregex = ^<HOST> .* "POST /_matrix/client/v3/login.* (401|403) .*$
            ^<HOST> .* "POST /_matrix/client/v3/register.* (429|403) .*$
ignoreregex =
EOF

# Create filter for connection floods
cat > /etc/fail2ban/filter.d/meshlink-connflood.conf << 'EOF'
[Definition]
failregex = limiting connections by zone.*client: <HOST>
            limiting requests.*client: <HOST>
ignoreregex =
EOF

# Restart fail2ban
log "Restarting fail2ban..."
systemctl enable fail2ban
systemctl restart fail2ban

# Show status
log "fail2ban status:"
fail2ban-client status

log ""
log "============================================"
log "  fail2ban configured for Meshlink"
log "============================================"
log ""
log "  Active jails:"
log "    - meshlink-ratelimit (429 errors → ban 30min)"
log "    - meshlink-scanner (scanners → ban 1h)"
log "    - meshlink-login (brute-force → ban 2h)"
log "    - meshlink-connflood (floods → ban 1h)"
log "    - sshd (SSH brute-force → ban 1h)"
log ""
log "  Commands:"
log "    fail2ban-client status meshlink-ratelimit"
log "    fail2ban-client set meshlink-ratelimit unbanip 1.2.3.4"
log "    fail2ban-client status"
