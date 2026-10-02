import path from 'node:path';
import { backendRequire, root } from './safety.ts';

/** Use the backend's CommonJS contract, not the frontend's ESM defaults. */
export function loadSeed() {
  backendRequire('ts-node').register({
    project: path.join(root, 'backend/tsconfig.json'),
    transpileOnly: true,
  });
  const module = backendRequire(path.join(root, 'backend/tests/integration/seed-night.ts'));
  if (typeof module.seedNightDatabase !== 'function') throw new Error('Canonical synthetic seed was not loaded');
  return module;
}
