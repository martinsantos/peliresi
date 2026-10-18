export function prismaConnectionUrl(raw: string): string {
  const url = new URL(raw);
  for (const [key, fallback, minimum] of [['connection_limit', 20, 1], ['pool_timeout', 10, 0]] as const) {
    const existing = url.searchParams.get(key);
    if (existing === null) url.searchParams.set(key, String(fallback));
    else if (!/^\d+$/.test(existing) || !Number.isSafeInteger(Number(existing)) || Number(existing) < minimum) {
      throw new Error(`Invalid database pool parameter: ${key}`);
    }
  }
  return url.toString();
}
