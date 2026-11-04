/** Sequential continuation of the committed-code regression in the isolated preview. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026103111';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, '971727a3641780d88add1eb9a3ae714988ec44bf');
assert.equal(process.env.QA_COMPAT_BACKEND, 'closure-971727a3');
assert.equal(process.env.QA_LIFECYCLE_ALL_CREATORS, 'true');
const lifecycle = JSON.parse(readFileSync(path.join(out, 'manifest-complete.json'), 'utf8'));
assert.equal(lifecycle.stats.expected, 6); assert.equal(lifecycle.stats.unexpected, 0);
assert.equal(lifecycle.stats.skipped, 0); assert.equal(lifecycle.stats.flaky, 0);
assert.deepEqual(lifecycle.errors, []);
const diary = path.join(out, 'suite-stages.jsonl');
writeFileSync(diary, '', { flag: 'wx', mode: 0o600 });
type Stage = { name: string; command: string; args: string[]; product?: string; env?: Record<string, string>; cwd?: string; capture?: string };
const node = process.execPath, pw = './node_modules/.bin/playwright';
const script = (name: string): Stage => ({ name, command: node, args: ['--experimental-strip-types', `cloud-qa/${name}.ts`] });
const browser = (name: string, config: string, projects: string[], extra: string[] = [], env: Record<string, string> = {}): Stage => ({
  name, command: pw, args: ['test', '--config', `cloud-qa/${config}.playwright.config.ts`, ...projects.map(p => `--project=${p}`), ...extra], env,
});
const frontTests = [
  'components/ModalKeyboardViewport', 'components/NotificationBell', 'components/RegistrationReviewEditor',
  'components/SharedControls', 'components/SupportBubble', 'layouts/MobileLayout', 'pages/ConfirmManifestClosure',
  'pages/InspeccionExpedientePage.critical', 'pages/InspeccionesPage', 'pages/InspectionEvidenceImage',
  'pages/InspectionReport', 'pages/InspectionWorkspace.keyboard',
].map(name => `src-v6/__tests__/${name}.test.tsx`);
const pdfTests = ['inspectionFieldActPdf.service', 'inspectionFieldActPdfPagination', 'inspectionPdf.adversarial',
  'inspectionPdf.presentation'].map(name => `src/__tests__/services/${name}.test.ts`);
const stages: Stage[] = [
  { ...script('operational-lifecycle-receipts'), product: 'receipts-verified.json' },
  { ...browser('in-situ approvals', 'proposal', ['web-desktop', 'app'], ['--grep', 'in-situ proposal:']), product: 'proposal-e2e-initial.json' },
  { ...script('insitu-certificates-cut'), product: 'insitu-certificates.json' },
  { ...browser('in-situ certificates', 'insitu-certificates-cut', ['web-desktop', 'app']), product: 'insitu-certificates-browser.json' },
  { ...browser('inspection exchanges', 'psip-lifecycle-current', ['web-desktop', 'app']), product: 'psip-lifecycle-current.json' },
  { ...script('psip-lifecycle-audit'), product: 'psip-lifecycle-audit.json' },
  { ...script('fleet-gps-integration'), product: 'fleet-private.json' },
  { ...browser('simultaneous journeys', 'fleet', ['web', 'app']), product: 'fleet-browser.json' },
  { ...browser('monitor simulated positions', 'fleet-monitor', ['web', 'app']), product: 'fleet-monitor.json' },
  { ...script('fleet-current-audit'), product: 'fleet-current-audit.json' },
  { ...browser('inspection PDF', 'inspection-pdf-extent', ['web-desktop', 'app']), product: 'browser.json' },
  { ...browser('focus and enlargement', 'inspection-evidence-focus', ['web-desktop', 'app'], [], { QA_BROWSER_ATTEMPT: 'focus-current' }), product: 'focus-current.json' },
  { ...browser('mobile role and zoom', 'mobile-role-zoom', ['app']), product: 'role-zoom.json' },
  { ...browser('electricity invoices', 'payment-electricity', ['web-desktop', 'app'], ['--grep', 'applicant uploads an electrical invoice'], { QA_BROWSER_ATTEMPT: 'payment-electricity-browser' }), product: 'payment-electricity-browser.json' },
  { ...script('onboarding-ux-integration'), product: 'onboarding-ux-http.json' },
  { name: 'frontend unit tests', command: './node_modules/.bin/vitest', args: ['run', ...frontTests, '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${out}/unit-current.json`], product: 'unit-current.json' },
  { name: 'PDF unit tests', command: './node_modules/.bin/vitest', args: ['run', ...pdfTests, '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${out}/pdf-unit-current.json`], cwd: path.join(root, 'backend'), product: 'pdf-unit-current.json' },
  { name: 'manual and QA safeguards', command: node, args: ['--experimental-strip-types', '--test', 'cloud-qa/manual-content.test.ts', 'cloud-qa/rollback-backend.test.ts'], capture: 'manual-current.tap' },
];
for (const stage of stages) {
  const target = stage.product ?? stage.capture;
  if (target) assert.equal(existsSync(path.join(out, target)), false, `Refusing to overwrite ${target}`);
  const stamp = { stage: stage.name, at: new Date().toISOString() };
  appendFileSync(diary, JSON.stringify({ ...stamp, state: 'started' }) + '\n');
  console.log(`\n▶ ${stage.name}`);
  const result = spawnSync(stage.command, stage.args, {
    cwd: stage.cwd ?? path.join(root, 'frontend'), env: { ...process.env, ...stage.env },
    stdio: stage.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8',
  });
  if (stage.capture) writeFileSync(path.join(out, stage.capture), result.stdout ?? '', { flag: 'wx', mode: 0o600 });
  const ok = result.status === 0 && !result.error;
  appendFileSync(diary, JSON.stringify({ ...stamp, completedAt: new Date().toISOString(), state: ok ? 'passed' : 'failed', status: result.status, signal: result.signal }) + '\n');
  if (!ok) throw result.error ?? new Error(`${stage.name} failed (${result.status}, ${result.signal ?? 'no signal'}); evidence retained`);
}
console.log('\nSequential isolated suite completed.');
