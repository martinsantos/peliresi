import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
const suffix = ['2', '3', '4'].includes(process.env.QA_INBOX_RUN || '') ? '-' + process.env.QA_INBOX_RUN : '';
export default defineConfig({ ...base, testMatch: 'inspection-deadline-inbox.spec.ts', workers: 1, retries: 0, maxFailures: 1, timeout: 180_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'browser-inbox' + suffix),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'browser-inbox' + suffix + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' }, projects: base.projects?.filter(project => ['web-desktop', 'app'].includes(project.name)) });
