import { defineConfig } from '@playwright/test';
import operations from './adenda-operations.playwright.config';

/** Authority fixtures are separate; the original operations suite remains runnable alone. */
export default defineConfig({
  ...operations,
  testMatch: ['adenda-operations.spec.ts', 'adenda-authorities.spec.ts'],
});
