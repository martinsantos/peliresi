import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['incident-retry-final.spec.ts'], maxFailures: 0,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'browser-final'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'browser-final.json') }]],
});
