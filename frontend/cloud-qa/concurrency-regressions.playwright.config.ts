import assert from 'node:assert/strict';
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

const attempt = process.env.QA_BROWSER_ATTEMPT || 'initial';
assert.match(attempt, /^[a-z0-9][a-z0-9-]{0,63}$/, 'Use a simple unique evidence label');
const evidence = 'concurrency-e2e-' + attempt;

// Importing the shared config enforces preview/database/environment guardrails.
export default defineConfig({
  ...base,
  testMatch: 'concurrency-regressions.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, evidence),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, evidence + '.json') }]],
  projects: [
    { name: 'web-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'web-responsive', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
    { name: 'app', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
