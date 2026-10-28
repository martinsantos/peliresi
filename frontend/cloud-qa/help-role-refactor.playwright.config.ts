import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['help-role-refactor.spec.ts'], timeout: 240000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'role-help'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'role-help.json') }]],
});
