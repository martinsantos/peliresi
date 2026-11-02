import PDFDocument from 'pdfkit';
import { drawInstitutionalMasthead, drawInstitutionalRule, loadInspectionPdfBranding, type InspectionPdfBranding } from './inspectionPdfBranding.service';
import { inspectionPdfLines, drawInspectionPdfBlocks } from './inspectionPdfLayout.service';
import { syntheticPreviewEnabled } from '../config/syntheticPreview';
import { PRACTICE_PDF_NOTICE } from './syntheticPreviewPdf.service';

export const PDF_STYLE = { green: '#1B5E3C', ink: '#172C24', muted: '#526359', line: '#DCE5DF', light: '#F3F7F4' };

type Structure = PDFKit.PDFStructureElement;

function artifact(doc: PDFKit.PDFDocument, draw: () => void, type: 'Layout' | 'Pagination' = 'Layout') {
  doc.markContent('Artifact', { type });
  try { draw(); } finally { doc.endMarkedContent(); }
}

function marked(doc: PDFKit.PDFDocument, parent: Structure, tag: string, draw: () => void) {
  const content = doc.markStructureContent(tag);
  parent.add(content);
  try { draw(); } finally { doc.endMarkedContent(); }
}

function element(doc: PDFKit.PDFDocument, parent: Structure, tag: string, draw: () => void, options: { alt?: string; actual?: string } = {}) {
  const child = doc.struct(tag, options);
  parent.add(child);
  try { marked(doc, child, tag, draw); } finally { child.end(); }
}

