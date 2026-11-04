import { defineConfig } from '@playwright/test';
import base from './adenda-operations.playwright.config';
import path from 'node:path';

export default defineConfig({ ...base,
  testMatch: ['manifest-exceptional.spec.ts', 'adenda-operations.spec.ts', 'adenda-authorities.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'reactivation-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'reactivation-browser.json') }]],
});
