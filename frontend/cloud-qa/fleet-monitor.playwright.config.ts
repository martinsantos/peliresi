import path from 'node:path';
import { defineConfig } from '@playwright/test';
import fleet from './fleet.playwright.config';

export default defineConfig({ ...fleet, testMatch: 'fleet-monitor.spec.ts', timeout: 180000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'fleet-monitor'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'fleet-monitor.json') }]],
});
