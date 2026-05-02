#!/bin/bash
# =============================================================================
# Meshlink Firewall & Anti-DDoS Rules (iptables)
# SAFE FOR DOCKER — never touches FORWARD/DOCKER chains
#
# Usage: sudo ./firewall.sh [enable|disable|status]
# =============================================================================

set -euo pipefail

ACTION="${1:-enable}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[FIREWALL]${NC} $1"; }

if [ "$ACTION" = "disable" ]; then
    log "Disabling firewall rules..."
    # ONLY flush INPUT — never touch FORWARD, nat, or DOCKER chains
    iptables -F INPUT 2>/dev/null || true
    iptables -P INPUT ACCEPT
    log "Firewall disabled. Docker networking preserved."
    exit 0
fi

if [ "$ACTION" = "status" ]; then
    echo "=== INPUT chain rules ==="
    iptables -L INPUT -n -v --line-numbers 2>/dev/null
    echo ""
    echo "=== Active connections ==="
    ss -s 2>/dev/null | head -5
    exit 0
fi

log "Applying Meshlink Anti-DDoS firewall rules..."

# ===== FLUSH ONLY INPUT CHAIN =====
# NEVER flush FORWARD, nat, or DOCKER chains — breaks container networking
iptables -F INPUT 2>/dev/null || true

# ===== DEFAULT POLICIES =====
iptables -P INPUT DROP
iptables -P FORWARD ACCEPT   # Docker requires ACCEPT
iptables -P OUTPUT ACCEPT

# ===== LOOPBACK =====
iptables -A INPUT -i lo -j ACCEPT

# ===== ESTABLISHED CONNECTIONS =====
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# ===== DROP INVALID PACKETS =====
iptables -A INPUT -m conntrack --ctstate INVALID -j DROP

# ===== SYN FLOOD PROTECTION =====
iptables -A INPUT -p tcp --syn -m connlimit --connlimit-above 60 -j DROP
echo 1 > /proc/sys/net/ipv4/tcp_syncookies 2>/dev/null || true
log "SYN flood protection enabled."

# ===== CONNECTION LIMIT PER IP =====
iptables -A INPUT -p tcp -m connlimit --connlimit-above 100 --connlimit-mask 32 -j DROP
log "Connection limit: 100 per IP."

# ===== NEW CONNECTION RATE LIMIT =====
iptables -A INPUT -p tcp --syn -m hashlimit \
    --hashlimit-name syn_rate \
    --hashlimit-above 25/sec \
    --hashlimit-burst 50 \
    --hashlimit-mode srcip \
    -j DROP
log "New connection rate limit: 25/sec per IP."

# ===== ICMP FLOOD PROTECTION =====
iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 2/sec --limit-burst 5 -j ACCEPT
iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
iptables -A INPUT -p icmp --icmp-type destination-unreachable -j ACCEPT
iptables -A INPUT -p icmp --icmp-type time-exceeded -j ACCEPT
log "ICMP flood protection enabled."

# ===== UDP FLOOD PROTECTION =====
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p udp --dport 5349 -j ACCEPT
iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
iptables -A INPUT -p udp -m hashlimit \
    --hashlimit-name udp_rate \
    --hashlimit-above 50/sec \
    --hashlimit-burst 100 \
    --hashlimit-mode srcip \
    -j DROP
log "UDP flood protection enabled."

# ===== ALLOW MESHLINK SERVICES =====
# SSH (rate limited)
iptables -A INPUT -p tcp --dport 22 -m connlimit --connlimit-above 5 -j DROP
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Matrix federation
iptables -A INPUT -p tcp --dport 8448 -j ACCEPT

# TURN server
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 5349 -j ACCEPT

log "Service ports opened: 22, 80, 443, 3478, 5349, 8448."

# ===== KERNEL HARDENING =====
echo 0 > /proc/sys/net/ipv4/conf/all/accept_source_route 2>/dev/null || true
echo 1 > /proc/sys/net/ipv4/conf/all/rp_filter 2>/dev/null || true
echo 0 > /proc/sys/net/ipv4/conf/all/accept_redirects 2>/dev/null || true
echo 0 > /proc/sys/net/ipv4/conf/all/send_redirects 2>/dev/null || true
echo 30 > /proc/sys/net/ipv4/tcp_fin_timeout 2>/dev/null || true
log "Kernel hardening applied."

echo ""
log "============================================"
log "  Meshlink Firewall ACTIVE"
log "============================================"
log "  Docker networking: PRESERVED"
log "  To disable: sudo $0 disable"
log "  To check:   sudo $0 status"
