#!/bin/bash
# npm Audit Gate — SITREP
# Verifies no high or critical vulnerabilities remain after npm audit fix.
# Uso: bash backend/tests/npm-audit-gate.sh
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   SITREP — npm Audit Gate${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "$BACKEND_DIR" || { echo -e "${RED}FAIL${NC} Cannot cd to $BACKEND_DIR"; exit 1; }

# Step 1: Run npm audit fix
echo -e "${CYAN}[1/3] Running npm audit fix...${NC}"
FIX_OUTPUT=$(npm audit fix 2>&1)
FIX_EXIT=$?
echo "$FIX_OUTPUT" | tail -5
echo ""

# Step 2: Check remaining vulnerabilities
echo -e "${CYAN}[2/3] Checking remaining vulnerabilities...${NC}"
AUDIT_JSON=$(npm audit --json 2>&1)

# Parse with python3 — filter out unfixable packages from gate
VULN_INFO=$(python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
except:
    print('parse_error')
    sys.exit(0)

vulns = d.get('vulnerabilities', {})

# Count unfixable (no fix available) packages separately
unfixable_high = 0
fixable_high = 0
unfixable_critical = 0
fixable_critical = 0
moderate = 0
low = 0

unfixable_details = []
for pkg, info in vulns.items():
    sev = info.get('severity', 'info')
    fix = info.get('fixAvailable', False)
    if sev == 'critical':
        if fix:
            fixable_critical += 1
        else:
            unfixable_critical += 1
            unfixable_details.append(f'UNFIXABLE:CRITICAL|{pkg}')
    elif sev == 'high':
        if fix:
            fixable_high += 1
        else:
            unfixable_high += 1
            unfixable_details.append(f'UNFIXABLE:HIGH|{pkg}')
    elif sev == 'moderate':
        moderate += 1
    elif sev == 'low':
        low += 1

print(f'SUMMARY:fixable_high:{fixable_high} unfixable_high:{unfixable_high} fixable_critical:{fixable_critical} unfixable_critical:{unfixable_critical} moderate:{moderate} low:{low}')
for d in unfixable_details:
    print(d)
" <<< "$AUDIT_JSON" 2>/dev/null)

if [ "$VULN_INFO" = "parse_error" ]; then
  echo -e "  ${RED}FAIL${NC} Could not parse npm audit JSON"
  ((FAIL++))
else
  FIXABLE_HIGH=$(echo "$VULN_INFO" | head -1 | sed 's/.*fixable_high:\([0-9]*\).*/\1/')
  UNFIXABLE_HIGH=$(echo "$VULN_INFO" | head -1 | sed 's/.*unfixable_high:\([0-9]*\).*/\1/')
  FIXABLE_CRIT=$(echo "$VULN_INFO" | head -1 | sed 's/.*fixable_critical:\([0-9]*\).*/\1/')
  UNFIXABLE_CRIT=$(echo "$VULN_INFO" | head -1 | sed 's/.*unfixable_critical:\([0-9]*\).*/\1/')
  MODERATE=$(echo "$VULN_INFO" | head -1 | sed 's/.*moderate:\([0-9]*\).*/\1/')
  LOW=$(echo "$VULN_INFO" | head -1 | sed 's/.*low:\([0-9]*\).*/\1/')

  echo -e "  Fixable high: ${FIXABLE_HIGH:-0} | Unfixable high: ${UNFIXABLE_HIGH:-0}"
  echo -e "  Fixable critical: ${FIXABLE_CRIT:-0} | Unfixable critical: ${UNFIXABLE_CRIT:-0}"
  echo -e "  Moderate: ${MODERATE:-0} | Low: ${LOW:-0}"

  # List unfixable exceptions (not counted as FAIL)
  echo "$VULN_INFO" | grep 'UNFIXABLE:' | while read -r line; do
    sev=$(echo "$line" | cut -d'|' -f2)
    pkg=$(echo "$line" | cut -d'|' -f3)
    echo -e "  ${YELLOW}ℹ${NC} Unfixable [$sev] $pkg (no patch available)"
  done

  # Only count fixable high/critical as failures
  if [ "${FIXABLE_HIGH:-0}" -gt 0 ] || [ "${FIXABLE_CRIT:-0}" -gt 0 ]; then
    echo -e "  ${RED}FAIL${NC} ${FIXABLE_CRIT:-0} critical, ${FIXABLE_HIGH:-0} high vulnerabilities remain (fixable)"
    ((FAIL++))
  else
    echo -e "  ${GREEN}PASS${NC} No fixable high or critical vulnerabilities"
    ((PASS++))
  fi
fi

echo ""

# Step 3: Summary
echo -e "${CYAN}[3/3] Summary${NC}"
if [ "$FAIL" -gt 0 ]; then
  echo -e "  ${RED}RESULT: FAILED — $FAIL fixable high/critical vulnerabilities remain${NC}"
  echo -e "  ${YELLOW}Hint: Run 'npm install <package>@<version>' to fix.${NC}"
  exit 1
else
  echo -e "  ${GREEN}RESULT: PASSED — No fixable high/critical vulnerabilities${NC}"
  if [ "${UNFIXABLE_HIGH:-0}" -gt 0 ] || [ "${UNFIXABLE_CRIT:-0}" -gt 0 ]; then
    echo -e "  ${YELLOW}Note: ${UNFIXABLE_HIGH:-0} high, ${UNFIXABLE_CRIT:-0} critical unfixable (no patch available)${NC}"
  fi
  exit 0
fi
