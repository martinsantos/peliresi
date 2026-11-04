import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

// Ten viewport measurements render a populated map on the one-CPU QA host.
export default defineConfig({ ...base, testMatch: ['control-gps-reception.spec.ts', 'monitor-live-popup.spec.ts'], timeout: 480000,
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'control-gps-reception-browser'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'control-gps-reception-browser.json') }]],
});
