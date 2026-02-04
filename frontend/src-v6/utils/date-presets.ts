/**
 * SITREP v6 - Date Presets (shared between CentroControl & Reportes)
 */

export const DATE_PRESETS = [
  { label: 'Ver Todos', days: 0 },
  { label: 'Hoy', days: 1 },
  { label: '3 días', days: 3 },
  { label: '7 días', days: 7 },
  { label: '15 días', days: 15 },
  { label: '30 días', days: 30 },
] as const;

/** days=0 → empty strings (no date filter, returns all data) */
export function computeDateRange(days: number): { desde: string; hasta: string } {
  if (days === 0) return { desde: '', hasta: '' };
  const d = new Date();
  d.setDate(d.getDate() - days);
  return {
    desde: d.toISOString().split('T')[0],
    hasta: new Date().toISOString().split('T')[0],
  };
}
