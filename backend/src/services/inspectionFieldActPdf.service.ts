import crypto from 'crypto';
import fs from 'fs';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

const COLORS = {
  green: '#1B5E3C',
  accent: '#0D8A4F',
  ink: '#111827',
  muted: '#64748B',
  line: '#9CA3AF',
  soft: '#F4F7F5',
  white: '#FFFFFF',
};

type ActData = {
  codigoPostal?: string;
  departamento?: string;
  calle?: string;
  numeroDomicilio?: string;
  titular?: string;
  dniTitular?: string;
  atendidoPor?: string;
  dniAtendido?: string;
  cargoAtendido?: string;
  area?: string;
  lugarAfectacion?: string;
  motivoInspeccion?: string;
  infraestructura?: 'SI' | 'NO' | 'NO_VERIFICADO';
  detalleInfraestructura?: string;
  estadoInfraestructura?: string;
  generacion?: string;
  requerimientos?: string;
  actaAnterior?: string;
  plazoDescargoDias?: number;
};

function actorOf(inspection: any) {
  return inspection.generador || inspection.transportista || inspection.operador || {};
}

function actDataOf(inspection: any): ActData {
  return inspection.datosActa && typeof inspection.datosActa === 'object' ? inspection.datosActa as ActData : {};
}

function value(input: unknown, fallback = 'Sin informar'): string {
  const result = String(input ?? '').trim();
  return result || fallback;
}

function dateParts(input: Date | string | null | undefined): { date: string; time: string } {
  if (!input) return { date: 'Sin informar', time: 'Sin informar' };
  const date = new Date(input);
  return {
    date: date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }),
    time: date.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit' }),
  };
}

