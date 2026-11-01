import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
const out = '/work/sitrep/.qa-notification-click-20261031';
if (process.env.QA_ARTIFACTS !== out) throw Error('Entorno de prueba incorrecto');
const stage = process.env.QA_BREADCRUMB_BASELINE === 'true' ? 'baseline' : 'final';
export default defineConfig({ ...base, testMatch: ['manual-breadcrumb.spec.ts'], timeout: 120_000,
  outputDir: path.join(out, `breadcrumb-${stage}`),
  reporter: [['line'], ['json', { outputFile: path.join(out, `breadcrumb-${stage}.json`) }]],
  projects: [
    { name: 'web-narrow', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 800 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 393, height: 844 } } },
    { name: 'web-tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 900 } } },
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 900 } } },
    { name: 'web-wide', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
  ],
});
