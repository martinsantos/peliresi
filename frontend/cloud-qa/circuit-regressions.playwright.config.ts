import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';

const attempt = process.env.QA_BROWSER_ATTEMPT || 'circuit-regressions';
export default defineConfig({ ...base, workers: 1, retries: 0, maxFailures: 1, timeout: 120_000,
  testMatch: ['circuit-transport-admin.spec.ts','registration-unified.spec.ts', 'global-operation.spec.ts', 'actor-edit-history.spec.ts', 'actor-uploads.spec.ts', 'actor-certificates.spec.ts', 'registration-recovery.spec.ts',
    'public-recovery.spec.ts', 'sessions.spec.ts', 'circuit-login.spec.ts', 'inbox.spec.ts', 'inspection-exchange.spec.ts', 'inspection-hierarchy.spec.ts',
    'alert-repository.spec.ts', 'alert-catalogue.spec.ts', 'actor-onboarding-manual.spec.ts', 'circuit-manual.spec.ts'],
  outputDir: path.join(process.env.QA_ARTIFACTS!, attempt),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, attempt + '.json') }]],
  use: { ...base.use, serviceWorkers: 'block' },
});
