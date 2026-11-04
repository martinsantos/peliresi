import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
const suffix = process.env.QA_AUTHORITY_RUN === 'polished' ? '-polished' : '';
export default defineConfig({ ...base, testMatch: 'inspection-deadline-authority.spec.ts', workers: 1, retries: 0, maxFailures: 1, timeout: 180_000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'browser-authority' + suffix),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'browser-authority' + suffix + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' }, projects: base.projects?.filter(project => ['web-desktop', 'app'].includes(project.name)) });
