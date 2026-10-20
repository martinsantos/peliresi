import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './psip.playwright.config';
export default defineConfig({ ...base, testMatch: 'psip-capture.spec.ts',
  projects: base.projects!.filter(project => project.name === 'app'),
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'psip-capture'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'psip-capture.json') }]],
});
