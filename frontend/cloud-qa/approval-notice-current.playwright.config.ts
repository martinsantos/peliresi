import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const attempt = process.env.QA_NOTICE_ATTEMPT || 'approval-notice-browser';
if (!['approval-notice-browser', 'approval-notice-browser-final'].includes(attempt)) throw new Error('Unexpected QA attempt');
export default defineConfig({ ...base, testMatch: 'approval-notice-current.spec.ts', timeout: 180_000,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, `${attempt}.json`) }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
