import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['gps-corridor-context.spec.ts'], timeout: 180_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'gps-corridor-context-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'gps-corridor-context-browser.json') }]],
});
