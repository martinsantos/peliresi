import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './continuity-ui.playwright.config';
export default defineConfig({
  ...base,
  testMatch: ['persistent-manifest-draft.spec.ts', 'continuity-ui.spec.ts', 'manifest-eligibility.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'persistent-draft-e2e'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'persistent-draft-e2e.json') }]],
});
