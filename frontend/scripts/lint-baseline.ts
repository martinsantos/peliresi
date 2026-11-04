import { ESLint } from 'eslint';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { compareDebt, parseBaseline, sha256 } from './lint-baseline-core.js';
import type { BaselineWarning, CurrentFile } from './lint-baseline-core.js';

async function main(): Promise<void> {
  const cwd = process.cwd();
  const baseline = parseBaseline(JSON.parse(await readFile(resolve(cwd, 'eslint-baseline.json'), 'utf8')));
  const engine = new ESLint({ cwd });
  // Same source coverage as `eslint .`; no files or rules are suppressed here.
  const results = await engine.lintFiles(['.']);
  const current: CurrentFile[] = [];
  for (const result of results) {
    const path = relative(cwd, result.filePath).split(sep).join('/');
    if (path.startsWith('../') || path.startsWith('/')) throw new Error('ESLint returned a file outside the project');
    const warnings = new Map<string, BaselineWarning>();
    for (const message of result.messages) {
      if (message.severity !== 1) continue;
      const ruleId = message.ruleId || 'unknown-rule';
      const messageSha256 = sha256(message.message.split(result.filePath).join(path));
      const key = ruleId + ':' + messageSha256;
      const existing = warnings.get(key);
      warnings.set(key, { ruleId, messageSha256, count: (existing?.count || 0) + 1 });
    }
    current.push({ path, sourceSha256: sha256(await readFile(result.filePath)), errors: result.errorCount, warnings: [...warnings.values()] });
  }
  const debt = compareDebt(baseline, current);
  const errors = results.filter(result => result.errorCount > 0);
  if (errors.length) process.stderr.write(await (await engine.loadFormatter('stylish')).format(errors));
  for (const message of debt.unaccepted) process.stderr.write(message + '\n');
  process.stdout.write(`Lint: ${debt.errors} errors; ${debt.warnings} existing warnings; ${debt.unaccepted.length} unaccepted warning groups. Baseline ${baseline.sourceRevision}.\n`);
  if (debt.errors || debt.unaccepted.length) process.exitCode = 1;
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
