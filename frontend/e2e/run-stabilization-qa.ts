/** Local runner: never prints QA secrets and never targets a public service. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../backend/package.json'));
if (!process.env.QA_ENV_FILE || (!process.env.QA_FIXTURE_FILE && !process.env.QA_FIXTURE_JSON) || !process.env.QA_RESULTS_DIR) {
  throw new Error('QA_ENV_FILE, QA_FIXTURE_FILE or QA_FIXTURE_JSON, and QA_RESULTS_DIR required');
}
const qa = require('dotenv').parse(fs.readFileSync(process.env.QA_ENV_FILE));
if (qa.QA_CONFIRM_ISOLATED !== 'YES' || qa.DISABLE_EMAILS !== 'true' || !qa.DATABASE_URL.includes('/sitrep_qa_')) throw new Error('Refusing non-isolated QA configuration');
// QA_FIXTURE_JSON is useful for an ephemeral acceptance run: it avoids
// materialising fixture IDs alongside the private QA env file. It is not
// accepted unless the same isolated-QA checks above have already passed.
const fixture = process.env.QA_FIXTURE_JSON
  ? JSON.parse(process.env.QA_FIXTURE_JSON)
  : JSON.parse(fs.readFileSync(process.env.QA_FIXTURE_FILE!, 'utf8'));
const output = process.env.QA_RESULTS_DIR;
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const previewPort = Number(process.env.QA_PREVIEW_PORT || 4179);
if (!Number.isInteger(previewPort) || previewPort < 1024 || previewPort > 65535) throw new Error('QA_PREVIEW_PORT must be a valid unprivileged TCP port');
const previewBaseUrl = `http://127.0.0.1:${previewPort}`;
const health = await fetch(`${previewBaseUrl}/api/health`, { signal: AbortSignal.timeout(10000) });
if (!health.ok) throw new Error(`QA is not ready (${health.status}); no tests started`);
const env = {
  ...process.env, ...qa, PLAYWRIGHT_BASE_URL: previewBaseUrl, PLAYWRIGHT_BROWSER_CHANNEL: 'chrome',
  QA_ACTOR_ID: fixture.actorId, QA_SECOND_ACTOR_ID: fixture.secondActorId, QA_TRANSPORTISTA_ID: fixture.transportistaId,
  QA_OPERADOR_ID: fixture.operadorId, QA_TIPO_RESIDUO_ID: fixture.tipoResiduoId,
  E2E_ADMIN_EMAIL: qa.QA_ADMIN_EMAIL, E2E_ADMIN_PASSWORD: qa.QA_ADMIN_PASSWORD,
  E2E_GENERADOR_EMAIL: 'qa.generador.a@sitrep.local', E2E_GENERADOR_PASSWORD: qa.QA_ADMIN_PASSWORD,
  E2E_TRANSPORTISTA_EMAIL: 'qa.transportista@sitrep.local', E2E_TRANSPORTISTA_PASSWORD: qa.QA_ADMIN_PASSWORD,
  E2E_OPERADOR_EMAIL: 'qa.operador@sitrep.local', E2E_OPERADOR_PASSWORD: qa.QA_ADMIN_PASSWORD,
};
const fd = fs.openSync(path.join(output, 'run.log'), 'w', 0o600);
const args = process.argv.slice(2);
const result = spawnSync('npm', ['run', 'test:e2e', '--', ...(args.length ? args : ['stabilization-qa.spec.ts', 'document-qa-workflow.spec.ts']), '--reporter=line', `--output=${path.join(output, 'artifacts')}`], { cwd: path.resolve(here, '..'), env, stdio: ['ignore', fd, fd] });
fs.closeSync(fd);
console.log(fs.readFileSync(path.join(output, 'run.log'), 'utf8').slice(-12000));
process.exitCode = result.status ?? 1;
