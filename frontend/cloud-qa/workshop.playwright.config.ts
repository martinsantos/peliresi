import { defineConfig } from '@playwright/test';
import base from './mail.playwright.config';

// Real synthetic backend. Keep every existing mail/classroom case and add the
// critical registration, session, mobile field-work and map journeys.
export default defineConfig({
  ...base,
  testMatch: [
    ...(base.testMatch as string[]),
    'e2e/registration-unified.spec.ts',
    'e2e/registration-documents.spec.ts',
    'e2e/public-wizard-layout.spec.ts',
    'e2e/sessions.spec.ts',
    'e2e/control-close.spec.ts',
    'e2e/global-operation.spec.ts',
    'e2e/selection-collapse.spec.ts',
    'e2e/inspection-hierarchy.spec.ts',
    'e2e/qr-camera.spec.ts',
    'e2e/manual-training.spec.ts',
  ],
});
