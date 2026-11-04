import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const run = process.env.QA_FRESH_RUN || process.env.QA_FRESH_PHASE;
export default defineConfig({ ...base, testMatch: 'fleet-freshness.spec.ts', timeout: 120000, maxFailures: 0,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'browser-' + run),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'browser-' + run + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block', actionTimeout: 20000 },
});
