import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

const stage = process.env.QA_GPS_AMBIGUITY_STAGE;
if (stage !== 'before' && stage !== 'after') throw new Error('Choose before or after');
export default defineConfig({ ...base, testMatch: ['gps-send-ambiguity.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, `browser-${stage}`),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, `browser-${stage}.json`) }]],
});
