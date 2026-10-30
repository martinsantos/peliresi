import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const attempt = process.env.QA_ROLE_ATTEMPT || 'role-zoom';
export default defineConfig({ ...base, testMatch: 'mobile-role-zoom.spec.ts', timeout: 120000, maxFailures: 0,
  projects: base.projects!.filter(project => project.name === 'app'),
  outputDir: path.join(process.env.QA_ARTIFACTS!, attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, `${attempt}.json`) }]],
});