function shortFingerprint(inspection: any): string {
  const payload = {
    numero: inspection.numero,
    numeroActa: inspection.numeroActa,
    version: inspection.version,
    updatedAt: inspection.updatedAt,
    items: inspection.items.map((item: any) => [item.id, item.resultado, item.observacion]),
    evidencias: inspection.evidencias.map((evidence: any) => [evidence.id, evidence.sha256, evidence.anuladaAt]),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function institutionalHeader(doc: PDFKit.PDFDocument, actNumber: string, subtitle?: string) {
  const top = 26;
  doc.fillColor(COLORS.green).font('Helvetica-Bold').fontSize(9)
    .text('MINISTERIO DE ENERGÍA Y AMBIENTE', 34, top, { width: 290 });
  doc.fontSize(8).text('SUBSECRETARÍA DE AMBIENTE', 34, top + 13, { width: 290 });
  doc.text('DIRECCIÓN DE GESTIÓN Y FISCALIZACIÓN AMBIENTAL', 34, top + 25, { width: 310 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
    .text('ACTA DE INSPECCIÓN / CONSTATACIÓN N.º', 337, top + 2, { width: 224, align: 'right' });
  doc.fontSize(16).fillColor(COLORS.green).text(actNumber, 337, top + 20, { width: 224, align: 'right' });
  if (subtitle) doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(subtitle, 337, top + 40, { width: 224, align: 'right' });
  doc.moveTo(34, 82).lineTo(doc.page.width - 34, 82).lineWidth(1.4).strokeColor(COLORS.green).stroke();
  doc.y = 92;
}

function band(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  doc.rect(34, y, doc.page.width - 68, 18).fill(COLORS.green);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white).text(title.toUpperCase(), 40, y + 5, { width: doc.page.width - 80, align: 'center' });
  doc.y = y + 18;
}

function row(doc: PDFKit.PDFDocument, cells: Array<{ label: string; value: string; weight?: number }>, minimumHeight = 30) {
  const totalWeight = cells.reduce((sum, cell) => sum + (cell.weight || 1), 0);
  const available = doc.page.width - 68;
  const widths = cells.map((cell) => available * (cell.weight || 1) / totalWeight);
  doc.font('Helvetica').fontSize(7.5);
  const heights = cells.map((cell, index) => doc.heightOfString(cell.value, { width: widths[index] - 12 }));
  const height = Math.max(minimumHeight, Math.max(...heights) + 21);
  const y = doc.y;
  let x = 34;
  cells.forEach((cell, index) => {
    const width = widths[index];
    doc.rect(x, y, width, height).fillAndStroke(COLORS.white, COLORS.line);
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted).text(cell.label.toUpperCase(), x + 6, y + 5, { width: width - 12 });
    doc.font('Helvetica').fontSize(8.3).fillColor(COLORS.ink).text(cell.value, x + 6, y + 15, { width: width - 12, lineGap: 1 });
    x += width;
  });
  doc.y = y + height;
}

function signatureBlock(doc: PDFKit.PDFDocument, inspection: any, act: ActData) {
  const actor = actorOf(inspection);
  const y = doc.y + 18;
  const width = (doc.page.width - 92) / 2;
  if (y + 72 > doc.page.height - 56) doc.addPage();
  const actualY = doc.y + 18;
  const responsible = value(act.atendidoPor || act.titular || actor.representanteLegalNombre, 'Causante / responsable');
  const inspector = value(`${inspection.inspector?.nombre || ''} ${inspection.inspector?.apellido || ''}`);
  [[responsible, act.dniAtendido || act.dniTitular || actor.representanteLegalDNI, 'CAUSANTE / RESPONSABLE'], [inspector, '', 'INSPECTOR/A INTERVINIENTE']].forEach(([name, dni, role], index) => {
    const x = 40 + index * (width + 12);
    doc.moveTo(x, actualY + 34).lineTo(x + width, actualY + 34).lineWidth(0.7).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink).text(String(name), x, actualY + 40, { width, align: 'center' });
    if (dni) doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(`DNI ${dni}`, x, actualY + 52, { width, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.green).text(String(role), x, actualY + 63, { width, align: 'center' });
  });
  doc.y = actualY + 78;
}

function observationsHeader(doc: PDFKit.PDFDocument, actNumber: string, continuation?: string) {
  institutionalHeader(doc, actNumber, continuation);
  band(doc, 'Observaciones generales');
  doc.y += 9;
}

function writePaginatedText(doc: PDFKit.PDFDocument, text: string, actNumber: string, continuation?: string) {
  const maxWidth = doc.page.width - 80;
  const lineHeight = 12;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
  const paragraphs = value(text, 'No se registraron observaciones generales.').split(/\n/);
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      doc.y += lineHeight;
      continue;
    }
    const words = paragraph.trim().split(/\s+/);
    let line = '';
    const flush = () => {
      if (!line) return;
      if (doc.y + lineHeight > doc.page.height - 130) {
        doc.addPage();
        observationsHeader(doc, actNumber, continuation);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
      }
      doc.text(line, 40, doc.y, { width: maxWidth, lineBreak: false });
      doc.y += lineHeight;
      line = '';
    };
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (doc.widthOfString(candidate) > maxWidth && line) flush();
      line = line ? `${line} ${word}` : word;
    });
    flush();
    doc.y += 4;
  }
}

function evidenceTarget(inspection: any, evidence: any): string {
  if (evidence.itemId) {
    const item = inspection.items.find((row: any) => row.id === evidence.itemId);
    if (item) return `${item.codigo} · ${item.etiqueta}${item.observacion ? ` — ${item.observacion}` : ''}`;
  }
  if (evidence.comparacionId) {
    const comparison = inspection.comparaciones.find((row: any) => row.id === evidence.comparacionId);
    if (comparison) return `${comparison.etiqueta}: ${comparison.valorObservado || comparison.resultado}`;
  }
  return evidence.descripcion || 'Evidencia general del expediente';
}

