import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: 'approval-notice-current.spec.ts', timeout: 180_000,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'approval-notice-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'approval-notice-browser.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
