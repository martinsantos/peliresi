#!/usr/bin/env bash
set -euo pipefail

RELEASE_NAME=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR=/var/www/sitrep-releases/$RELEASE_NAME
CURRENT_LINK=/var/www/sitrep
SOURCE_TARBALL=/tmp/sitrep-frontend-source.tar.gz
BUILD_DIR=/tmp/sitrep-build-$RELEASE_NAME
FRONTEND_URL=${SITREP_FRONTEND_URL:-https://sitrep.ultimamilla.com.ar/}
PWA_URL=${SITREP_PWA_URL:-https://sitrep.ultimamilla.com.ar/app/app.html}

echo "Deploy SITREP Frontend + PWA App (with build on VPS): $RELEASE_NAME"

if [ "${DRY_RUN:-false}" = "true" ]; then
  echo "[DRY-RUN] Would extract source to: $BUILD_DIR"
  echo "[DRY-RUN] Would run: npm ci"
  echo "[DRY-RUN] Would run: npm run build"
  echo "[DRY-RUN] Would run: npx vite build --config vite.config.app.ts"
  echo "[DRY-RUN] Would deploy to: $RELEASE_DIR"
  echo "[DRY-RUN] Would deploy PWA app to: $RELEASE_DIR/app/"
  echo "[DRY-RUN] Would create symlink: $CURRENT_LINK -> $RELEASE_DIR"
  echo "[DRY-RUN] No changes made"
  exit 0
fi

echo "Extracting source code..."
mkdir -p "$BUILD_DIR"
tar xzf "$SOURCE_TARBALL" -C "$BUILD_DIR"

echo "Installing dependencies..."
cd "$BUILD_DIR/frontend"
npm ci

echo "Building main frontend..."
npm run build

echo "Building PWA app..."
npx vite build --config vite.config.app.ts

echo "Creating release directory..."
mkdir -p "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR/app"

echo "Copying main frontend..."
cp -r dist/* "$RELEASE_DIR/"

echo "Copying PWA app..."
cp -r dist-app/* "$RELEASE_DIR/app/"

if [ -d "$BUILD_DIR/docs/manual" ]; then
  echo "Deploying manual from source..."
  mkdir -p "$RELEASE_DIR/manual/screenshots"
  find "$BUILD_DIR/docs/manual" -mindepth 1 -maxdepth 1 -exec cp -r {} "$RELEASE_DIR/manual/" \;
  [ -d "$BUILD_DIR/docs/screenshots/desktop" ] && cp -r "$BUILD_DIR/docs/screenshots/desktop" "$RELEASE_DIR/manual/screenshots/"
  [ -d "$BUILD_DIR/docs/screenshots/mobile" ] && cp -r "$BUILD_DIR/docs/screenshots/mobile" "$RELEASE_DIR/manual/screenshots/"
  chmod -R 755 "$RELEASE_DIR/manual"
elif [ -L "$CURRENT_LINK" ] && [ -d "$CURRENT_LINK/manual" ]; then
  echo "Preserving manual from previous release..."
  cp -r "$CURRENT_LINK/manual" "$RELEASE_DIR/manual"
  chmod -R 755 "$RELEASE_DIR/manual"
fi

echo "Switching symlink..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

echo "Cleaning build directory..."
cd /
rm -rf "$BUILD_DIR"

echo "Health check (main frontend): $FRONTEND_URL"
sleep 2
if curl -f "$FRONTEND_URL" >/dev/null 2>&1; then
  echo "Main frontend OK"
else
  echo "Main frontend health check failed - rolling back"
  PREV_RELEASE=$(ls -t /var/www/sitrep-releases | sed -n 2p)
  if [ -n "$PREV_RELEASE" ]; then
    ln -sfn "/var/www/sitrep-releases/$PREV_RELEASE" "$CURRENT_LINK"
    echo "Rollback successful to: $PREV_RELEASE"
  fi
  exit 1
fi

echo "Health check (PWA app): $PWA_URL"
if curl -f "$PWA_URL" >/dev/null 2>&1; then
  echo "PWA app OK"
  echo "Deploy successful - health checks passed"

  cd /var/www/sitrep-releases
  ls -t | tail -n +6 | xargs -r rm -rf
  echo "Cleaned old releases (kept last 5)"

  exit 0
fi

echo "PWA app health check failed - rolling back"
PREV_RELEASE=$(ls -t /var/www/sitrep-releases | sed -n 2p)
if [ -n "$PREV_RELEASE" ]; then
  ln -sfn "/var/www/sitrep-releases/$PREV_RELEASE" "$CURRENT_LINK"
  echo "Rollback successful to: $PREV_RELEASE"
fi
exit 1
