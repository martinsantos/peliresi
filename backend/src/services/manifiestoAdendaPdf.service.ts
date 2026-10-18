import PDFDocument from 'pdfkit';
import { addendumDocument } from '../domain/manifiestoAdendaDocument';
import { drawInspectionPdfBlocks, InspectionPdfTextBlock } from './inspectionPdfLayout.service';
import { drawMendozaMark, loadInspectionPdfBranding } from './inspectionPdfBranding.service';

// Informational versioned annex, not a replacement certificate or an authority signature.
export async function renderAddendumPdf(data: ReturnType<typeof addendumDocument>): Promise<Buffer> {
  const branding = await loadInspectionPdfBranding();
  const created = new Date(data.fechaRegistro);
  const doc = new PDFDocument({ size: 'A4', margins: { top: 110, bottom: 52, left: 44, right: 44 },
    info: { Title: 'Anexo de adenda ' + data.id + ' v' + data.version, Author: 'SITREP',
      CreationDate: created, ModDate: created }, compress: true });
  const chunks: Buffer[] = [];
  const ready = new Promise<Buffer>((resolve, reject) => { doc.on('data', c => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); });
  let page = 0;
  const header = () => {
    page++;
    drawMendozaMark(doc, branding, 44, 22, 128, 34);
    doc.save().translate(382, 24).scale(0.32);
    for (const angle of [0, 120, 240]) {
      doc.save().rotate(angle, { origin: [50, 50] })
        .path('M36.319 12.412A40 40 0 0 1 80.642 24.288L86.77 19.146L83.483 44.096L65.321 37.144L71.449 32.002A28 28 0 0 0 40.423 23.689Z')
        .fill('#1B5E3C').restore();
    }
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#1B5E3C').text('SITREP', 421, 28, { lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor('#4B5563').text('Sistema de Trazabilidad de Residuos Peligrosos', 44, 67, { lineBreak: false });
    doc.moveTo(44, 86).lineTo(551, 86).strokeColor('#1B5E3C').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#4B5563').text('Anexo informativo - v' + data.version + ' - Página ' + page, 44, 807, { lineBreak: false });
    doc.y = 108;
  };
  header();
  const declaration = data.declaracion as { numero: string; residuos: { corriente: string; cantidad: number; unidad: string }[] };
  const observed = data.residuos as { corriente: string; cantidad: number; unidad: string }[];
  const states: Record<string, string> = { PENDIENTE: 'PENDIENTE DE REVISIÓN', APROBADA: 'APROBADA POST FACTO', OBSERVADA: 'OBSERVADA', RECHAZADA: 'CONFORMIDAD RECHAZADA' };
  const blocks: InspectionPdfTextBlock[] = [];
  const text = (value: string, bold = false, size = 10, color = '#17231F') => blocks.push({ text: value, font: bold ? 'Helvetica-Bold' : 'Helvetica', size, color, gap: 6 });
  text('ANEXO DE ADENDA', true, 17, '#1B5E3C');
  text('Manifiesto ' + declaration.numero + ' - versión documental ' + data.version, true, 12);
  text(states[data.estado], true, 11);
  text('No reemplaza el manifiesto ni el certificado original. Registra diferencias y revisiones; no acredita por sí solo habilitación ni cierre documental.', false, 9, '#4B5563');
  text('Referencia: ' + data.id, false, 8); text('Registro: ' + data.fechaRegistro + ' | Autor: ' + data.creadoPorId, false, 8);
  if (data.impersonadoPorId) text('Administrador impersonante: ' + data.impersonadoPorId, false, 8);
  if (data.rectificaId) text('Rectifica la adenda ' + data.rectificaId + '. El antecedente se conserva.', false, 9);
  text('Motivo', true); text(data.motivo);
  text('DECLARACIÓN CONSERVADA', true, 11, '#1B5E3C');
  declaration.residuos.forEach(row => text(row.corriente + ' | ' + row.cantidad + ' ' + row.unidad));
  text('CARGA OBSERVADA COMPLETA', true, 11, '#1B5E3C');
  observed.forEach(row => text(row.corriente + ' | ' + row.cantidad + ' ' + row.unidad));
  text('Las cantidades observadas no se suman automáticamente a las declaradas. Compatibilidad de corrientes sin verificar.', false, 9, '#4B5563');
  text('REVISIONES INCLUIDAS EN ESTA VERSIÓN', true, 11, '#1B5E3C');
  if (!data.revisiones.length) text('Sin resolución. La continuidad operativa no implica aprobación.');
  data.revisiones.forEach((review, i) => { text('Revisión ' + (i + 1) + ': ' + states[review.decision], true);
    text(review.nota); text(review.fecha + ' | Revisor: ' + review.autorId + ' | Ref: ' + review.id, false, 8); });
  text('INTEGRIDAD DEL CONTENIDO', true, 10);
  text('SHA-256: ' + data.huella, false, 8);
  text('Huella del contenido estructurado de esta versión. No es una firma digital. Revisiones posteriores no cambian esta versión.', false, 8, '#4B5563');
  drawInspectionPdfBlocks(doc, blocks, { x: 44, width: 507, bottom: 779,
    newPage: () => { doc.addPage(); header(); }, continuation: 'Adenda ' + data.id + ' - v' + data.version + ' (continuación)' });
  doc.end(); return ready;
}
