import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: 'gps-corridor-relay.spec.ts', timeout: 180000,
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'corridor-relay-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'corridor-relay-browser.json') }]],
});
