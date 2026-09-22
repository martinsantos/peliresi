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
 * Product mark used by the SITREP application: institutional green tile,
 * leaf glyph and wordmark. It is drawn as vectors so it remains sharp in
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
  const tile = compact ? 21 : 29;
  const radius = compact ? 5 : 7;
  const textX = x + tile + (compact ? 7 : 9);
  const primaryInk = inverse ? BRAND.white : BRAND.navy;

  doc.save();
  doc.roundedRect(x, y, tile, tile, radius).fill(inverse ? BRAND.white : BRAND.green);
  doc.translate(x, y).scale(tile / 30);
  doc.path('M8.5 18.4 C9.7 12.1 14.6 8.5 22.9 7.1 C22.1 14.6 18.2 21.4 11.6 22.0 C9.7 22.2 8.0 20.5 8.5 18.4 Z')
    .lineWidth(1.55)
    .strokeColor(inverse ? BRAND.green : BRAND.white)
    .stroke();
  doc.path('M10.3 20.3 C13.5 16.4 16.6 13.4 21.0 10.1')
    .lineWidth(1.25)
    .strokeColor(inverse ? BRAND.green : BRAND.white)
    .stroke();
  doc.restore();

  doc.font('Helvetica-Bold')
    .fontSize(compact ? 10.2 : 14.4)
    .fillColor(primaryInk)
    .text('SITREP', textX, y + (compact ? 0.8 : 0), {
      width: width - (textX - x),
      lineBreak: false,
    });
  doc.font('Helvetica-Bold')
    .fontSize(compact ? 4.7 : 5.8)
    .fillColor(inverse ? BRAND.white : BRAND.accent)
    .text('TRAZABILIDAD DE RESIDUOS PELIGROSOS', textX, y + (compact ? 12.4 : 17.7), {
      width: width - (textX - x),
      characterSpacing: compact ? 0.12 : 0.2,
      lineBreak: false,
    });
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
