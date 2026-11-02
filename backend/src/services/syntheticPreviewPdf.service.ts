import { syntheticPreviewEnabled } from '../config/syntheticPreview';

export const PRACTICE_PDF_NOTICE = 'DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL';

/** Inspection PDFs reserve their bottom margin for page furniture. */
export function drawSyntheticPreviewFooter(doc: PDFKit.PDFDocument, footerY: number): void {
  if (!syntheticPreviewEnabled()) return;
  const { x, y } = doc;
  doc.save();
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#78350F')
    .text(PRACTICE_PDF_NOTICE, 44, footerY + 24, { width: doc.page.width - 88, align: 'center', lineBreak: false });
  doc.restore(); doc.x = x; doc.y = y;
}
