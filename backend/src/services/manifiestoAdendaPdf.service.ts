import { documentHeader } from './institutionalPdf.service';
import PDFDocument from 'pdfkit';
import { addendumDocument } from '../domain/manifiestoAdendaDocument';
import { drawInspectionPdfBlocks, InspectionPdfTextBlock } from './inspectionPdfLayout.service';
import { drawMendozaMark, loadInspectionPdfBranding } from './inspectionPdfBranding.service';
import type { OperatorFinding } from './inspectionIntake.service';

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
    documentHeader(doc, 'Anexo de adenda · versión ' + data.version, data.id, ++page, branding);
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
  if (data.informeHallazgo) {
    const finding = data.informeHallazgo as OperatorFinding;
    text('INFORME DE HALLAZGO DEL OPERADOR', true, 11, '#1B5E3C');
    text(finding.fecha + ' | ' + finding.estadoAlRegistrar + ' | Autor: ' + finding.autorId, false, 8);
    const labels = { CANTIDAD_DIFERENTE: 'Cantidad diferente', Y_OMITIDA: 'Y omitida en el manifiesto', NO_OBSERVADA: 'Corriente declarada no observada', UNIDAD_DIFERENTE: 'Unidad diferente; comparar sin conversión' };
    finding.diferencias.forEach(row => text(row.corriente + ' | ' + labels[row.tipo] + ' | Declarado: ' + (row.tipo === 'Y_OMITIDA' || row.tipo === 'UNIDAD_DIFERENTE' ? 'sin dato en esta unidad' : row.declarado + ' ' + row.unidad) + ' | Observado: ' + (row.tipo === 'NO_OBSERVADA' ? 'no informado' : row.observado + ' ' + row.unidad)));
    text('Ficha del operador: ' + (finding.alcanceOperador.valorOriginal || 'sin corrientes verificables'), false, 9);
    if (finding.alcanceOperador.corrientesNoRegistradas.length) text('No constan en esa ficha: ' + finding.alcanceOperador.corrientesNoRegistradas.join(', '), true, 9);
    text('El hallazgo se registra para evaluación en PSIP. No acredita infracción ni modifica la habilitación o la declaración original.', false, 9, '#4B5563');
  }
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
