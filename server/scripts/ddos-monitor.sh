#!/bin/bash
# =============================================================================
# Meshlink DDoS Monitor — Real-time attack detection
# Shows: top IPs, request rates, connection counts, banned IPs
#
# Usage: sudo ./ddos-monitor.sh [watch]
# watch = auto-refresh every 5 seconds
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

show_stats() {
    clear
    echo -e "${CYAN}============================================${NC}"
    echo -e "${CYAN}  Meshlink DDoS Monitor  $(date '+%H:%M:%S')${NC}"
    echo -e "${CYAN}============================================${NC}"
    echo ""

    # Active connections
    TOTAL_CONN=$(ss -s 2>/dev/null | grep "TCP:" | awk '{print $2}' || echo "?")
    echo -e "${GREEN}Active TCP connections:${NC} $TOTAL_CONN"
    echo ""

    # Top 10 IPs by connection count
    echo -e "${YELLOW}--- Top 10 IPs by connections ---${NC}"
    ss -tn 2>/dev/null | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -10 | while read count ip; do
        if [ "$count" -gt 50 ]; then
            echo -e "  ${RED}$count${NC} connections from $ip ${RED}[SUSPICIOUS]${NC}"
        elif [ "$count" -gt 20 ]; then
            echo -e "  ${YELLOW}$count${NC} connections from $ip"
        else
            echo -e "  $count connections from $ip"
        fi
    done
    echo ""

    # Recent request rate (last 60 seconds from nginx log)
    if [ -f /var/log/nginx/access.log ]; then
        RECENT=$(awk -v d="$(date -d '1 minute ago' '+%d/%b/%Y:%H:%M' 2>/dev/null || date '+%d/%b/%Y:%H:%M')" '$0 ~ d' /var/log/nginx/access.log 2>/dev/null | wc -l)
        echo -e "${GREEN}Requests in last minute:${NC} $RECENT"

        # Top IPs in last minute
        echo -e "${YELLOW}--- Top IPs (last minute) ---${NC}"
        awk -v d="$(date -d '1 minute ago' '+%d/%b/%Y:%H:%M' 2>/dev/null || date '+%d/%b/%Y:%H:%M')" '$0 ~ d {print $1}' /var/log/nginx/access.log 2>/dev/null | sort | uniq -c | sort -rn | head -5 | while read count ip; do
            if [ "$count" -gt 100 ]; then
                echo -e "  ${RED}$count${NC} requests from $ip ${RED}[ATTACK?]${NC}"
            else
                echo -e "  $count requests from $ip"
            fi
        done
        echo ""

        # 429 (rate limited) count
        RATE_LIMITED=$(grep -c " 429 " /var/log/nginx/access.log 2>/dev/null || echo 0)
        echo -e "${GREEN}Total rate-limited (429):${NC} $RATE_LIMITED"

        # 444 (blocked) count
        BLOCKED=$(grep -c " 444 " /var/log/nginx/access.log 2>/dev/null || echo 0)
        echo -e "${GREEN}Total blocked (444):${NC} $BLOCKED"
    fi
    echo ""

    # fail2ban status
    if command -v fail2ban-client &>/dev/null; then
        echo -e "${YELLOW}--- fail2ban bans ---${NC}"
        for jail in meshlink-ratelimit meshlink-scanner meshlink-login meshlink-connflood sshd; do
            BANNED=$(fail2ban-client status "$jail" 2>/dev/null | grep "Currently banned" | awk '{print $NF}' || echo "?")
            TOTAL_BANNED=$(fail2ban-client status "$jail" 2>/dev/null | grep "Total banned" | awk '{print $NF}' || echo "?")
            if [ "$BANNED" != "0" ] && [ "$BANNED" != "?" ]; then
                echo -e "  ${RED}$jail: $BANNED banned now ($TOTAL_BANNED total)${NC}"
            else
                echo -e "  $jail: $BANNED banned now ($TOTAL_BANNED total)"
            fi
        done
    else
        echo -e "${YELLOW}fail2ban not installed. Run: sudo ./setup-fail2ban.sh${NC}"
    fi
    echo ""

    # SYN_RECV count (SYN flood indicator)
    SYN_RECV=$(ss -tn state syn-recv 2>/dev/null | wc -l || echo "?")
    if [ "$SYN_RECV" -gt 100 ] 2>/dev/null; then
        echo -e "${RED}SYN_RECV connections: $SYN_RECV [POSSIBLE SYN FLOOD!]${NC}"
    else
        echo -e "${GREEN}SYN_RECV connections:${NC} $SYN_RECV"
    fi

    # TIME_WAIT count
    TIME_WAIT=$(ss -tn state time-wait 2>/dev/null | wc -l || echo "?")
    echo -e "${GREEN}TIME_WAIT connections:${NC} $TIME_WAIT"

    echo ""
    echo -e "${CYAN}Press Ctrl+C to exit${NC}"
}

if [ "${1:-}" = "watch" ]; then
    while true; do
        show_stats
        sleep 5
    done
else
    show_stats
fi