function photoAnnex(doc: PDFKit.PDFDocument, inspection: any, resolveEvidence: (key: string) => string, actNumber: string) {
  const photos = inspection.evidencias.filter((evidence: any) => evidence.tipo === 'FOTO' && !evidence.anuladaAt);
  photos.forEach((photo: any, index: number) => {
    if (index % 2 === 0) {
      doc.addPage();
      institutionalHeader(doc, actNumber, `ANEXO FOTOGRÁFICO · ${inspection.numero}`);
      doc.y += 7;
    }
    const y = doc.y;
    const path = resolveEvidence(photo.storageKey);
    const imageHeight = 245;
    doc.roundedRect(34, y, doc.page.width - 68, imageHeight, 4).fill(COLORS.soft);
    try {
      if (fs.existsSync(path)) doc.image(path, 38, y + 4, { fit: [doc.page.width - 76, imageHeight - 8], align: 'center', valign: 'center' });
    } catch {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('No fue posible renderizar la imagen; el archivo permanece en el expediente.', 48, y + 112, { width: doc.page.width - 96, align: 'center' });
    }
    doc.y = y + imageHeight + 7;
    doc.font('Helvetica-Bold').fontSize(8.2).fillColor(COLORS.ink).text(`Fotografía ${index + 1} · ${value(photo.nombreOriginal)}`, 38, doc.y, { width: doc.page.width - 76 });
    doc.y += 13;
    doc.font('Helvetica').fontSize(7.4).fillColor(COLORS.muted).text(evidenceTarget(inspection, photo), 38, doc.y, { width: doc.page.width - 76, height: 30, ellipsis: true });
    doc.y += 31;
    doc.font('Helvetica').fontSize(6.5).fillColor(COLORS.muted).text(`Captura: ${dateParts(photo.capturadaAt).date} ${dateParts(photo.capturadaAt).time} · SHA-256 ${value(photo.sha256).slice(0, 20)}…`, 38, doc.y, { width: doc.page.width - 76 });
    doc.y += 22;
  });
}

