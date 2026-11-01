import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['practice-pdf.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'practice-pdf-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'practice-pdf-browser.json') }]],
});
