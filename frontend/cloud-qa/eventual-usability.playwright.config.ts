import { defineConfig } from '@playwright/test';
import base from './adenda-operations.playwright.config';
import path from 'node:path';
export default defineConfig({ ...base,
  testMatch: ['eventual-usability.spec.ts', 'manifest-exceptional.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, process.env.QA_MANUAL_ONLY ? 'manual-browser' : process.env.QA_PRESENTATION_ONLY ? 'presentation-browser' : 'eventual-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, process.env.QA_MANUAL_ONLY ? 'manual-browser.json' : process.env.QA_PRESENTATION_ONLY ? 'presentation-browser.json' : 'eventual-browser.json') }]],
});
