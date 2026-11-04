/** JSONB can reorder nested keys; semantic draft equality must not depend on wire order. */
export function canonicalInspectionValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalInspectionValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalInspectionValue(item)]));
  return value;
}