export async function streamInspectionActPdf(
  res: Response,
  inspection: any,
  resolveEvidence: (key: string) => string,
): Promise<void> {
  const actor = actorOf(inspection);
  const act = actDataOf(inspection);
  const actNumber = value(inspection.numeroActa, inspection.numero);
  const started = dateParts(inspection.iniciadaAt || inspection.fechaProgramada || inspection.createdAt);
  const doc = new PDFDocument({ size: 'A4', margin: 34, bufferPages: true, info: { Title: `Acta de inspección ${actNumber}`, Author: 'SITREP Mendoza' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=acta_inspeccion_${actNumber.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`);
  doc.pipe(res);

  institutionalHeader(doc, actNumber, `Expediente digital ${inspection.numero}`);
  row(doc, [
    { label: 'Fecha', value: started.date },
    { label: 'Hora', value: started.time },
    { label: 'Código postal', value: value(act.codigoPostal) },
  ]);
  band(doc, 'Domicilio inspeccionado');
  row(doc, [
    { label: 'Departamento', value: value(act.departamento) },
    { label: 'Calle / domicilio', value: value(act.calle || inspection.ubicacion || actor.domicilio), weight: 2 },
    { label: 'N.º', value: value(act.numeroDomicilio) },
  ]);
  band(doc, 'Empresa / entidad inspeccionada');
  row(doc, [
    { label: 'Razón social', value: value(actor.razonSocial), weight: 2 },
    { label: 'CUIT', value: value(actor.cuit) },
    { label: 'Teléfono', value: value(actor.telefono) },
  ]);
  row(doc, [
    { label: 'Titular / propiedad de', value: value(act.titular || actor.representanteLegalNombre || actor.razonSocial), weight: 2 },
    { label: 'DNI', value: value(act.dniTitular || actor.representanteLegalDNI) },
    { label: 'Correo', value: value(actor.email) },
  ]);
  row(doc, [
    { label: 'Atendido por', value: value(act.atendidoPor), weight: 2 },
    { label: 'DNI', value: value(act.dniAtendido) },
    { label: 'Cargo', value: value(act.cargoAtendido) },
  ]);
  band(doc, 'Inspectores intervinientes');
  row(doc, [
    { label: 'Inspector/a asignado/a', value: value(`${inspection.inspector?.nombre || ''} ${inspection.inspector?.apellido || ''}`) },
    { label: 'Área', value: value(act.area) },
  ]);
  band(doc, 'Alcance de la constatación');
  row(doc, [
    { label: 'Lugar de afectación', value: value(act.lugarAfectacion), weight: 2 },
    { label: 'Motivo de inspección', value: value(act.motivoInspeccion), weight: 2 },
    { label: 'Infraestructura', value: act.infraestructura === 'SI' ? 'Sí' : act.infraestructura === 'NO' ? 'No' : 'No verificada' },
  ], 34);
  row(doc, [
    { label: 'Detalle de infraestructura', value: value(act.detalleInfraestructura), weight: 2 },
    { label: 'Estado', value: value(act.estadoInfraestructura) },
  ], 35);
  row(doc, [
    { label: 'Generación / corrientes observadas', value: value(act.generacion), weight: 2 },
    { label: 'Acta antecedente', value: value(act.actaAnterior) },
  ], 34);
  const failedItems = inspection.items.filter((item: any) => item.resultado === 'NO_CUMPLE');
  const requirementsFallback = failedItems.length ? `Ver observaciones. Controles no conformes registrados: ${failedItems.map((item: any) => item.codigo).join(', ')}.` : 'Sin requerimientos expresos consignados.';
  row(doc, [{ label: 'Requerimientos consignados', value: value(act.requerimientos, requirementsFallback) }], 42);
  const notice = typeof act.plazoDescargoDias === 'number'
    ? `En este acto se deja constancia del plazo de ${act.plazoDescargoDias} día${act.plazoDescargoDias === 1 ? '' : 's'} hábil${act.plazoDescargoDias === 1 ? '' : 'es'} registrado para formular descargo y ofrecer la prueba pertinente.`
    : 'Plazo de presentación o descargo no consignado en el expediente. Debe completarse antes de su notificación formal.';
  const noticeY = doc.y + 6;
  doc.roundedRect(34, noticeY, doc.page.width - 68, 37, 4).fill(COLORS.soft);
  doc.font('Helvetica-Bold').fontSize(7.4).fillColor(COLORS.ink).text(notice, 44, noticeY + 9, { width: doc.page.width - 88, align: 'center' });
  doc.y = noticeY + 42;
  signatureBlock(doc, inspection, act);

  doc.addPage();
  observationsHeader(doc, actNumber, act.actaAnterior ? `CONTINÚA / RELACIONADA CON ${act.actaAnterior}` : `Expediente digital ${inspection.numero}`);
  writePaginatedText(doc, inspection.observaciones || '', actNumber, `Expediente digital ${inspection.numero}`);
  doc.y += 6;
  const factualFindings = inspection.items.filter((item: any) => item.resultado === 'NO_CUMPLE');
  if (factualFindings.length) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.green).text('CONTROLES NO CONFORMES REGISTRADOS', 40, doc.y, { width: doc.page.width - 80 });
    doc.y += 15;
    factualFindings.forEach((item: any) => {
      writePaginatedText(doc, `• ${item.codigo} — ${item.etiqueta}${item.observacion ? `: ${item.observacion}` : ''}`, actNumber, `Expediente digital ${inspection.numero}`);
    });
  }
  const defenseNotice = typeof act.plazoDescargoDias === 'number'
    ? `Se registra un plazo de ${act.plazoDescargoDias} día${act.plazoDescargoDias === 1 ? '' : 's'} hábil${act.plazoDescargoDias === 1 ? '' : 'es'} para formular descargo y ofrecer la prueba pertinente. La comunicación y el cómputo efectivo deben constar en la trazabilidad del expediente.`
    : 'El plazo de descargo y su comunicación no fueron consignados. El documento no presume una notificación ni el inicio de un cómputo.';
  if (doc.y + 95 > doc.page.height - 60) {
    doc.addPage();
    observationsHeader(doc, actNumber, `Expediente digital ${inspection.numero}`);
  }
  doc.roundedRect(40, doc.y + 6, doc.page.width - 80, 43, 4).fill(COLORS.soft);
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.ink).text(defenseNotice, 50, doc.y + 16, { width: doc.page.width - 100, align: 'center' });
  doc.y += 55;
  signatureBlock(doc, inspection, act);

  photoAnnex(doc, inspection, resolveEvidence, actNumber);

  const fingerprint = shortFingerprint(inspection);
  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index);
    // Mantener el pie dentro del área imprimible. PDFKit crea una página nueva
    // si el texto cruza el margen inferior, incluso al editar páginas bufferizadas.
    const footerY = doc.page.height - 55;
    doc.moveTo(34, footerY - 5).lineTo(doc.page.width - 34, footerY - 5).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(6.3).fillColor(COLORS.muted)
      .text(`SITREP · ${inspection.numero} · v${inspection.version} · ${fingerprint.slice(0, 16)}…`, 34, footerY, { width: 390, lineBreak: false })
      .text(`Página ${index + 1} de ${pages.count}`, 466, footerY, { width: 95, align: 'right', lineBreak: false });
  }
  doc.end();
}
