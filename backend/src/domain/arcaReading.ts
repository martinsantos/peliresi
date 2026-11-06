import { verifiedCuit } from './conciliacionExterna';

/** Report only explicitly labelled values. Multiple distinct candidates need human review. */
export function arcaReading(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const cuits = new Set<string>();
  const names = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const next = lines[index + 1] ?? '';
    const cuit = line.match(/\bC\.?U\.?I\.?T\.?\s*[:º°-]?\s*(.*)$/i);
    if (cuit) {
      const digits = (cuit[1] || next).match(/^(\d{2}[ -]?\d{8}[ -]?\d)\b/);
      const valid = digits && verifiedCuit(digits[1].replace(/ /g, ''));
      if (valid) cuits.add(valid);
    }
    const name = line.match(/^(?:raz[oó]n social|denominaci[oó]n|apellido y nombres?)\s*:\s*(.*)$/i);
    if (name) {
      const value = (name[1] || next).trim();
      if (value && !value.includes(':') && /\p{L}/u.test(value)) names.add(value);
    }
  }
  return { cuit: cuits.size === 1 ? [...cuits][0] : null, razonSocial: names.size === 1 ? [...names][0] : null };
}
