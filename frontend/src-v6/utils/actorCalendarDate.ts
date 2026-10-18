// Expiry values originate from date-only form controls, not local instants.
// Keep their calendar day when displaying them on devices in other time zones.
const calendarFormat = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
});

export function formatActorCalendarDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? calendarFormat.format(date) : '—';
}
