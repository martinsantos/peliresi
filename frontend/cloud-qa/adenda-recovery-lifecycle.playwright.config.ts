import { defineConfig } from '@playwright/test';
import path from 'node:path';
import base from './proposal-lifecycle.playwright.config';

// The constrained one-CPU preview can render after Playwright's 5 s default.
// Preserve the initial timeout evidence and require the same panel and actions.
export default defineConfig({ ...base, expect: { timeout: 20000 },
  projects: base.projects!.filter(project => ['web-desktop', 'app'].includes(project.name!)),
  outputDir: path.join(process.env.QA_ARTIFACTS!, 'manifest-complete-final'),
  reporter: [['line'], ['json', { outputFile: path.join(process.env.QA_ARTIFACTS!, 'manifest-complete-final.json') }]],
});
