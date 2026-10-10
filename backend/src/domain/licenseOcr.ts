import { licenseFields, type LicenseFields } from './licenseReading';

/** Confidence is an engine score, never an identity/validity guarantee. */
export function confidentLicenseText(tsv: string): string {
  if (!tsv.startsWith('level\tpage_num\t')) throw new Error('INVALID_OCR_TSV');
  const lines = new Map<string, string[]>();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const cells = row.split('\t');
    if (cells[0] !== '5') continue;
    if (cells.length !== 12) throw new Error('INVALID_OCR_TSV');
    const confidence = Number(cells[10]), word = cells[11].trim();
    if (!word) continue;
    const key = cells.slice(1, 5).join(':');
    const accepted = Number.isFinite(confidence) && confidence >= 55 && confidence <= 100;
    // Removing an uncertain digit/name token could silently create a different
    // valid value. Keep a barrier instead; only stray punctuation can be dropped.
    if (!accepted && !/[\p{L}\p{N}]/u.test(word)) continue;
    const words = lines.get(key) || [];
    words.push(accepted ? word : '[?]'); lines.set(key, words);
  }
  return [...lines.values()].map(words => words.join(' ')).join('\n').slice(0, 48_000);
}

/** O(n), at most 1800² pixels; compensate local shadows without changing originals. */
export function adaptiveLicensePixels(pixels: Uint8Array, width: number, height: number): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width > 1800 || height > 1800 || pixels.length !== width * height) throw new Error('INVALID_OCR_RASTER');
  const stride = width + 1, integral = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += pixels[y * width + x];
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + row;
    }
  }
  const output = new Uint8Array(pixels.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const x0 = Math.max(0, x - 20), x1 = Math.min(width, x + 21);
    const y0 = Math.max(0, y - 20), y1 = Math.min(height, y + 21);
    const sum = integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
    output[y * width + x] = pixels[y * width + x] < sum / ((x1 - x0) * (y1 - y0)) - 15 ? 0 : 255;
  }
  return output;
}

/** Retain only labelled, non-conflicting proposals, never raw medical/address text. */
export function mergeLicenseText(reads: string[]): string {
  const candidates: Partial<Record<keyof LicenseFields, Set<string>>> = {};
  for (const text of reads) for (const [key, value] of Object.entries(licenseFields(text))) {
    (candidates[key as keyof LicenseFields] ||= new Set()).add(value);
  }
  const labels = { apellido: 'APELLIDO', nombre: 'NOMBRE', dni: 'DNI', licencia: 'NRO LICENCIA', vencimiento: 'VENCIMIENTO' };
  return (Object.keys(labels) as Array<keyof LicenseFields>)
    .filter(key => candidates[key]?.size === 1)
    .map(key => `${labels[key]}: ${[...candidates[key]!][0]}`).join('\n');
}
