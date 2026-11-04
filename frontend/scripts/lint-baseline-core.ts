import { createHash } from 'node:crypto';

export interface BaselineWarning { ruleId: string; messageSha256: string; count: number }
export interface BaselineFile { path: string; sourceSha256: string; warnings: BaselineWarning[] }
export interface LintBaseline { version: 1; sourceRevision: string; warningCount: number; files: BaselineFile[] }
export interface CurrentFile extends BaselineFile { errors: number }
export interface DebtResult { errors: number; warnings: number; unaccepted: string[]; remaining: BaselineFile[] }

export const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const relativePath = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') && !value.split('/').some(part => part === '..' || part === '.' || part === '');

/** The baseline is reviewed input, never written or expanded by the lint command. */
export function parseBaseline(value: unknown): LintBaseline {
  if (!isRecord(value) || value.version !== 1 || typeof value.sourceRevision !== 'string' || !/^[a-f0-9]{40}$/.test(value.sourceRevision) || !Number.isInteger(value.warningCount) || !Array.isArray(value.files)) throw new Error('Invalid lint baseline header');
  const seen = new Set<string>();
  let count = 0;
  const files: BaselineFile[] = value.files.map((entry: unknown) => {
    if (!isRecord(entry) || !relativePath(entry.path) || !hash(entry.sourceSha256) || !Array.isArray(entry.warnings) || seen.has(entry.path)) throw new Error('Invalid or duplicate lint baseline file');
    seen.add(entry.path);
    const rules = new Set<string>();
    const warnings: BaselineWarning[] = entry.warnings.map((warning: unknown) => {
      if (!isRecord(warning) || typeof warning.ruleId !== 'string' || !warning.ruleId || !hash(warning.messageSha256) || typeof warning.count !== 'number' || !Number.isSafeInteger(warning.count) || warning.count < 1) throw new Error('Invalid lint baseline warning');
      const key = warning.ruleId + ':' + warning.messageSha256;
      if (rules.has(key)) throw new Error('Duplicate lint baseline warning');
      rules.add(key); count += warning.count;
      return { ruleId: warning.ruleId, messageSha256: warning.messageSha256, count: warning.count };
    });
    if (!warnings.length) throw new Error('Empty lint baseline file');
    return { path: entry.path, sourceSha256: entry.sourceSha256, warnings };
  });
  if (count !== value.warningCount) throw new Error('Lint baseline count does not match its entries');
  return { version: 1, sourceRevision: value.sourceRevision, warningCount: count, files };
}

/** Any changed file must be warning-free. An unchanged file can retain only its
 * exact reviewed warning messages and multiplicity. Error severity is never accepted. */
export function compareDebt(baseline: LintBaseline, current: CurrentFile[]): DebtResult {
  const known = new Map(baseline.files.map(file => [file.path, file]));
  const result: DebtResult = { errors: 0, warnings: 0, unaccepted: [], remaining: [] };
  for (const file of current) {
    result.errors += file.errors;
    const count = file.warnings.reduce((sum, warning) => sum + warning.count, 0);
    result.warnings += count;
    if (!count) continue;
    result.remaining.push({ path: file.path, sourceSha256: file.sourceSha256, warnings: file.warnings });
    const previous = known.get(file.path);
    if (!previous || previous.sourceSha256 !== file.sourceSha256) {
      result.unaccepted.push(`${file.path}: ${count} warning(s) in a new or changed file`);
      continue;
    }
    const accepted = new Map(previous.warnings.map(warning => [warning.ruleId + ':' + warning.messageSha256, warning.count]));
    for (const warning of file.warnings) {
      const allowed = accepted.get(warning.ruleId + ':' + warning.messageSha256) || 0;
      if (warning.count > allowed) result.unaccepted.push(`${file.path}: ${warning.ruleId}, ${warning.count - allowed} unreviewed warning(s)`);
    }
  }
  return result;
}
