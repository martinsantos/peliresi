/** Presentation only. Never use this label to authorize an action or route. */
export function inspectionContextLabel(
  user: { esInspector?: boolean; rol?: string },
  pathname: string,
): 'Inspector' | null {
  // An administrator retains their account identity outside an inspection.
  if (user.rol?.startsWith('ADMIN') && !/^\/(?:app\/|mobile\/|v6\/)?inspecciones(?:\/|$)/.test(pathname)) return null;
  return user.esInspector && /^\/(?:app\/|mobile\/|v6\/)?(?:inspecciones(?:\/|$)|(?:dashboard|centro-control|monitor|actores)\/?$)/.test(pathname)
    ? 'Inspector'
    : null;
}
