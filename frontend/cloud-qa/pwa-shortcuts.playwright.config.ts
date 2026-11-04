import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const out = '/work/sitrep/.qa-pwa-shortcuts-20261031';
if (process.env.QA_ARTIFACTS !== out) throw Error('Entorno de prueba incorrecto');
export default defineConfig({ ...base, timeout: 120_000,
  outputDir: path.join(out, 'browser'),
  reporter: [['line'], ['json', { outputFile: path.join(out, 'browser.json') }]],
  projects: [
    { name: 'web-desktop', testMatch: ['pwa-shortcut-roles.spec.ts'], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'app', testMatch: ['pwa-shortcut-roles.spec.ts', 'pwa-shortcut-update.spec.ts'], use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
