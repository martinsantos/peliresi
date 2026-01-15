#!/bin/bash
# ============================================================
# HOTFIX: Add reversiones_estado table
# Date: 2026-01-15
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DEPLOY_PATH=${1:-"/var/www/sitrep-prod"}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   HOTFIX: Reversiones Estado${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Copy migration file
echo -e "${YELLOW}[1/4] Copying migration file...${NC}"
sudo mkdir -p $DEPLOY_PATH/backend/prisma/migrations/20260115183000_add_reversiones_estado
sudo cp backend/prisma/migrations/20260115183000_add_reversiones_estado/migration.sql \
    $DEPLOY_PATH/backend/prisma/migrations/20260115183000_add_reversiones_estado/
echo -e "${GREEN}  ✓ Migration file copied${NC}"

# Step 2: Run migration
echo -e "${YELLOW}[2/4] Running database migration...${NC}"
cd $DEPLOY_PATH/backend
npx prisma migrate deploy
echo -e "${GREEN}  ✓ Migration executed${NC}"

# Step 3: Regenerate Prisma client
echo -e "${YELLOW}[3/4] Regenerating Prisma client...${NC}"
npx prisma generate
echo -e "${GREEN}  ✓ Prisma client regenerated${NC}"

# Step 4: Restart backend
echo -e "${YELLOW}[4/4] Restarting backend...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 restart sitrep-backend
    echo -e "${GREEN}  ✓ Backend restarted via PM2${NC}"
else
    echo -e "${RED}  ⚠ Please restart backend manually${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   HOTFIX Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Test reversión:"
echo -e "  curl -X POST https://sitrep.ultimamilla.com.ar/api/manifiestos/man-test-003/revertir-entrega \\"
echo -e "    -H 'Authorization: Bearer TOKEN' \\"
echo -e "    -H 'Content-Type: application/json' \\"
echo -e "    -d '{\"motivo\":\"Test hotfix\"}'"
