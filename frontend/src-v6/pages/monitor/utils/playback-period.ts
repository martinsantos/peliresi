export function periodEnd(start: string, days: number): string {
  return new Date(new Date(start + 'T00:00:00Z').getTime() + (days - 1) * 86400000).toISOString().slice(0, 10);
}
export function recentPeriod(days: number, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Mendoza', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  return new Date(new Date(today + 'T00:00:00Z').getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
}
