import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.QA_COMPAT_BACKEND, 'inspection-deadline-polished');
const ts = backendRequire('typescript'), name = 'services/inspectionDeadlineDirectNotice.service';
const baseline = '/work/sitrep/backend/dist-qa-psip-deadline-company-20261030-v5';
const output = '/work/sitrep/backend/dist-qa-psip-deadline-company-20261030-v6';
assert.ok(existsSync(path.join(baseline, 'index.js'))); assert.ok(!existsSync(output));
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const controller = digest(path.join(baseline, 'controllers/notification.controller.js'));
cpSync(baseline, output, { recursive: true, errorOnExist: true });
const input = path.join('/work/sitrep/backend/src', name + '.ts'), target = path.join(output, name + '.js');
const result = ts.transpileModule(readFileSync(input, 'utf8'), { fileName: input, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
assert.deepEqual(result.diagnostics, []); writeFileSync(target, result.outputText);
function walk(dir: string, prefix = ''): string[] { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
  ? walk(path.join(dir, entry.name), path.join(prefix, entry.name)) : [path.join(prefix, entry.name)]); }
const other = walk(baseline).filter(file => file !== name + '.js');
for (const file of other) assert.equal(digest(path.join(baseline, file)), digest(path.join(output, file)), file);
assert.equal(digest(path.join(output, 'controllers/notification.controller.js')), controller);
writeFileSync(path.join(out, 'build-proof-v6.json'), JSON.stringify({ baseline, output, changed: [{ module: name,
  sourceSha256: digest(input), outputSha256: digest(target) }], untouchedFiles: other.length,
  notificationControllerSha256: controller, controllerSourceCopied: false, production: false }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Compilación aislada: un módulo; ${other.length} archivos de base verificados.`);
