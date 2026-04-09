#!/usr/bin/env bash
# ============================================================
# SITREP Migration — Preflight Check
# Run on TARGET server BEFORE starting migration.
# Validates all prerequisites are in place.
# ============================================================

set -uo pipefail

PASS=0
FAIL=0
WARN=0

ok() { echo "  [OK]   $1"; PASS=$((PASS+1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN+1)); }

echo "================================================"
echo "  SITREP Migration Preflight Check"
echo "  Target: $(hostname) — $(hostname -I 2>/dev/null | awk '{print $1}')"
echo "  Date: $(date)"
echo "================================================"
echo ""

echo "## OS"
. /etc/os-release 2>/dev/null
[ -n "${PRETTY_NAME:-}" ] && ok "OS: $PRETTY_NAME" || warn "OS unknown"

echo ""
echo "## Required commands"
for cmd in curl wget git node npm docker pm2 nginx certbot psql; do
  if command -v "$cmd" >/dev/null 2>&1; then
    ok "$cmd: $(which $cmd)"
  else
    fail "$cmd: NOT FOUND"
  fi
done

echo ""
echo "## Node.js version"
NODE_VER=$(node -v 2>/dev/null | sed 's/v//')
if [ -n "$NODE_VER" ]; then
  MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$MAJOR" -ge 20 ]; then
    ok "Node.js v$NODE_VER (>=20)"
  else
    fail "Node.js v$NODE_VER too old (need >=20)"
  fi
fi

echo ""
echo "## Docker"
if docker ps >/dev/null 2>&1; then
  ok "Docker daemon running"
  if docker ps --format '{{.Names}}' | grep -q sitrep-database; then
    ok "sitrep-database container present"
    if docker exec sitrep-database pg_isready -U sitrep -d trazabilidad_rrpp >/dev/null 2>&1; then
      ok "PostgreSQL accepting connections"
    else
      fail "PostgreSQL not ready (or wrong credentials)"
    fi
  else
    warn "sitrep-database container NOT created yet"
  fi
else
  fail "Docker daemon not accessible"
fi

echo ""
echo "## Disk space"
DISK_USED=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
DISK_FREE=$(df -h / | tail -1 | awk '{print $4}')
if [ "$DISK_USED" -lt 80 ]; then
  ok "Disk: $DISK_FREE free ($DISK_USED% used)"
else
  warn "Disk: $DISK_FREE free ($DISK_USED% used) — getting full"
fi

echo ""
echo "## Memory"
MEM_TOTAL=$(free -h | awk '/^Mem:/ {print $2}')
MEM_AVAIL=$(free -h | awk '/^Mem:/ {print $7}')
ok "Memory: $MEM_AVAIL available of $MEM_TOTAL"

echo ""
echo "## Nginx config"
if [ -f /etc/nginx/sites-available/sitrep.ultimamilla.com.ar ]; then
  ok "nginx config present"
  if nginx -t 2>&1 | grep -q "test is successful"; then
    ok "nginx config syntax OK"
  else
    fail "nginx config has syntax errors"
  fi
else
  warn "nginx config NOT installed yet"
fi

echo ""
echo "## SSL certificate"
if [ -d /etc/letsencrypt/live/sitrep.ultimamilla.com.ar ]; then
  ok "Let's Encrypt cert present"
  EXPIRY=$(openssl x509 -in /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/fullchain.pem -noout -enddate 2>/dev/null | cut -d= -f2)
  ok "Expires: $EXPIRY"
else
  warn "SSL cert NOT issued yet (use DNS-01 challenge)"
fi

echo ""
echo "## UFW firewall"
if ufw status 2>&1 | grep -q "Status: active"; then
  ok "UFW active"
  for port in 22 80 443; do
    if ufw status | grep -q "$port"; then
      ok "Port $port allowed"
    else
      warn "Port $port NOT in UFW rules"
    fi
  done
else
  warn "UFW not active"
fi

echo ""
echo "## PM2"
if pm2 list 2>/dev/null | grep -q sitrep; then
  ok "PM2 has sitrep entry"
else
  warn "PM2 has no sitrep entry yet"
fi

echo ""
echo "## /var/www directories"
for d in /var/www/sitrep /var/www/sitrep-backend /opt/sitrep-backups /opt/scripts-cicd; do
  if [ -d "$d" ]; then
    ok "$d exists"
  else
    warn "$d NOT created"
  fi
done

echo ""
echo "================================================"
echo "  Summary: $PASS PASS, $WARN WARN, $FAIL FAIL"
echo "================================================"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAILURES detected — fix before proceeding with migration."
  exit 1
elif [ "$WARN" -gt 0 ]; then
  echo ""
  echo "Some checks gave warnings. Review them but migration can proceed."
  exit 0
else
  echo ""
  echo "All checks passed. Ready for migration."
  exit 0
fi
