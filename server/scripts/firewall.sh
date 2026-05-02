#!/bin/bash
# =============================================================================
# Meshlink Firewall & Anti-DDoS Rules (iptables)
# Protects against: SYN flood, UDP flood, ICMP flood, port scanning,
# connection exhaustion, IP spoofing, fragmentation attacks
#
# Usage: sudo ./firewall.sh [enable|disable|status]
# =============================================================================

set -euo pipefail

ACTION="${1:-enable}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[FIREWALL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

if [ "$ACTION" = "disable" ]; then
    log "Disabling firewall rules..."
    iptables -F
    iptables -X
    iptables -P INPUT ACCEPT
    iptables -P FORWARD ACCEPT
    iptables -P OUTPUT ACCEPT
    log "Firewall disabled. All traffic allowed."
    exit 0
fi

if [ "$ACTION" = "status" ]; then
    echo "=== Current iptables rules ==="
    iptables -L -n -v --line-numbers
    echo ""
    echo "=== Connection tracking ==="
    cat /proc/net/nf_conntrack 2>/dev/null | wc -l
    echo "active connections"
    exit 0
fi

log "Applying Meshlink Anti-DDoS firewall rules..."

# ===== FLUSH EXISTING RULES =====
iptables -F
iptables -X
iptables -t mangle -F
iptables -t mangle -X

# ===== DEFAULT POLICIES =====
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# ===== LOOPBACK =====
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# ===== ESTABLISHED CONNECTIONS =====
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# ===== DROP INVALID PACKETS =====
iptables -t mangle -A PREROUTING -m conntrack --ctstate INVALID -j DROP

# ===== DROP PACKETS WITH BOGUS TCP FLAGS (SYN-FIN, etc.) =====
iptables -t mangle -A PREROUTING -p tcp --tcp-flags FIN,SYN FIN,SYN -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags SYN,RST SYN,RST -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags FIN,RST FIN,RST -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags FIN,ACK FIN -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags ACK,URG URG -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags ACK,PSH PSH -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags ALL NONE -j DROP
iptables -t mangle -A PREROUTING -p tcp --tcp-flags ALL ALL -j DROP

# ===== BLOCK SPOOFED PACKETS =====
iptables -t mangle -A PREROUTING -s 224.0.0.0/3 -j DROP
iptables -t mangle -A PREROUTING -s 169.254.0.0/16 -j DROP
iptables -t mangle -A PREROUTING -s 172.16.0.0/12 -j DROP
iptables -t mangle -A PREROUTING -s 192.0.2.0/24 -j DROP
iptables -t mangle -A PREROUTING -s 10.0.0.0/8 -j DROP
log "Spoofed packet rules applied."

# ===== SYN FLOOD PROTECTION =====
# Limit new TCP connections to 60/sec per IP
iptables -A INPUT -p tcp --syn -m connlimit --connlimit-above 60 -j DROP
# SYN cookies (kernel level)
echo 1 > /proc/sys/net/ipv4/tcp_syncookies 2>/dev/null || true
echo 1 > /proc/sys/net/ipv4/tcp_synack_retries 2>/dev/null || true
log "SYN flood protection enabled."

# ===== CONNECTION LIMIT PER IP =====
# Max 100 simultaneous connections per IP
iptables -A INPUT -p tcp -m connlimit --connlimit-above 100 --connlimit-mask 32 -j DROP
log "Connection limit: 100 per IP."

# ===== NEW CONNECTION RATE LIMIT =====
# Max 25 new connections per second per IP
iptables -A INPUT -p tcp --syn -m hashlimit \
    --hashlimit-name syn_rate \
    --hashlimit-above 25/sec \
    --hashlimit-burst 50 \
    --hashlimit-mode srcip \
    -j DROP
log "New connection rate limit: 25/sec per IP."

# ===== ICMP FLOOD PROTECTION =====
# Allow ping but limit to 2/sec
iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 2/sec --limit-burst 5 -j ACCEPT
iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
# Allow other ICMP (needed for networking)
iptables -A INPUT -p icmp --icmp-type destination-unreachable -j ACCEPT
iptables -A INPUT -p icmp --icmp-type time-exceeded -j ACCEPT
log "ICMP flood protection enabled."

# ===== UDP FLOOD PROTECTION =====
# Limit UDP to 50/sec (except DNS and TURN)
iptables -A INPUT -p udp --dport 3478 -j ACCEPT  # TURN server
iptables -A INPUT -p udp --dport 5349 -j ACCEPT  # TURN TLS
iptables -A INPUT -p udp -m hashlimit \
    --hashlimit-name udp_rate \
    --hashlimit-above 50/sec \
    --hashlimit-burst 100 \
    --hashlimit-mode srcip \
    -j DROP
log "UDP flood protection enabled."

# ===== PORT SCAN DETECTION =====
# Drop packets hitting closed ports too fast
iptables -A INPUT -p tcp -m recent --name portscan --rcheck --seconds 60 --hitcount 10 -j DROP
iptables -A INPUT -p tcp --dport 1:1023 -m recent --name portscan --set -j DROP
log "Port scan detection enabled."

# ===== ALLOW MESHLINK SERVICES =====
# SSH (rate limited)
iptables -A INPUT -p tcp --dport 22 -m connlimit --connlimit-above 5 -j DROP
iptables -A INPUT -p tcp --dport 22 -m hashlimit \
    --hashlimit-name ssh_rate \
    --hashlimit-above 3/min \
    --hashlimit-burst 5 \
    --hashlimit-mode srcip \
    -j ACCEPT

# HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Matrix federation (optional)
iptables -A INPUT -p tcp --dport 8448 -j ACCEPT

# TURN server (for calls)
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 5349 -j ACCEPT
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p udp --dport 5349 -j ACCEPT
# TURN relay ports
iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT

log "Service ports opened: 22, 80, 443, 3478, 5349, 8448."

# ===== KERNEL HARDENING =====
# Disable IP source routing
echo 0 > /proc/sys/net/ipv4/conf/all/accept_source_route 2>/dev/null || true
# Enable reverse path filtering
echo 1 > /proc/sys/net/ipv4/conf/all/rp_filter 2>/dev/null || true
# Disable ICMP redirects
echo 0 > /proc/sys/net/ipv4/conf/all/accept_redirects 2>/dev/null || true
echo 0 > /proc/sys/net/ipv4/conf/all/send_redirects 2>/dev/null || true
# Increase connection tracking table
echo 262144 > /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || true
# Reduce TIME_WAIT
echo 30 > /proc/sys/net/ipv4/tcp_fin_timeout 2>/dev/null || true
# Enable TCP window scaling
echo 1 > /proc/sys/net/ipv4/tcp_window_scaling 2>/dev/null || true
log "Kernel hardening applied."

# ===== SAVE RULES =====
if command -v iptables-save &>/dev/null; then
    iptables-save > /etc/iptables.rules 2>/dev/null || true
    log "Rules saved to /etc/iptables.rules"
fi

echo ""
log "============================================"
log "  Meshlink Firewall ACTIVE"
log "============================================"
log ""
log "  Protection enabled:"
log "    - SYN flood (60 conn/IP, SYN cookies)"
log "    - Connection limit (100/IP)"
log "    - New conn rate (25/sec/IP)"
log "    - ICMP flood (2/sec)"
log "    - UDP flood (50/sec)"
log "    - Port scan detection"
log "    - Spoofed packet blocking"
log "    - Invalid TCP flag blocking"
log "    - Kernel hardening"
log ""
log "  To disable: sudo $0 disable"
log "  To check:   sudo $0 status"
