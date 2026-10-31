import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['liveness-ui.spec.ts'], timeout: 120_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'liveness-ui'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'liveness-ui.json') }]],
});
