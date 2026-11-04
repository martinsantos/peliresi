import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const attempt = process.env.QA_BROWSER_ATTEMPT || 'baseline';
export default defineConfig({ ...base, testMatch: 'inspection-evidence-focus.spec.ts', timeout: 180000, maxFailures: 0,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, `${attempt}.json`) }]],
});
