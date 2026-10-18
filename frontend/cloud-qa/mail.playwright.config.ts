import { defineConfig } from '@playwright/test';
import base from './playwright.config';
// Mail fixtures have their own setup. Do not make the existing full QA workflow
// accidentally depend on a file produced only by the mail workflow.
export default defineConfig({ ...base, testDir: '.',
  testMatch: ['mail-e2e/*.spec.ts', 'mail-e2e/*.spec.tsx', 'e2e/support.spec.ts', 'e2e/inspection-exchange.spec.ts', 'e2e/actor-certificates.spec.ts', 'e2e/manifest-lifecycle.spec.ts', 'e2e/manual.spec.ts'],
});
