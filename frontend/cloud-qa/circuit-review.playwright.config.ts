import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['circuit-users.spec.ts', 'circuit-notice-context.spec.ts', 'circuit-inspection-agenda.spec.ts'],
  workers: 1, retries: 0, maxFailures: 1, timeout: 120_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, process.env.QA_BROWSER_ATTEMPT || 'circuit-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, (process.env.QA_BROWSER_ATTEMPT || 'circuit-browser') + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
