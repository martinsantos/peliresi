import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['gps-incident-dialog.spec.ts'], maxFailures: 0,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'gps-incident-dialog-' + (process.env.QA_BROWSER_ATTEMPT || 'initial')),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'gps-incident-dialog-' + (process.env.QA_BROWSER_ATTEMPT || 'initial') + '.json') }]],
});
