import PDFDocument from 'pdfkit';
import { drawInstitutionalMasthead, drawInstitutionalRule, loadInspectionPdfBranding, type InspectionPdfBranding } from './inspectionPdfBranding.service';
import { inspectionPdfLines, drawInspectionPdfBlocks } from './inspectionPdfLayout.service';

export const PDF_STYLE = { green: '#1B5E3C', ink: '#172C24', muted: '#526359', line: '#DCE5DF', light: '#F3F7F4' };
/** Shared page identity; no tiles, no recoloring of signed or stored documents. */
export function documentHeader(doc: PDFKit.PDFDocument, title: string, reference: string, page: number, branding?: InspectionPdfBranding, notice?: string) {
  const { x, y } = doc;
  // Footer sits outside the body. Prevent PDFKit from creating a page while drawing it.
  const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
  doc.save();
  drawInstitutionalMasthead(doc, branding, 44, 28);
  drawInstitutionalRule(doc, 44, 83, 507);
  if (notice) {
    doc.roundedRect(44, 88, 507, 17, 3).fill('#FEF3C7');
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#78350F')
      .text(notice, 52, 92, { width: 491, lineBreak: false });
  }
  doc.moveTo(44, 792).lineTo(551, 792).lineWidth(0.5).strokeColor(PDF_STYLE.line).stroke();
  doc.font('Helvetica').fontSize(7).fillColor(PDF_STYLE.muted).text(reference, 44, 804, { width: 430, lineBreak: false });
  doc.text('Página ' + page, 484, 804, { width: 67, align: 'right', lineBreak: false });
  doc.restore(); doc.page.margins.bottom = bottom; doc.x = x; doc.y = y;
}
export async function institutionalPdf(title: string, reference: string, render: (layout: DocumentLayout) => void, date = new Date(), options: { notice?: string } = {}): Promise<Buffer> {
  const branding = await loadInspectionPdfBranding();
  const doc = new PDFDocument({ size: 'A4', margins: { top: 110, bottom: 62, left: 44, right: 44 },
    info: { Title: title + ' · ' + reference, Author: 'SITREP · Mendoza', CreationDate: date } });
  const chunks: Buffer[] = [];
  const ready = new Promise<Buffer>((resolve, reject) => { doc.on('data', b => chunks.push(b)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks))); });
  let page = 0;
  const header = () => { documentHeader(doc, title, reference, ++page, branding, options.notice); doc.x = 44; doc.y = 110; };
  doc.on('pageAdded', header); header();
  render(new DocumentLayout(doc));
  doc.end(); return ready;
}
export class DocumentLayout {
  readonly bottom = 770;
  constructor(public doc: PDFKit.PDFDocument) {}
  ensure(height: number) { if (this.doc.y + height > this.bottom) this.doc.addPage(); }
  text(value: unknown, bold = false, size = 10, color = PDF_STYLE.ink) {
    const doc = this.doc;
    drawInspectionPdfBlocks(doc, [{ text: String(value ?? 'No informado'), font: bold ? 'Helvetica-Bold' : 'Helvetica', size, color, gap: 7 }],
      { x: 44, width: 507, bottom: this.bottom, newPage: () => { doc.addPage(); }, continuation: 'Continuación' });
  }
  section(title: string, minimumHeight = 65) {
    this.ensure(minimumHeight); const doc = this.doc, y = doc.y + 7;
    doc.rect(44, y, 507, 23).fill(PDF_STYLE.light);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_STYLE.green).text(title, 53, y + 7, { lineBreak: false });
    doc.y = y + 33;
  }
  fields(cells: Array<{ label: string; value: unknown }>) {
    const doc = this.doc, width = 507 / cells.length;
    const heights = cells.map(c => { doc.font('Helvetica').fontSize(9); return inspectionPdfLines(doc, String(c.value || 'No informado'), width - 18).length * 12 + 18; });
    const height = Math.max(...heights);
    if (height > this.bottom - 110) { cells.forEach(c => { this.text(c.label, true, 8, PDF_STYLE.muted); this.text(c.value, false, 9); }); return; }
    this.ensure(height); const y = doc.y;
    cells.forEach((c, i) => {
      const x = 44 + width * i;
      doc.font('Helvetica').fontSize(7).fillColor(PDF_STYLE.muted).text(c.label.toUpperCase(), x, y, { width: width - 18 });
      doc.font('Helvetica').fontSize(9).fillColor(PDF_STYLE.ink).text(String(c.value || 'No informado'), x, y + 12, { width: width - 18 });
    }); doc.x = 44; doc.y = y + height;
  }
  table(headers: string[], rows: string[][], widths: number[]) {
    const doc = this.doc;
    const head = () => {
      this.ensure(48); const y = doc.y;
      doc.rect(44, y, 507, 23).fill(PDF_STYLE.green);
      let x = 44; headers.forEach((v, i) => { doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(v, x + 8, y + 7, { width: widths[i] - 16, lineBreak: false }); x += widths[i]; }); doc.y = y + 23;
    };
    head();
    rows.forEach((row, index) => {
      doc.font('Helvetica').fontSize(9);
      const lines = row.map((v, i) => inspectionPdfLines(doc, v, widths[i] - 16));
      const count = Math.max(...lines.map(l => l.length)); let offset = 0;
      while (offset < count) {
        if (doc.y + 30 > this.bottom) { doc.addPage(); head(); }
        const available = Math.max(1, Math.floor((this.bottom - doc.y - 16) / 12));
        // Ordinary rows stay together; exceptionally long descriptions continue with their identity.
        if (offset === 0 && count < 45 && count > available) { doc.addPage(); head(); continue; }
        const take = Math.min(count - offset, available), y = doc.y, height = take * 12 + 16;
        if (index % 2 === 0) doc.rect(44, y, 507, height).fill(PDF_STYLE.light);
        let x = 44;
        lines.forEach((column, i) => {
          doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(PDF_STYLE.ink);
          const text = column.slice(offset, offset + take).join('\n') || (offset > 0 && i === 0 ? row[0] + ' (cont.)' : '');
          if (text) doc.text(text, x + 8, y + 8, { width: widths[i] - 16, lineGap: 1.6 });
          x += widths[i];
        });
        doc.moveTo(44, y + height).lineTo(551, y + height).lineWidth(0.4).strokeColor(PDF_STYLE.line).stroke();
        doc.x = 44; doc.y = y + height; offset += take;
      }
    }); doc.y += 10;
  }
}
