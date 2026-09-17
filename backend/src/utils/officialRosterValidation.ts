export type ActorRole = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';

export type RoleLinkStatus =
  | 'MATCHED'
  | 'MULTIROLE_ACTIVE'
  | 'MULTIROLE_INACTIVE'
  | 'UNBACKED';

export interface ActorRoleRecord {
  role: ActorRole;
  cuit: string;
  active: boolean;
  userId: string | null;
}

export function normalizeCuit(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function normalizeCertificate(value: unknown): string {
  const raw = String(value ?? '').trim().toUpperCase();
  const match = raw.match(/^([GTO])\s*[-–—]?\s*(\d+)$/);
  return match ? `${match[1]}-${match[2].padStart(6, '0')}` : raw.replace(/\s+/g, ' ');
}

export function normalizeComparable(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) {
    return value
      .map(normalizeComparable)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (typeof value === 'number') return Math.round(value * 1_000_000) / 1_000_000;
  if (typeof value === 'string') {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    if (/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(trimmed)) return trimmed.slice(0, 10);
    return trimmed;
  }
  return value;
}

export function differingFields(
  actual: Record<string, unknown>,
  expected: Record<string, unknown>,
  fields: string[],
  options: { ignoreEmptyExpected?: boolean } = {},
): string[] {
  const ignoreEmptyExpected = options.ignoreEmptyExpected ?? true;
  return fields.filter((field) => {
    const expectedValue = expected[field];
    if (ignoreEmptyExpected && (expectedValue === null || expectedValue === undefined || expectedValue === '')) return false;
    return JSON.stringify(normalizeComparable(actual[field])) !== JSON.stringify(normalizeComparable(expectedValue));
  });
}

export function duplicateNormalizedKeys<T>(rows: T[], key: (row: T) => string): string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const normalized = key(row);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

export function treatmentKey(cuit: unknown, code: unknown, method: unknown): string {
  return `${normalizeCuit(cuit)}|${String(code ?? '').trim().toUpperCase()}|${String(method ?? '').replace(/\s+/g, ' ').trim()}`;
}

export function classifyActorRoleLink(input: {
  actorRole: ActorRole;
  actorCuit: string;
  userRole: ActorRole | string | null | undefined;
  userId: string | null | undefined;
  counterparts: ActorRoleRecord[];
}): RoleLinkStatus {
  if (input.userRole === input.actorRole) return 'MATCHED';
  if (!input.userRole || !input.userId) return 'UNBACKED';

  const counterpart = input.counterparts.find((candidate) => (
    candidate.role === input.userRole
    && normalizeCuit(candidate.cuit) === normalizeCuit(input.actorCuit)
    && candidate.userId === input.userId
  ));
  if (!counterpart) return 'UNBACKED';
  return counterpart.active ? 'MULTIROLE_ACTIVE' : 'MULTIROLE_INACTIVE';
}
