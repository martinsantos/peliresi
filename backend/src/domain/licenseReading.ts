export type LicenseFields = Partial<Record<'nombre' | 'apellido' | 'dni' | 'licencia' | 'vencimiento', string>>;

/** Conservative proposals from explicit labels, not identity or validity proof. */
export function licenseFields(text: string): LicenseFields {
  const lines = text.slice(0, 48_000).split(/[\r\n]+/).map(line => line.trim()).filter(Boolean);
  const labels = {
    apellido: /^(?:\d[a-z]?\.?\s*)?apellidos?\s*[:.-]?\s*(.*)$/i,
    nombre: /^(?:\d[a-z]?\.?\s*)?nombres?\s*[:.-]?\s*(.*)$/i,
    dni: /^(?:\d[a-z]?\.?\s*)?(?:d\.?n\.?i\.?|(?:nro\.?|n[úu]mero)\s+(?:de\s+)?documento)\s*[:.-]?\s*(.*)$/i,
    licencia: /^(?:\d[a-z]?\.?\s*)?(?:(?:nro\.?|n[úu]mero|n[º°])\s+(?:de\s+)?licencia|licencia\s+(?:nro\.?|n[úu]mero|n[º°]))\s*[:.-]?\s*(.*)$/i,
    vencimiento: /^(?:\d[a-z]?\.?\s*)?(?:vencimiento|vence|v[áa]lid[oa]\s+hasta|fecha\s+de\s+vencimiento)\s*[:.-]?\s*(.*)$/i,
  };
  const result: LicenseFields = {};
  for (const [field, label] of Object.entries(labels)) {
    const proposals: string[] = [];
    for (let index = 0; index < lines.length; index++) {
      const match = lines[index].match(label); if (!match) continue;
      let value = (match[1] || lines[index + 1] || '').trim();
      if (!value || value.length > 100 || Object.values(labels).some(other => other.test(value))) continue;
      if (field === 'dni') { value = value.replace(/[.\s-]/g, ''); if (!/^\d{6,9}$/.test(value)) continue; }
      else if (field === 'vencimiento') {
        const date = value.match(/^(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.](\d{1,2})[/.](\d{4}))(?:\s|$)/);
        if (!date) continue;
        value = date[1] ? `${date[1]}-${date[2]}-${date[3]}` : `${date[6]}-${date[5].padStart(2, '0')}-${date[4].padStart(2, '0')}`;
        const parsed = new Date(`${value}T00:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) continue;
      } else if (field === 'licencia') { if (!/^[\p{L}\d ./-]{1,40}$/u.test(value) || !/\d/.test(value)) continue; }
      else if (!/^[\p{L} '\u2019-]+$/u.test(value)) continue;
      proposals.push(value);
    }
    const unique = [...new Set(proposals)];
    if (unique.length === 1) result[field as keyof LicenseFields] = unique[0];
  }
  return result;
}
