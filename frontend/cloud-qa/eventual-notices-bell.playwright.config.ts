import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './eventual-notices.playwright.config';
export default defineConfig({ ...base, grep: /la campana abre el aviso/,
 outputDir: path.join(process.env.QA_ARTIFACTS!, 'bell-browser'),
 reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'bell-browser.json') }]],
});
