/** Keep PostgreSQL bigint diagnostics exact without changing business counts. */
export function evidenceJson(value: unknown): string {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
}
