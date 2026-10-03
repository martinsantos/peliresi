/** Presentation only. Never use this label to authorize an action or route. */
export function inspectionContextLabel(
  user: { esInspector?: boolean },
  pathname: string,
): 'Inspector' | null {
  return user.esInspector && /^\/(?:app\/|mobile\/|v6\/)?inspecciones(?:\/|$)/.test(pathname)
    ? 'Inspector'
    : null;
}
