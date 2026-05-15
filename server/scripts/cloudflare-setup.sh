#!/bin/bash
# Meshlink Cloudflare Setup Guide
# Cloudflare provides FREE CDN, DDoS protection, and SSL.
#
# SETUP STEPS:
# 1. Create free Cloudflare account: https://cloudflare.com
# 2. Add your domain (or use nip.io with DNS proxy)
# 3. Set SSL mode to "Full (strict)"
# 4. Enable "Always Use HTTPS"
# 5. Create Page Rules:
#    - /assets/* → Cache Level: Cache Everything, Edge TTL: 1 month
#    - /installers/* → Cache Level: Cache Everything, Edge TTL: 1 week
#    - /_matrix/* → Cache Level: Bypass (never cache API)
#
# NGINX HEADERS FOR CLOUDFLARE:
# Already configured in setup.sh:
#   - Cache-Control headers for static assets
#   - Gzip compression
#   - Security headers (HSTS, X-Frame-Options)
#
# REAL IP FROM CLOUDFLARE:
# Add to nginx config:
#   set_real_ip_from 103.21.244.0/22;
#   set_real_ip_from 103.22.200.0/22;
#   set_real_ip_from 103.31.4.0/22;
#   set_real_ip_from 104.16.0.0/13;
#   set_real_ip_from 104.24.0.0/14;
#   set_real_ip_from 108.162.192.0/18;
#   set_real_ip_from 131.0.72.0/22;
#   set_real_ip_from 141.101.64.0/18;
#   set_real_ip_from 162.158.0.0/15;
#   set_real_ip_from 172.64.0.0/13;
#   set_real_ip_from 173.245.48.0/20;
#   set_real_ip_from 188.114.96.0/20;
#   set_real_ip_from 190.93.240.0/20;
#   set_real_ip_from 197.234.240.0/22;
#   set_real_ip_from 198.41.128.0/17;
#   real_ip_header CF-Connecting-IP;
#
# BENEFITS:
#   - Static files served from 300+ edge locations worldwide
#   - DDoS protection (free tier: unlimited)
#   - SSL termination at edge
#   - ~60% faster page loads globally
#   - Analytics and traffic insights

echo "Cloudflare setup guide. See comments in this file."
echo "For automated setup, use Cloudflare API with your API token."
