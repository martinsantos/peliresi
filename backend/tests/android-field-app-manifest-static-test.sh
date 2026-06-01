#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MANIFEST="$ROOT_DIR/frontend/public/manifest-app.json"

node --input-type=module - "$MANIFEST" <<'NODE'
import fs from 'node:fs';

const manifestPath = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(manifest.name === 'SITREP - Trazabilidad RRPP', 'manifest name must remain SITREP');
assert(manifest.start_url === '/app/', 'start_url must keep /app/');
assert(manifest.scope === '/app/', 'scope must keep /app/');
assert(manifest.display === 'standalone', 'display must be standalone');
assert(manifest.orientation === 'portrait-primary', 'orientation must be portrait-primary');
assert(manifest.launch_handler?.client_mode === 'navigate-existing', 'launch_handler must reuse existing app window');

const iconPurposes = new Set((manifest.icons || []).map((icon) => `${icon.sizes}:${icon.purpose}`));
assert(iconPurposes.has('192x192:maskable'), '192 maskable icon is required');
assert(iconPurposes.has('512x512:maskable'), '512 maskable icon is required');

const shortcuts = manifest.shortcuts || [];
assert(Array.isArray(shortcuts), 'shortcuts must be an array');
assert(shortcuts.length >= 3, 'field app must expose at least three Android shortcuts');

const expected = [
  { name: 'Panel de campo', url: '/app/dashboard?source=shortcut-field' },
  { name: 'Escanear QR', url: '/app/escaner-qr?source=shortcut-qr' },
  { name: 'Centro de control', url: '/app/centro-control?source=shortcut-control' },
];

for (const item of expected) {
  const shortcut = shortcuts.find((candidate) => candidate.name === item.name);
  assert(shortcut, `missing shortcut: ${item.name}`);
  assert(shortcut.short_name && shortcut.short_name.length <= 12, `shortcut ${item.name} needs a compact short_name`);
  assert(shortcut.description && shortcut.description.length >= 12, `shortcut ${item.name} needs a useful description`);
  assert(shortcut.url === item.url, `shortcut ${item.name} must deep link to ${item.url}`);
  assert(Array.isArray(shortcut.icons) && shortcut.icons.length > 0, `shortcut ${item.name} needs icons`);
  for (const icon of shortcut.icons) {
    assert(icon.src?.startsWith('/app/'), `shortcut ${item.name} icon must stay inside /app/ scope`);
    assert(icon.sizes === '192x192', `shortcut ${item.name} icon must use 192x192`);
    assert(icon.type === 'image/png', `shortcut ${item.name} icon must be png`);
  }
}
NODE

echo "Android field app manifest shortcuts present"
