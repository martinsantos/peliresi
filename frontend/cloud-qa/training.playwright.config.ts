import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testDir: '.', timeout: 90000,
  testMatch: ['mail-e2e/training.spec.ts', 'e2e/training-new-features.spec.ts', 'e2e/manual-training.spec.ts', 'e2e/manual.spec.ts'],
});
