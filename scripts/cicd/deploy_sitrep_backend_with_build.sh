#!/usr/bin/env bash
set -euo pipefail

RELEASE_NAME=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR=/var/www/sitrep-backend-releases/$RELEASE_NAME
CURRENT_LINK=/var/www/sitrep-backend
SOURCE_TARBALL=/tmp/sitrep-backend-source.tar.gz
BUILD_DIR=/tmp/sitrep-backend-build-$RELEASE_NAME
HEALTH_URL=${SITREP_BACKEND_HEALTH_URL:-http://localhost:3010/api/health}

echo "Deploy SITREP Backend (with build on VPS): $RELEASE_NAME"

if [ "${DRY_RUN:-false}" = "true" ]; then
  echo "[DRY-RUN] Would extract source to: $BUILD_DIR"
  echo "[DRY-RUN] Would run: npm ci && npm run build"
  echo "[DRY-RUN] Would run: npx prisma generate"
  echo "[DRY-RUN] Would deploy to: $RELEASE_DIR"
  echo "[DRY-RUN] Would run: pm2 reload sitrep-backend"
  echo "[DRY-RUN] Would health check: $HEALTH_URL"
  echo "[DRY-RUN] No changes made"
  exit 0
fi

echo "Extracting source code..."
mkdir -p "$BUILD_DIR"
tar xzf "$SOURCE_TARBALL" -C "$BUILD_DIR"

echo "Installing dependencies..."
cd "$BUILD_DIR/backend"
npm ci

echo "Building backend..."
npm run build

echo "Generating Prisma Client..."
npx prisma generate

echo "Removing dev dependencies..."
npm prune --production

echo "Creating release directory..."
mkdir -p "$RELEASE_DIR"

echo "Copying built files..."
cp -r dist "$RELEASE_DIR/"
cp -r node_modules "$RELEASE_DIR/"
cp -r prisma "$RELEASE_DIR/"
cp -r data "$RELEASE_DIR/" 2>/dev/null || true
cp package.json "$RELEASE_DIR/"
cp package-lock.json "$RELEASE_DIR/"
cp ecosystem.config.js "$RELEASE_DIR/"

echo "Copying .env from current release..."
cp "$CURRENT_LINK/.env" "$RELEASE_DIR/" 2>/dev/null || true

echo "Switching symlink..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

echo "Reloading PM2..."
pm2 reload sitrep-backend --update-env

echo "Cleaning build directory..."
cd /
rm -rf "$BUILD_DIR"

echo "Health check (30s timeout): $HEALTH_URL"
for _ in {1..30}; do
  if curl -f "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Deploy successful - health check passed"

    cd /var/www/sitrep-backend-releases
    ls -t | tail -n +6 | xargs -r rm -rf
    echo "Cleaned old releases (kept last 5)"

    exit 0
  fi
  sleep 1
done

echo "Health check failed after 30s - rolling back"
PREV_RELEASE=$(ls -t /var/www/sitrep-backend-releases | sed -n 2p)
if [ -n "$PREV_RELEASE" ]; then
  ln -sfn "/var/www/sitrep-backend-releases/$PREV_RELEASE" "$CURRENT_LINK"
  pm2 reload sitrep-backend
  sleep 5
  if curl -f "$HEALTH_URL" >/dev/null 2>&1; then
    echo "Rollback successful"
    exit 1
  fi

  echo "CRITICAL: rollback also failed"
  pm2 logs sitrep-backend --lines 50
fi

exit 1
