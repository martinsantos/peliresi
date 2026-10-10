export type LicenseFields = Partial<Record<'nombre' | 'apellido' | 'dni' | 'licencia' | 'vencimiento', string>>;

function calendarDate(value: string): string | undefined {
  const match = value.match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}))(?:\s|$)/);
  if (!match) return;
  const date = match[1] ? `${match[1]}-${match[2]}-${match[3]}` : `${match[6]}-${match[5].padStart(2, '0')}-${match[4].padStart(2, '0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : undefined;
}

/** Conservative proposals from explicit labels, not identity or validity proof. */
export function licenseFields(text: string): LicenseFields {
  const lines = text.slice(0, 48_000).split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
  const labels = {
    apellido: /^(?:\d[a-z]?\.?\s*)?apellidos?\s*[:.-]?\s*(.*)$/i,
    nombre: /^(?:\d[a-z]?\.?\s*)?nombres?\s*[:.-]?\s*(.*)$/i,
    dni: /^(?:\d[a-z]?\.?\s*)?(?:d\.?n\.?i\.?|d\.?u\.?|documento\s+[úu]nico|(?:nro\.?|n[úu]mero)\s+(?:de\s+)?documento)\s*[:.-]?\s*(.*)$/i,
    licencia: /^(?:\d[a-z]?\.?\s*)?(?:(?:nro\.?|n[úu]mero|n[º°])\s+(?:de\s+)?licencia|licencia\s+(?:nro\.?|n[úu]mero|n[º°]))\s*[:.-]?\s*(.*)$/i,
    vencimiento: /^(?:\d[a-z]?\.?\s*)?(?:vencimiento|vence|v[áa]lid[oa]\s+hasta|fecha\s+de\s+vencimiento)\s*[:.-]?\s*(.*)$/i,
  };
  const provincial: Record<string, string[]> = {};
  const add = (field: string, value: string) => { (provincial[field] ||= []).push(value); };
  for (let index = 0; index < lines.length; index++) {
    // The old provincial card explicitly captions "SURNAME, GIVEN NAMES" below
    // its value. A comma alone, an address or a reverse never supplies names.
    if (/^(?:[¿¡|>*]\s*)?documento\s*,?\s*apellido\s+y\s+nombre$/i.test(lines[index])) {
      const name = lines[index - 1]?.match(/^([\p{L} '\u2019-]+),\s*([\p{L} '\u2019-]+)$/u);
      if (name) {
        if (name[1].trim().length <= 100) add('apellido', name[1].trim());
        if (name[2].trim().length <= 100) add('nombre', name[2].trim());
      }
    }
    const expiry = lines[index].match(labels.vencimiento);
    if (expiry && !expiry[1]) {
      const previous = lines[index - 1];
      if (previous && /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})$/.test(previous)) {
        add('vencimiento', previous);
      }
    }
    // A single three-date row is usable only with the complete ordered caption.
    // Otherwise there is no evidence that a birth/issue date is the expiry.
    if (/^nacimiento\s+expedici[oó]n\s+(?:v\.?h\.?f\.?\s+)?vencimiento$/i.test(lines[index])) {
      const previous = lines[index - 1] || '';
      const dates = previous.match(/(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/g);
      if (dates?.length === 3 && dates.every(date => calendarDate(date)) && previous.replace(/(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4})/g, '').trim() === '') {
        add('vencimiento', dates[2]);
      }
    }
  }
  const result: LicenseFields = {};
  for (const [field, label] of Object.entries(labels)) {
    const proposals: string[] = (provincial[field] || []).map(value => field === 'vencimiento' ? calendarDate(value) : value).filter((value): value is string => Boolean(value));
    for (let index = 0; index < lines.length; index++) {
      const match = lines[index].match(label); if (!match) continue;
      let value = (match[1] || lines[index + 1] || '').trim();
      if (!value || value.length > 100 || Object.values(labels).some(other => other.test(value))) continue;
      if (field === 'dni') { value = value.replace(/[.\s-]/g, ''); if (!/^\d{6,9}$/.test(value)) continue; }
      else if (field === 'vencimiento') {
        const date = calendarDate(value); if (!date) continue; value = date;
      } else if (field === 'licencia') { if (!/^[\p{L}\d ./-]{1,40}$/u.test(value) || !/\d/.test(value)) continue; }
      else if (!/^[\p{L} '\u2019-]+$/u.test(value)) continue;
      proposals.push(value);
    }
    const unique = [...new Set(proposals)];
    if (unique.length === 1) result[field as keyof LicenseFields] = unique[0];
  }
  return result;
}
