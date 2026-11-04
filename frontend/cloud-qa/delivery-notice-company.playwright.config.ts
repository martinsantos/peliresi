import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';

export default defineConfig({ ...base, testMatch: ['delivery-notice-company.spec.ts'], timeout: 120000,
 outputDir: path.join(process.env.QA_ARTIFACTS!, 'delivery-notice-company-browser'),
 reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'delivery-notice-company-results.json') }]],
});
