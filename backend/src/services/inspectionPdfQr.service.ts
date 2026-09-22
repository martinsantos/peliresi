import QRCode from 'qrcode';
import {
  buildInspectionTracePresentation,
} from './inspectionTraceToken.service';

const COLORS = {
  green: '#1B5E3C',
  accent: '#0D8A4F',
  navy: '#10213A',
  muted: '#5E6B7F',
  line: '#CAD4DF',
  soft: '#F4F7F5',
  white: '#FFFFFF',
};

export type InspectionPdfQrPresentation = {
  token: string;
  url: string;
  image: Buffer;
};

/**
 * Generates the real QR embedded in inspection documents. The QR carries the
 * signed trace URL, never raw inspection JSON or a host supplied by a request.
 */
export async function buildInspectionPdfQr(inspection: { id: string; numero: string; version: number; fingerprint: string }): Promise<InspectionPdfQrPresentation> {
  const trace = buildInspectionTracePresentation({
    id: inspection.id,
    numero: inspection.numero,
    version: inspection.version,
    fingerprint: inspection.fingerprint,
  });
  const { token, url } = trace;
  const dataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 4,
    width: 480,
    color: { dark: COLORS.navy, light: COLORS.white },
  });
  const encoded = dataUrl.split(',')[1];
  if (!encoded) throw new Error('No se pudo generar el QR de trazabilidad');
  return { token, url, image: Buffer.from(encoded, 'base64') };
}

/** Draws a 36 mm-class verification card and a PDF link over both the QR and URL. */
export function drawInspectionPdfQrCard(
  doc: PDFKit.PDFDocument,
  qr: InspectionPdfQrPresentation,
  fingerprint: string,
  options: { x?: number; y?: number; width?: number; title?: string } = {},
): number {
  const x = options.x ?? 44;
  const y = options.y ?? doc.y;
  const width = options.width ?? doc.page.width - 88;
  const height = 127;
  const qrSize = 102; // 36 mm at 72 dpi, with a generous quiet zone.
  const title = options.title ?? 'VERIFICAR TRAZABILIDAD DE ESTA INSPECCIÓN';
  const textX = x + qrSize + 28;
  const textWidth = width - qrSize - 42;

  doc.save();
  doc.roundedRect(x, y, width, height, 6).fillAndStroke(COLORS.soft, COLORS.line);
  doc.restore();

  doc.image(qr.image, x + 10, y + 12, { width: qrSize, height: qrSize });
  doc.link(x + 10, y + 12, qrSize, qrSize, qr.url);
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(COLORS.green)
    .text(title, textX, y + 13, { width: textWidth, lineBreak: false });
  doc.font('Helvetica').fontSize(7.4).fillColor(COLORS.navy)
    .text('Escaneá el código para consultar el estado oficial y la trazabilidad pública del expediente.', textX, y + 29, { width: textWidth, lineGap: 1.5 });
  doc.font('Helvetica-Bold').fontSize(6.6).fillColor(COLORS.muted)
    .text('ENLACE OFICIAL DE VERIFICACIÓN', textX, y + 57, { width: textWidth, lineBreak: false });
  doc.font('Courier').fontSize(5.15).fillColor(COLORS.accent)
    .text(qr.url, textX, y + 68, { width: textWidth, lineGap: 1, link: qr.url, underline: true });
  doc.font('Helvetica-Bold').fontSize(6.6).fillColor(COLORS.muted)
    .text('HUELLA SHA-256 DEL EXPEDIENTE', textX, y + 98, { width: textWidth, lineBreak: false });
  doc.font('Courier').fontSize(5.7).fillColor(COLORS.navy)
    .text(fingerprint, textX, y + 108, { width: textWidth, lineBreak: false, link: qr.url });

  return y + height;
}
