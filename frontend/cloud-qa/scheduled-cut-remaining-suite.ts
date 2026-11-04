/** Remaining journeys, sequentially, over the same product as the prior manifest batch. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-operational-ui-current2026110102';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.GITHUB_SHA, '62516a08a3fe189d7d5612520d678162674f1b32');
assert.equal(process.env.QA_COMPAT_BACKEND, 'scheduled-cut-regression-62516a08');
assert.equal(process.env.SITREP_PAUSE_BACKGROUND_JOBS, 'true');
assert.equal(process.env.QA_BROWSER_ATTEMPT, 'candidate-mail-v3');
const diary = path.join(out, 'remaining-stages.jsonl');
writeFileSync(diary, '', { flag: 'wx', mode: 0o600 });
type Stage = { name: string; command: string; args: string[]; product?: string; env?: Record<string, string>; cwd?: string; capture?: string };
const node = process.execPath, pw = './node_modules/.bin/playwright';
const script = (name: string): Stage => ({ name, command: node, args: ['--experimental-strip-types', `cloud-qa/${name}.ts`] });
const browser = (name: string, config: string, projects: string[], extra: string[] = [], env: Record<string, string> = {}): Stage => ({
  name, command: pw, args: ['test', '--config', `cloud-qa/${config}.playwright.config.ts`, ...projects.map(p => `--project=${p}`), ...extra], env,
});
const frontTests = [
  'components/ManifestCertificates', 'hooks/useCertificateCommand', 'hooks/useCertificateDraft',
  'components/ModalKeyboardViewport', 'components/NotificationBell', 'components/RegistrationReviewEditor',
  'components/SharedControls', 'components/SupportBubble', 'layouts/MobileLayout', 'pages/ConfirmManifestClosure',
  'pages/InspeccionExpedientePage.critical', 'pages/InspeccionesPage', 'pages/InspectionEvidenceImage',
  'pages/InspectionReport', 'pages/InspectionWorkspace.keyboard',
].map(name => `src-v6/__tests__/${name}.test.tsx`);
const pdfTests = ['inspectionFieldActPdf.service', 'inspectionFieldActPdfPagination', 'inspectionPdf.adversarial',
  'inspectionPdf.presentation'].map(name => `src/__tests__/services/${name}.test.ts`);
const stages: Stage[] = [
  { ...script('insitu-certificates-cut'), product: 'insitu-certificates.json' },
  { ...browser('certificados en origen', 'insitu-certificates-cut', ['web-desktop', 'app']), product: 'insitu-certificates-browser.json' },
  { ...browser('intercambios PSIP', 'psip-lifecycle-current', ['web-desktop', 'app']), product: 'psip-lifecycle-current.json' },
  { ...script('psip-lifecycle-audit'), product: 'psip-lifecycle-audit.json' },
  { ...script('fleet-gps-integration'), product: 'fleet-private.json' },
  { ...browser('viajes simultáneos y relevo', 'fleet', ['web', 'app']), product: 'fleet-browser.json' },
  { ...browser('posiciones simuladas en Monitor', 'fleet-monitor', ['web', 'app']), product: 'fleet-monitor.json' },
  { ...script('fleet-current-audit'), product: 'fleet-current-audit.json' },
  { ...browser('acta de inspección', 'inspection-pdf-extent', ['web-desktop', 'app']), product: 'browser.json' },
  { ...browser('foco y ampliación', 'inspection-evidence-focus', ['web-desktop', 'app'], [], { QA_BROWSER_ATTEMPT: 'focus-current' }), product: 'focus-current.json' },
  { ...browser('roles móviles y zoom', 'mobile-role-zoom', ['app']), product: 'role-zoom.json' },
  { ...browser('facturas eléctricas', 'payment-electricity', ['web-desktop', 'app'], ['--grep', 'applicant uploads an electrical invoice'], { QA_BROWSER_ATTEMPT: 'payment-electricity-browser' }), product: 'payment-electricity-browser.json' },
  { ...script('onboarding-ux-integration'), product: 'onboarding-ux-http.json' },
  { name: 'interfaz: unitarias', command: './node_modules/.bin/vitest', args: ['run', ...frontTests, '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${out}/unit-current.json`], product: 'unit-current.json' },
  { name: 'PDF: unitarias', command: './node_modules/.bin/vitest', args: ['run', ...pdfTests, '--maxWorkers=1', '--no-file-parallelism', '--reporter=json', `--outputFile=${out}/pdf-unit-current.json`], cwd: path.join(root, 'backend'), product: 'pdf-unit-current.json' },
  { name: 'manual y salvaguardas', command: node, args: ['--experimental-strip-types', '--test', 'cloud-qa/manual-content.test.ts', 'cloud-qa/rollback-backend.test.ts'], capture: 'manual-current.tap' },
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
console.log('\nRecorridos restantes completados en preview.');
