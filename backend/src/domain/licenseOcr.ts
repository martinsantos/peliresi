import { licenseFields, type LicenseFields } from './licenseReading';

type LicenseWord = { text: string; confidence: number; left: number; top: number; width: number; height: number };

/** Recover only a WHOLE labelled word, never fragments or skipped uncertainty. */
function isolatedDni(words: LicenseWord[]): string | undefined {
  const isLabel = (word: LicenseWord) => /^(?:d\.?u\.?|d\.?n\.?i\.?)[:.-]?$/i.test(word.text);
  // Multiple labels on one OCR line are ambiguous; do not choose one identity.
  const labels = words.filter(isLabel);
  if (labels.length !== 1) return;
  const index = words.indexOf(labels[0]), label = words[index], value = words[index + 1];
  if (!value || !/^\d{6,9}$/.test(value.text)) return;
  // Spatial recovery is stricter than the established plain-line reader. Its
  // confidence floor (55) and uncertainty barriers remain unchanged below.
  if (![label, value].every(word => Number.isFinite(word.confidence) && word.confidence >= 80 && word.confidence <= 100)) return;
  const validBox = (word: LicenseWord) => [word.left, word.top, word.width, word.height].every(Number.isInteger)
    && word.left >= 0 && word.top >= 0 && word.width > 0 && word.height > 0
    && word.left + word.width <= 1800 && word.top + word.height <= 1800;
  if (!words.every(validBox)) return;
  const sameRow = (a: LicenseWord, b: LicenseWord) =>
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top) >= Math.min(a.height, b.height) * 0.6;
  const margin = Math.max(label.height, value.height) * 1.5;
  const gap = value.left - label.left - label.width;
  if (gap < 0 || gap > margin || !sameRow(label, value)) return;
  // An adjacent extra token may be part of the identifier, even at low engine
  // confidence. Only proven distant clutter may be outside the labelled region.
  if (words.some((word, position) => position !== index && position !== index + 1
    && sameRow(value, word) && word.left + word.width > label.left && word.left < value.left + value.width + margin)) return;
  return value.text;
}

/** Confidence is an engine score, never an identity/validity guarantee. */
export function confidentLicenseText(tsv: string): string {
  if (!tsv.startsWith('level\tpage_num\t')) throw new Error('INVALID_OCR_TSV');
  const lines = new Map<string, string[]>();
  const spatialLines = new Map<string, LicenseWord[]>();
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const cells = row.split('\t');
    if (cells[0] !== '5') continue;
    if (cells.length !== 12) throw new Error('INVALID_OCR_TSV');
    const confidence = Number(cells[10]), word = cells[11].trim();
    if (!word) continue;
    const key = cells.slice(1, 5).join(':');
    const tokens = spatialLines.get(key) || [];
    tokens.push({ text: word, confidence, left: Number(cells[6]), top: Number(cells[7]), width: Number(cells[8]), height: Number(cells[9]) });
    spatialLines.set(key, tokens);
    const accepted = Number.isFinite(confidence) && confidence >= 55 && confidence <= 100;
    // Removing an uncertain digit/name token could silently create a different
    // valid value. Keep a barrier instead; only stray punctuation can be dropped.
    if (!accepted && !/[\p{L}\p{N}]/u.test(word)) continue;
    const words = lines.get(key) || [];
    words.push(accepted ? word : '[?]'); lines.set(key, words);
  }
  const recovered = [...spatialLines.values()].map(isolatedDni).filter((value): value is string => Boolean(value));
  // Keep original uncertainty and every candidate so existing conflict checks
  // still reject different identities within a read or across native passes.
  return [...lines.values()].map(words => words.join(' ')).concat(recovered.map(value => `DNI: ${value}`)).join('\n').slice(0, 48_000);
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
