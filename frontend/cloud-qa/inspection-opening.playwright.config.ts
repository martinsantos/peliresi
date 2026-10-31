import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { assertCloudEnvironment } from './safety';

assertCloudEnvironment();
const run = process.env.QA_OPENING_RUN || 'before';
if (!/^[a-z0-9-]+$/.test(run)) throw Error('Identificador de prueba inválido');
const output = path.join(process.env.QA_ARTIFACTS!, 'browser-' + run);
export default defineConfig({
  testDir: './e2e', testMatch: 'inspection-opening.spec.ts', workers: 1, retries: 0, timeout: 180_000,
  outputDir: output, reporter: [['line'], ['json', { outputFile: output + '.json' }]],
  use: { baseURL: 'http://127.0.0.1:4177', trace: 'retain-on-failure', screenshot: 'only-on-failure', serviceWorkers: 'block' },
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 900 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 800 } } },
  ],
});
