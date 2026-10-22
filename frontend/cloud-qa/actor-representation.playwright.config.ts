import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: ['actor-onboarding.spec.ts','actor-administration.spec.ts','enterprise.spec.ts','enterprise-pagination.spec.ts','actor-representation.spec.ts','actor-edit-history.spec.ts','circuit-transport-admin.spec.ts','manifest-multirole.spec.ts'], grepInvert:/external reconciliation|external participant tracking/, workers:1,retries:0,maxFailures:1,timeout:300_000,
 outputDir:path.join(process.env.QA_ARTIFACTS!,process.env.QA_BROWSER_ATTEMPT||'actor-browser'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,(process.env.QA_BROWSER_ATTEMPT||'actor-browser')+'.json')}]],
 // Use the real worker. Blocking registration manufactures console errors and
 // does not represent the shipped web/app; API routes remain network-only.
 use:{...base.use,serviceWorkers:'allow'},
});
