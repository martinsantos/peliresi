import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { compareDebt, criticalPath, parseBaseline, sha256 } from '../../../scripts/lint-baseline-core';
import type { CurrentFile, LintBaseline } from '../../../scripts/lint-baseline-core';

const file = (): CurrentFile => ({ path: 'src-v6/example.ts', sourceSha256: sha256('original source'), errors: 0, warnings: [{ ruleId: 'example/rule', messageSha256: sha256('existing message'), count: 2 }] });
const baseline = (): LintBaseline => ({ version: 1, sourceRevision: 'a'.repeat(40), warningCount: 2, files: [file()] });

describe('reviewed lint debt', () => {
  it('accepts only the reviewed messages in unchanged source', () => {
    expect(compareDebt(parseBaseline(baseline()), [file()])).toMatchObject({ errors: 0, warnings: 2, unaccepted: [] });
  });
  it('does not accept error severity even on a reviewed file', () => {
    expect(compareDebt(baseline(), [{ ...file(), errors: 1 }]).errors).toBe(1);
  });
  it('rejects changed source even with the same warning count', () => {
    expect(compareDebt(baseline(), [{ ...file(), sourceSha256: sha256('changed') }]).unaccepted).toHaveLength(1);
  });
  it('allows changed source only after all its warnings are resolved', () => {
    expect(compareDebt({ ...baseline(), files: [], warningCount: 0 }, [{ ...file(), sourceSha256: sha256('fixed'), warnings: [] }])).toMatchObject({ warnings: 0, unaccepted: [], stale: [] });
  });
  it('rejects a new file and a renamed file carrying existing warnings', () => {
    expect(compareDebt(baseline(), [{ ...file(), path: 'src-v6/renamed.ts' }]).unaccepted).toHaveLength(1);
  });
  it('rejects a new message, rule and an additional occurrence', () => {
    for (const warning of [
      { ...file().warnings[0], messageSha256: sha256('new message') },
      { ...file().warnings[0], ruleId: 'other/rule' },
      { ...file().warnings[0], count: 3 },
    ]) expect(compareDebt(baseline(), [{ ...file(), warnings: [warning] }]).unaccepted).toHaveLength(1);
  });
  it('cannot trade warnings removed from one file for debt in another', () => {
    const result = compareDebt(baseline(), [{ ...file(), warnings: [] }, { ...file(), path: 'src-v6/new.ts' }]);
    expect(result.warnings).toBe(2); expect(result.unaccepted).toHaveLength(1);
  });
  it('requires pruning removed warnings and flags a registered file missing from lint', () => {
    expect(compareDebt(baseline(), [{ ...file(), warnings: [{ ...file().warnings[0], count: 1 }] }]).stale).toHaveLength(1);
    expect(compareDebt(baseline(), []).stale).toHaveLength(1);
    expect(compareDebt(baseline(), [{ ...file(), warnings: [] }]).stale).toHaveLength(1);
  });
  it('rejects old debt reintroduced after the reviewed allowance was removed', () => {
    const cleaned = parseBaseline({ ...baseline(), files: [], warningCount: 0 });
    expect(compareDebt(cleaned, [{ ...file(), warnings: [] }])).toMatchObject({ warnings: 0, unaccepted: [], stale: [] });
    expect(compareDebt(cleaned, [file()]).unaccepted).toHaveLength(1);
  });
  it('never admits exceptions for the strict inspection scope', () => {
    for (const path of ['src-v6/pages/inspecciones/Nested/NewPanel.tsx', 'src-v6/services/inspeccion.service.ts', 'src-v6/services/inspectionOfflineEvidence.ts', 'src-v6/types/inspection.ts']) {
      expect(criticalPath(path)).toBe(true);
      const registered = { ...baseline(), files: [{ ...file(), path }] };
      expect(() => parseBaseline(registered)).toThrow(/Critical/);
      expect(compareDebt(registered, [{ ...file(), path }]).unaccepted).toHaveLength(1);
    }
    expect(criticalPath('src-v6/pages/inspecciones-other/Panel.tsx')).toBe(false);
  });
  it('protects every path of the actual zero-warning critical command', () => {
    const pkg = JSON.parse(readFileSync(new NodeURL('../../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> };
    const tokens = pkg.scripts['lint:critical'].split(' ');
    expect(tokens[0]).toBe('eslint'); expect(tokens.at(-1)).toBe('--max-warnings=0');
    for (const path of tokens.slice(1, -1)) expect(criticalPath(path.endsWith('.ts') || path.endsWith('.tsx') ? path : path + '/NewPanel.tsx')).toBe(true);
  });
  it('rejects a new rule even while an existing allowance becomes obsolete', () => {
    const changed = { ...file(), warnings: [{ ...file().warnings[0], ruleId: 'new/rule' }] };
    const result = compareDebt(baseline(), [changed]);
    expect(result.unaccepted).toHaveLength(1); expect(result.stale).toHaveLength(1);
  });
  it('rejects invalid baseline headers, counts, paths, hashes and duplicates', () => {
    for (const invalid of [null, {}, { ...baseline(), version: 2 }, { ...baseline(), warningCount: 1 },
      { ...baseline(), sourceRevision: 'main' }, { ...baseline(), files: [file(), file()] },
      ...['../outside.ts', '/absolute.ts', 'a/../b.ts', 'a\\b.ts', 'C:secret.ts'].map(path => ({ ...baseline(), files: [{ ...file(), path }] })),
      { ...baseline(), files: [{ ...file(), sourceSha256: 'bad' }] },
      { ...baseline(), files: [{ ...file(), warnings: [] }] },
      { ...baseline(), files: [{ ...file(), warnings: [file().warnings[0], file().warnings[0]] }] },
      { ...baseline(), files: [{ ...file(), warnings: [{ ...file().warnings[0], count: -2 }] }] },
    ]) expect(() => parseBaseline(invalid)).toThrow();
  });
});
