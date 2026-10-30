import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const attempt = process.env.QA_RECEIPT_ATTEMPT || 'before';
export default defineConfig({ ...base, testMatch: 'receipt-link-multirole.spec.ts', timeout: 120000, maxFailures: 0,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, `${attempt}.json`) }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
