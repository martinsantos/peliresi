import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const root = '/work/sitrep/.qa-manual-sidebar-20261030';
const attempt = process.env.QA_BROWSER_ATTEMPT || 'initial';
if (!/^[a-z0-9-]+$/.test(attempt)) throw new Error('Identificador de prueba inválido');
export default defineConfig({ ...base, testMatch: ['manual-sidebar-accessibility.spec.ts'], timeout: 180000,
  outputDir: path.join(root, 'browser-' + attempt),
  reporter: [['line'], ['json', { outputFile: path.join(root, 'browser-' + attempt + '.json') }]],
});
