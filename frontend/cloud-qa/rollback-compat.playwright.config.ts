import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['rollback-compat.spec.ts'], timeout: 240000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'rollback-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'rollback-browser.json') }]],
});
