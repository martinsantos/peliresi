import path from 'node:path';
import { defineConfig } from '@playwright/test';
import base from './circuit.playwright.config';
export default defineConfig({ ...base, testMatch: 'login-error.spec.ts', timeout: 90000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'login'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'login.json') }]],
});
