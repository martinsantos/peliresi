/** Only accept a return to this surface's manifest list, never an arbitrary URL. */
export function manifestListReturn(state: unknown, listPath: string): string {
  const value = (state as { manifestListReturn?: unknown } | null)?.manifestListReturn;
  if (typeof value !== 'string' || value.length > 4000) return listPath;
  try {
    const url = new URL(value, 'https://sitrep.invalid');
    return url.origin === 'https://sitrep.invalid' && url.pathname === listPath
      ? listPath + url.search : listPath;
  } catch { return listPath; }
}
