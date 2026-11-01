import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-gps-send-ambiguity-20261101';
const commit = '540ecfff63304bbba5268ccc24c9a3960bdf849c';
const stage = process.env.QA_SOURCE_STAGE;
assert.equal(process.env.QA_ARTIFACTS, out); assert.equal(process.env.GITHUB_SHA, commit);
assert.ok(stage === 'before' || stage === 'after');
const entries: Array<{ file: string; sha256: string }> = [];
function visit(dir: string, relative: string) {
  for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(dir, item.name), name = path.join(relative, item.name);
    if (item.isDirectory()) visit(file, name);
    else if (item.isFile()) entries.push({ file: name, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
    else throw new Error('Entrada compilada inesperada');
  }
}
visit(path.join(out, 'web-after'), 'web-after');
visit(path.join(out, 'app-after'), 'app-after');
assert.ok(entries.length > 400);
if (stage === 'before') writeFileSync(path.join(out, 'assets-manifest.json'), JSON.stringify({ commit, entries }), { flag: 'wx', mode: 0o600 });
else assert.deepEqual(entries, JSON.parse(readFileSync(path.join(out, 'assets-manifest.json'), 'utf8')).entries);
writeFileSync(path.join(out, `assets-${stage}.json`), JSON.stringify({ commit, files: entries.length, different: [] }), { flag: 'wx', mode: 0o600 });
console.log(`Cotejados ${entries.length} archivos compilados (${stage}).`);
