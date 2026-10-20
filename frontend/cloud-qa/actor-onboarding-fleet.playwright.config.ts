import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['registration-unified.spec.ts'], grep: /public transport:/, workers: 1, retries: 0, maxFailures: 1,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'fleet-final'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'fleet-final.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
