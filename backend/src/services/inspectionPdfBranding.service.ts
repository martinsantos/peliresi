import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRAND = {
  green: '#1B5E3C',
  accent: '#0D8A4F',
  navy: '#10213A',
  muted: '#5E6B7F',
  white: '#FFFFFF',
};

export type InspectionPdfBranding = {
  gobiernoMendoza: Buffer | null;
};

let brandingPromise: Promise<InspectionPdfBranding> | null = null;

function brandingAssetCandidates(filename: string): string[] {
  return [
    path.resolve(__dirname, '../assets/branding', filename),
    path.resolve(__dirname, '../../assets/branding', filename),
    path.resolve(process.cwd(), 'assets/branding', filename),
    path.resolve(process.cwd(), 'dist/assets/branding', filename),
  ];
}

async function loadMendozaWordmark(): Promise<Buffer | null> {
  const source = brandingAssetCandidates('gobierno-mendoza.webp')
    .find((candidate) => fs.existsSync(candidate));
  if (!source) return null;

  return sharp(source)
    .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .resize({ width: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export function loadInspectionPdfBranding(): Promise<InspectionPdfBranding> {
  if (!brandingPromise) {
    brandingPromise = loadMendozaWordmark()
      .then((gobiernoMendoza) => ({ gobiernoMendoza }));
  }
  return brandingPromise;
}

/**
 * Product mark used by the SITREP application: green cycle geometry,
 * unboxed glyph and wordmark. It is drawn as vectors so it remains sharp in
 * print and does not depend on a browser asset bundle.
 */
export function drawSitrepMark(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  options: { compact?: boolean; inverse?: boolean; width?: number } = {},
): void {
  const compact = options.compact ?? false;
  const inverse = options.inverse ?? false;
  const width = options.width ?? (compact ? 126 : 176);
  const glyph = compact ? 24 : 38;
  const textX = x + glyph + (compact ? 8 : 10);
  const primaryInk = inverse ? BRAND.white : BRAND.green;
  doc.save().translate(x, y + (compact ? 0 : 2)).scale(glyph / 100);
  for (const angle of [0, 120, 240]) {
    doc.save().rotate(angle, { origin: [50, 50] })
      .path('M36.319 12.412A40 40 0 0 1 80.642 24.288L86.77 19.146L83.483 44.096L65.321 37.144L71.449 32.002A28 28 0 0 0 40.423 23.689Z')
      .fill(BRAND.green).restore();
  }
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(compact ? 15 : 20).fillColor(primaryInk)
    .text('SITREP', textX, y + (compact ? 5 : 0), { width: width - (textX - x), lineBreak: false });
  if (!compact) doc.font('Helvetica').fontSize(8.5).fillColor(BRAND.muted)
    .text('Trazabilidad de residuos', textX, y + 26, { width: width - (textX - x), lineBreak: false })
    .text('peligrosos', textX, y + 37, { width: width - (textX - x), lineBreak: false });
}

export function drawMendozaMark(
  doc: PDFKit.PDFDocument,
  branding: InspectionPdfBranding,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  if (branding.gobiernoMendoza) {
    doc.image(branding.gobiernoMendoza, x, y, {
      fit: [width, height],
      valign: 'center',
    });
    return;
  }

  // A missing packaged asset must remain visible in a degraded deployment;
  // never leave an anonymous blank where the issuing authority belongs.
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND.navy)
    .text('MENDOZA', x, y + 2, { width, lineBreak: false });
  doc.font('Helvetica').fontSize(5.5).fillColor(BRAND.muted)
    .text('GOBIERNO DE LA PROVINCIA', x, y + 16, { width, lineBreak: false });
}

/** Equal visual heights, fixed margins and readable descriptors on every document. */
export function drawInstitutionalMasthead(doc: PDFKit.PDFDocument, branding: InspectionPdfBranding | undefined, left = 44, top = 24, width = 507) {
  const { x, y } = doc;
  drawMendozaMark(doc, branding || { gobiernoMendoza: null }, left, top, 122, 56);
  drawSitrepMark(doc, left + width - 218, top + 4, { width: 218 });
  doc.x = x; doc.y = y;
}
