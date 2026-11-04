import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
const out = '/work/sitrep/.qa-notification-click-20261031';
if (process.env.QA_ARTIFACTS !== out) throw Error('Entorno de prueba incorrecto');
export default defineConfig({ ...base, testMatch: ['notice-form.spec.ts'], timeout: 120_000,
  outputDir: path.join(out, 'draft-navigation-final'),
  reporter: [['line'], ['json', { outputFile: path.join(out, 'draft-navigation-final.json') }]],
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