/** Shared page identity; no tiles, no recoloring of signed or stored documents. */
export function documentHeader(doc: PDFKit.PDFDocument, title: string, reference: string, page: number, branding?: InspectionPdfBranding, notice?: string, structure?: Structure) {
  const { x, y } = doc;
  // Footer sits outside the body. Prevent PDFKit from creating a page while drawing it.
  const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
  doc.save();
  const masthead = () => drawInstitutionalMasthead(doc, branding, 44, 28);
  if (structure && page === 1) element(doc, structure, 'Figure', masthead, {
    alt: 'Gobierno de Mendoza, Dirección General de Fiscalización Ambiental. SITREP, Sistema de Trazabilidad de Residuos Peligrosos.',
  });
  else if (structure) artifact(doc, masthead, 'Pagination');
  else masthead();
  if (structure) artifact(doc, () => drawInstitutionalRule(doc, 44, 83, 507));
  else drawInstitutionalRule(doc, 44, 83, 507);
  const visibleNotice = syntheticPreviewEnabled() ? PRACTICE_PDF_NOTICE : notice;
  if (visibleNotice) {
    const background = () => { doc.roundedRect(44, 88, 507, 17, 3).fill('#FEF3C7'); };
    const noticeText = () => { doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#78350F')
      .text(visibleNotice, 52, 92, { width: 491, lineBreak: false }); };
    if (structure) {
      artifact(doc, background);
      if (page === 1) element(doc, structure, 'P', noticeText, { actual: visibleNotice });
      else artifact(doc, noticeText, 'Pagination');
    } else { background(); noticeText(); }
  }
  const footer = () => {
    doc.moveTo(44, 792).lineTo(551, 792).lineWidth(0.5).strokeColor(PDF_STYLE.line).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(PDF_STYLE.muted).text(reference, 44, 804, { width: 430, lineBreak: false });
    doc.text('Página ' + page, 484, 804, { width: 67, align: 'right', lineBreak: false });
  };
  if (structure) artifact(doc, footer, 'Pagination'); else footer();
  doc.restore(); doc.page.margins.bottom = bottom; doc.x = x; doc.y = y;
}
export async function institutionalPdf(title: string, reference: string, render: (layout: DocumentLayout) => void, date = new Date(), options: { notice?: string } = {}): Promise<Buffer> {
  const branding = await loadInspectionPdfBranding();
  const doc = new PDFDocument({ size: 'A4', margins: { top: 110, bottom: 62, left: 44, right: 44 },
    pdfVersion: '1.5', tagged: true, lang: 'es-AR', displayTitle: true,
    info: { Title: title + ' · ' + reference, Author: 'SITREP · Mendoza', CreationDate: date } });
  const chunks: Buffer[] = [];
  const ready = new Promise<Buffer>((resolve, reject) => { doc.on('data', b => chunks.push(b)); doc.on('error', reject); doc.on('end', () => resolve(Buffer.concat(chunks))); });
  const structure = doc.struct('Document');
  doc.addStructure(structure);
  let page = 0;
  const header = () => { documentHeader(doc, title, reference, ++page, branding, options.notice, structure); doc.x = 44; doc.y = 110; };
  doc.on('pageAdded', header); header();
  render(new DocumentLayout(doc, structure));
  doc.end(); return ready;
}
export class DocumentLayout {
  readonly bottom = 770;
  constructor(public doc: PDFKit.PDFDocument, private structure: Structure) {}
  ensure(height: number) { if (this.doc.y + height > this.bottom) this.doc.addPage(); }
  text(value: unknown, bold = false, size = 10, color = PDF_STYLE.ink, tag: 'P' | 'H1' = 'P') {
    const doc = this.doc;
    const text = String(value ?? 'No informado');
    const paragraph: { current?: Structure } = {};
    drawInspectionPdfBlocks(doc, [{ text, font: bold ? 'Helvetica-Bold' : 'Helvetica', size, color, gap: 7 }],
      { x: 44, width: 507, bottom: this.bottom, newPage: () => { doc.addPage(); }, continuation: 'Continuación',
        drawLine: draw => {
          if (!paragraph.current) { paragraph.current = doc.struct(tag, { actual: text }); this.structure.add(paragraph.current); }
          marked(doc, paragraph.current, tag, draw);
        },
        drawContinuation: draw => artifact(doc, draw, 'Pagination'),
      });
    paragraph.current?.end();
  }
  section(title: string, minimumHeight = 65) {
    this.ensure(minimumHeight); const doc = this.doc, y = doc.y + 7;
    artifact(doc, () => { doc.rect(44, y, 507, 23).fill(PDF_STYLE.light); });
    element(doc, this.structure, 'H2', () => { doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_STYLE.green).text(title, 53, y + 7, { lineBreak: false }); }, { actual: title });
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
      const value = String(c.value || 'No informado');
      const field = doc.struct('P', { actual: c.label + ': ' + value }); this.structure.add(field);
      marked(doc, field, 'P', () => { doc.font('Helvetica').fontSize(7).fillColor(PDF_STYLE.muted).text(c.label.toUpperCase(), x, y, { width: width - 18 }); });
      marked(doc, field, 'P', () => { doc.font('Helvetica').fontSize(9).fillColor(PDF_STYLE.ink).text(value, x, y + 12, { width: width - 18 }); });
      field.end();
    }); doc.x = 44; doc.y = y + height;
  }
  figure(alt: string, draw: () => void) { element(this.doc, this.structure, 'Figure', draw, { alt }); }
  decorative(draw: () => void) { artifact(this.doc, draw); }
  table(headers: string[], rows: string[][], widths: number[]) {
    const doc = this.doc;
    const table = doc.struct('Table'); this.structure.add(table);
    let headerAdded = false;
    const head = () => {
      this.ensure(48); const y = doc.y;
      artifact(doc, () => { doc.rect(44, y, 507, 23).fill(PDF_STYLE.green); });
      const row = headerAdded ? undefined : doc.struct('TR');
      if (row) table.add(row);
      let x = 44;
      headers.forEach((v, i) => {
        const draw = () => { doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF').text(v, x + 8, y + 7, { width: widths[i] - 16, lineBreak: false }); };
        if (row) element(doc, row, 'TH', draw, { actual: v }); else artifact(doc, draw, 'Pagination');
        x += widths[i];
      });
      row?.end(); headerAdded = true; doc.y = y + 23;
    };
    head();
    rows.forEach((row, index) => {
      doc.font('Helvetica').fontSize(9);
      const lines = row.map((v, i) => inspectionPdfLines(doc, v, widths[i] - 16));
      const rowElement = doc.struct('TR'); table.add(rowElement);
      const cells = row.map(value => { const cell = doc.struct('TD', { actual: value }); rowElement.add(cell); return cell; });
      const count = Math.max(...lines.map(l => l.length)); let offset = 0;
      while (offset < count) {
        if (doc.y + 30 > this.bottom) { doc.addPage(); head(); }
        const available = Math.max(1, Math.floor((this.bottom - doc.y - 16) / 12));
        // Ordinary rows stay together; exceptionally long descriptions continue with their identity.
        if (offset === 0 && count < 45 && count > available) { doc.addPage(); head(); continue; }
        const take = Math.min(count - offset, available), y = doc.y, height = take * 12 + 16;
        if (index % 2 === 0) artifact(doc, () => { doc.rect(44, y, 507, height).fill(PDF_STYLE.light); });
        let x = 44;
        lines.forEach((column, i) => {
          doc.font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(PDF_STYLE.ink);
          const segment = column.slice(offset, offset + take).join('\n');
          const continuation = !segment && offset > 0 && i === 0 ? row[0] + ' (cont.)' : '';
          const text = segment || continuation;
          if (text) {
            const draw = () => { doc.text(text, x + 8, y + 8, { width: widths[i] - 16, lineGap: 1.6 }); };
            if (continuation) artifact(doc, draw, 'Pagination'); else marked(doc, cells[i], 'TD', draw);
          }
          x += widths[i];
        });
        artifact(doc, () => { doc.moveTo(44, y + height).lineTo(551, y + height).lineWidth(0.4).strokeColor(PDF_STYLE.line).stroke(); });
        doc.x = 44; doc.y = y + height; offset += take;
      }
      cells.forEach(cell => cell.end()); rowElement.end();
    }); table.end(); doc.y += 10;
  }
}
