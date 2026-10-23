import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './actor-representation.playwright.config';
export default defineConfig({...base,
 testMatch:['actor-representation.spec.ts','enterprise.spec.ts','enterprise-pagination.spec.ts','manifest-multirole.spec.ts','multirole-people.spec.ts'],
 outputDir:path.join(process.env.QA_ARTIFACTS!,process.env.QA_BROWSER_ATTEMPT||'multirole-browser'),
 reporter:[['line'],['json',{outputFile:path.join(process.env.QA_ARTIFACTS!,(process.env.QA_BROWSER_ATTEMPT||'multirole-browser')+'.json')}]],
});
