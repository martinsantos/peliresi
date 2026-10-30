import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal.playwright.config';
export default defineConfig({ ...base, testMatch:'eventual-event-draft.spec.ts', timeout:120000, maxFailures:0,
 projects:base.projects!.filter(project => ['web-desktop','app'].includes(project.name!)),
 outputDir:path.join(process.env.QA_ARTIFACTS!,'browser-' + (process.env.QA_EVENT_RUN || process.env.QA_EVENT_PHASE)),
 reporter:[['line'],['json',{ outputFile:path.join(process.env.QA_ARTIFACTS!,'browser-' + (process.env.QA_EVENT_RUN || process.env.QA_EVENT_PHASE) + '.json') }]],
 use:{...base.use,serviceWorkers:'block',actionTimeout:20000},
});
