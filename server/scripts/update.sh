#!/bin/bash
# =============================================================================
# Meshlink Auto-Update
# Pulls latest code, rebuilds frontend, restarts services
#
# Usage: sudo ./update.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$SERVER_DIR/.." && pwd)"

log() { echo "[UPDATE] $1"; }
warn() { echo "[WARNING] $1"; }

log "============================================"
log "  Meshlink Auto-Update"
log "============================================"
log ""

# Step 1: Backup before update
log "Step 1: Creating backup..."
bash "$SCRIPT_DIR/backup.sh" 2>/dev/null || warn "Backup failed (continuing anyway)"

# Step 2: Pull latest code
log "Step 2: Pulling latest code..."
cd "$REPO_DIR"
git stash 2>/dev/null || true
git pull origin main 2>/dev/null || git pull 2>/dev/null || { warn "Git pull failed"; exit 1; }

# Step 3: Install dependencies
log "Step 3: Installing dependencies..."
npm install --production=false 2>/dev/null || npm install

# Step 4: Build frontend
log "Step 4: Building frontend..."
npm run build

# Step 5: Copy to nginx
log "Step 5: Deploying..."
mkdir -p "$SERVER_DIR/nginx/www/meshlink"
cp -r "$REPO_DIR/dist/"* "$SERVER_DIR/nginx/www/meshlink/"

# Step 6: Sync Capacitor (if needed)
if [ -d "$REPO_DIR/android" ]; then
    npx cap sync android 2>/dev/null || true
fi

# Step 7: Restart services
log "Step 6: Restarting services..."
cd "$SERVER_DIR"
docker compose pull 2>/dev/null || true
docker compose up -d

# Step 8: Verify
log "Step 7: Verifying..."
sleep 5
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:80/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log "Health check: OK"
else
    warn "Health check failed (code: $HTTP_CODE). Check: docker compose ps"
fi

log ""
log "============================================"
log "  Update Complete!"
log "============================================"
log ""
log "  Version: $(git log --oneline -1 2>/dev/null || echo 'unknown')"
log "  Status: $(docker compose ps --format '{{.Name}}: {{.State}}' 2>/dev/null | tr '\n' ', ')"
