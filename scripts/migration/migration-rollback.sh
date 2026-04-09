#!/usr/bin/env bash
# ============================================================
# SITREP Migration — Rollback (run on local machine)
# Reverts DNS to old server in case of cutover failure.
# ============================================================

set -uo pipefail

OLD_HOST="${OLD_HOST:-23.105.176.45}"
DOMAIN="${DOMAIN:-sitrep.ultimamilla.com.ar}"

echo "================================================"
echo "  SITREP Migration — ROLLBACK"
echo "  Domain: $DOMAIN"
echo "  Reverting to: $OLD_HOST"
echo "================================================"
echo ""

cat <<EOF
This script does NOT change DNS automatically (no CF API token assumed).
Manual steps required:

1. Open Cloudflare dashboard for ultimamilla.com.ar zone

2. Edit DNS record:
   Name:    $DOMAIN
   Type:    A
   Value:   $OLD_HOST   ← change BACK to old IP
   TTL:     60 (already low from cutover preparation)

3. Save record

4. Verify propagation:
   dig $DOMAIN +short
   Expected: $OLD_HOST

5. Verify old server responds:
   curl https://$DOMAIN/api/health
   Expected: {"status":"ok","db":"connected"}

6. Confirm clients are routing back to old server:
   ssh root@$OLD_HOST "tail -f /var/log/nginx/access.log | grep $DOMAIN"

7. Notify team: rollback complete, debugging the new server in parallel

EOF

# Verify old server is alive
echo ""
echo "Pre-rollback check: is old server reachable?"
if curl --max-time 5 -sf "https://$DOMAIN/api/health" --resolve "$DOMAIN:443:$OLD_HOST" >/dev/null 2>&1; then
  echo "  OK — old server health endpoint responds"
else
  echo "  WARNING — old server may have issues. Verify before rollback."
fi

echo ""
echo "Press Enter to continue, or Ctrl+C to abort..."
read -r

echo ""
echo "Manual DNS change required. After you change the record:"
echo "Press Enter again to verify..."
read -r

# Verify DNS changed
echo ""
echo "Verifying DNS resolution..."
RESOLVED=$(dig "$DOMAIN" +short | head -1)
if [ "$RESOLVED" = "$OLD_HOST" ]; then
  echo "  OK — $DOMAIN resolves to $OLD_HOST"
else
  echo "  WAIT — currently resolves to $RESOLVED (waiting propagation)"
  echo "  Re-run dig in a few seconds: dig $DOMAIN +short"
fi

# Verify backend
echo ""
echo "Verifying backend health..."
sleep 5
HEALTH=$(curl -sf "https://$DOMAIN/api/health" 2>/dev/null || echo "FAIL")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "  OK — backend healthy"
else
  echo "  CHECK — response: $HEALTH"
fi

echo ""
echo "================================================"
echo "  Rollback procedure complete"
echo "  Next: investigate the new server failure"
echo "================================================"
