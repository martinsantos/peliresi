import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
const attempt = process.env.QA_ATTEMPT || 'before';
export default defineConfig({ ...base, testMatch: 'manifest-owner.spec.ts', timeout: 120000,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'browser-' + attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'browser-' + attempt + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block', actionTimeout: 20000 },
});
