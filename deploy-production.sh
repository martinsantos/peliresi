#!/bin/bash
# ============================================================
# SITREP Production Deployment Script
# ============================================================
# Usage: ./deploy-production.sh [server_path]
# Default path: /var/www/sitrep
# ============================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_PATH=${1:-"/var/www/sitrep"}
BACKEND_PORT=3001
FRONTEND_DIST="frontend/dist"
BACKEND_DIST="backend/dist"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   SITREP Production Deployment${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Step 1: Pull latest code
echo -e "${YELLOW}[1/7] Pulling latest code...${NC}"
git fetch origin
git checkout production/v1.0
git pull origin production/v1.0
COMMIT=$(git rev-parse --short HEAD)
echo -e "${GREEN}  ✓ On commit: $COMMIT${NC}"

# Step 2: Install backend dependencies
echo -e "${YELLOW}[2/7] Installing backend dependencies...${NC}"
cd backend
npm ci --production=false
echo -e "${GREEN}  ✓ Backend dependencies installed${NC}"

# Step 3: Build backend
echo -e "${YELLOW}[3/7] Building backend...${NC}"
npm run build
echo -e "${GREEN}  ✓ Backend built${NC}"

# Step 4: Run database migrations
echo -e "${YELLOW}[4/7] Running database migrations...${NC}"
npx prisma migrate deploy
npx prisma generate
echo -e "${GREEN}  ✓ Database migrated${NC}"

# Step 5: Install frontend dependencies
echo -e "${YELLOW}[5/7] Installing frontend dependencies...${NC}"
cd ../frontend
npm ci --production=false
echo -e "${GREEN}  ✓ Frontend dependencies installed${NC}"

# Step 6: Build frontend
echo -e "${YELLOW}[6/7] Building frontend for production...${NC}"
VITE_API_URL=https://sitrep.ultimamilla.com.ar/api npm run build
echo -e "${GREEN}  ✓ Frontend built${NC}"

# Step 7: Deploy files
echo -e "${YELLOW}[7/7] Deploying files...${NC}"

# Create directories if they don't exist
sudo mkdir -p $DEPLOY_PATH/frontend
sudo mkdir -p $DEPLOY_PATH/backend

# Copy frontend
sudo rm -rf $DEPLOY_PATH/frontend/*
sudo cp -r dist/* $DEPLOY_PATH/frontend/
echo -e "${GREEN}  ✓ Frontend deployed to $DEPLOY_PATH/frontend${NC}"

# Copy backend
cd ../backend
sudo rm -rf $DEPLOY_PATH/backend/*
sudo cp -r dist/* $DEPLOY_PATH/backend/
sudo cp package*.json $DEPLOY_PATH/backend/
sudo cp -r node_modules $DEPLOY_PATH/backend/
sudo cp -r prisma $DEPLOY_PATH/backend/
echo -e "${GREEN}  ✓ Backend deployed to $DEPLOY_PATH/backend${NC}"

# Restart services
echo -e "${YELLOW}Restarting services...${NC}"
if command -v pm2 &> /dev/null; then
    pm2 restart sitrep-backend 2>/dev/null || pm2 start $DEPLOY_PATH/backend/index.js --name sitrep-backend
    echo -e "${GREEN}  ✓ Backend restarted via PM2${NC}"
else
    echo -e "${RED}  ⚠ PM2 not found. Please restart backend manually.${NC}"
fi

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
echo -e "${GREEN}  ✓ Nginx reloaded${NC}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Commit: ${YELLOW}$COMMIT${NC}"
echo -e "Frontend: ${YELLOW}$DEPLOY_PATH/frontend${NC}"
echo -e "Backend: ${YELLOW}$DEPLOY_PATH/backend${NC}"
echo ""
echo -e "Test URLs:"
echo -e "  - API Health: ${YELLOW}https://sitrep.ultimamilla.com.ar/api/health${NC}"
echo -e "  - Frontend: ${YELLOW}https://sitrep.ultimamilla.com.ar/${NC}"
echo -e "  - Login: ${YELLOW}https://sitrep.ultimamilla.com.ar/login${NC}"
