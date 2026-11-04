import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const BRAND = {
  green: '#1B5E3C',
  accent: '#1B5E3C',
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
  const source = [...brandingAssetCandidates('mendoza-marca-horizontal-transparente.png'), ...brandingAssetCandidates('gobierno-mendoza.webp')]
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
  const width = options.width ?? (compact ? 126 : 280);
  const glyph = compact ? 22 : 36;
  const textX = x + glyph + (compact ? 6 : 11);
  const primaryInk = inverse ? BRAND.white : BRAND.green;
  doc.save().translate(x, y + (compact ? 0 : 1)).scale(glyph / 100);
  for (const angle of [0, 120, 240]) {
    doc.save().rotate(angle, { origin: [50, 50] })
      .path('M36.319 12.412A40 40 0 0 1 80.642 24.288L86.77 19.146L83.483 44.096L65.321 37.144L71.449 32.002A28 28 0 0 0 40.423 23.689Z')
      .fill(BRAND.green).restore();
  }
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(compact ? 20 : 22).fillColor(primaryInk)
    .text('SITREP', textX, y + (compact ? 2 : 0), { width: width - (textX - x), lineBreak: false });
  if (!compact) doc.font('Helvetica').fontSize(9).fillColor(BRAND.muted)
    .text('Trazabilidad de residuos peligrosos', textX, y + 27, { width: width - (textX - x), lineBreak: false });

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

/** Same two equal identity cells as the mail masthead, scaled to the printable width. */
export function drawInstitutionalMasthead(doc: PDFKit.PDFDocument, branding: InspectionPdfBranding | undefined, left = 44, top = 24, width = 507) {
  const { x, y } = doc;
  const scale = width / 600, half = width / 2;
  const padding = 12 * scale, markWidth = 100 * scale, gap = 12 * scale;
  const rowHeight = 56 * scale;
  const textWidth = half - padding * 2 - markWidth - gap;
  drawMendozaMark(doc, branding || { gobiernoMendoza: null }, left + padding, top + (rowHeight - 32 * scale) / 2, markWidth, 32 * scale);
  const textTop = top + (rowHeight - 30 * scale) / 2;
  doc.markContent('Span', { actual: 'Dirección General de Fiscalización Ambiental' });
  doc.font('Helvetica').fontSize(12 * scale).fillColor('#344C41')
    .text('Dirección General de', left + padding + markWidth + gap, textTop, { width: textWidth, lineBreak: false })
    .text('Fiscalización Ambiental', left + padding + markWidth + gap, textTop + 15 * scale, { width: textWidth, lineBreak: false });
  doc.endMarkedContent();
  doc.save().translate(left + half + padding, top + (rowHeight - 26 * scale) / 2).scale(scale);
  drawSitrepMark(doc, 0, 0, { compact: true, width: 112 });
  doc.restore();
  const referenceX = left + half + padding + markWidth + gap;
  doc.markContent('Span', { actual: 'Sistema de Trazabilidad de Residuos Peligrosos' });
  doc.font('Helvetica').fontSize(12 * scale).fillColor('#344C41')
    .text('Sistema de Trazabilidad de', referenceX, textTop, { width: textWidth, lineBreak: false })
    .text('Residuos Peligrosos', referenceX, textTop + 15 * scale, { width: textWidth, lineBreak: false });
  doc.endMarkedContent();
  doc.x = x; doc.y = y;
}

/** Blue institutional half and green product half, as in the email header. */
export function drawInstitutionalRule(doc: PDFKit.PDFDocument, left: number, y: number, width: number) {
  doc.moveTo(left, y).lineTo(left + width / 2, y).lineWidth(1.5).strokeColor('#174A7E').stroke();
  doc.moveTo(left + width / 2, y).lineTo(left + width, y).lineWidth(1.5).strokeColor(BRAND.accent).stroke();
}
