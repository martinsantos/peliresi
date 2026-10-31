import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

const attempt = process.env.QA_INSPECTION_COMPANY_RUN || 'inspection-company-browser';
export default defineConfig({ ...base, testMatch: 'inspection-company*.spec.ts', workers: 1,
  retries: 0, maxFailures: 1, timeout: 180_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, attempt + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
