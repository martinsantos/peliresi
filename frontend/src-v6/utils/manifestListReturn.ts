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

/** Home is an explicit origin. Reject cross-surface and external destinations. */
export function manifestWorkspaceReturn(state: unknown, listPath: string): {path:string; label:string} {
  const homePath = listPath.replace(/\/manifiestos$/, '/dashboard');
  const value = (state as {manifestHomeReturn?:unknown} | null)?.manifestHomeReturn;
  if (typeof value === 'string' && value.length <= 4000) {
    try {
      const url = new URL(value, 'https://sitrep.invalid');
      if (url.origin === 'https://sitrep.invalid' && url.pathname === homePath)
        return {path:homePath+url.search, label:'Inicio'};
    } catch { /* Use the validated list origin below. */ }
  }
  return {path:manifestListReturn(state,listPath),label:'Manifiestos'};
}
