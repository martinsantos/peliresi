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

const mendozaCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Inclusive civil days in Mendoza. days=0 keeps the query unfiltered. */
export function computeDateRange(days: number, now = new Date()): { desde: string; hasta: string } {
  if (days === 0) return { desde: '', hasta: '' };
  const parts = mendozaCalendar.formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  // UTC is used only for arithmetic on date keys, not to choose Mendoza's day.
  const first = new Date(Date.parse(today + 'T00:00:00Z') - (days - 1) * 86400000);
  return {
    desde: first.toISOString().slice(0, 10),
    hasta: today,
  };
}
