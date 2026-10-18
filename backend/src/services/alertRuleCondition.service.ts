const OPERATORS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']);

type Condition = Record<string, unknown>;

function valueAt(data: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, data);
}

function compare(actual: unknown, operator: string, expected: unknown): boolean {
  if (operator === 'eq') return actual === expected;
  if (operator === 'neq') return actual !== expected;
  if (operator === 'in') return Array.isArray(expected) && expected.includes(actual);
  if (operator === 'contains') return Array.isArray(actual) ? actual.includes(expected) : typeof actual === 'string' && actual.includes(String(expected));
  const left = typeof actual === 'number' ? actual : Number(actual);
  const right = typeof expected === 'number' ? expected : Number(expected);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (operator === 'gt') return left > right;
  if (operator === 'gte') return left >= right;
  if (operator === 'lt') return left < right;
  if (operator === 'lte') return left <= right;
  return false;
}

function validateCondition(condition: unknown, depth = 0): asserts condition is Condition {
  if (!condition || Array.isArray(condition) || typeof condition !== 'object' || depth > 4) throw new Error('La condición debe ser un objeto JSON válido.');
  const entries = Object.entries(condition as Condition);
  if (entries.length > 20) throw new Error('La condición tiene demasiados criterios.');
  for (const [field, expected] of entries) {
    if (field === 'all' || field === 'any') {
      if (!Array.isArray(expected) || expected.length === 0 || expected.length > 10) throw new Error(`${field} debe contener entre 1 y 10 condiciones.`);
      expected.forEach((child) => validateCondition(child, depth + 1));
      continue;
    }
    if (!/^[A-Za-z][A-Za-z0-9_.]*$/.test(field)) throw new Error(`Campo de condición no permitido: ${field}`);
    if (expected && !Array.isArray(expected) && typeof expected === 'object') {
      const operations = Object.entries(expected as Record<string, unknown>);
      if (operations.length !== 1 || !OPERATORS.has(operations[0][0])) throw new Error(`Operador no permitido para ${field}.`);
    }
  }
}

export function parseAlertCondition(raw: unknown): Condition {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); }
    catch { throw new Error('La condición no contiene JSON válido.'); }
  }
  validateCondition(parsed);
  return parsed;
}

export function normalizeAlertCondition(raw: unknown): string {
  return JSON.stringify(parseAlertCondition(raw));
}

export function matchesAlertCondition(raw: unknown, data: Record<string, unknown>): boolean {
  const condition = parseAlertCondition(raw);
  const evaluate = (node: Condition): boolean => Object.entries(node).every(([field, expected]) => {
    if (field === 'all') return (expected as Condition[]).every(evaluate);
    if (field === 'any') return (expected as Condition[]).some(evaluate);
    const actual = valueAt(data, field);
    if (expected && !Array.isArray(expected) && typeof expected === 'object') {
      const [operator, value] = Object.entries(expected as Record<string, unknown>)[0];
      return compare(actual, operator, value);
    }
    return compare(actual, 'eq', expected);
  });
  return evaluate(condition);
}
