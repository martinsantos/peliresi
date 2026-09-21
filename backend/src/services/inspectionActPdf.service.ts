import fs from 'fs';
import crypto from 'crypto';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';

const C = {
  green: '#0D8A4F', darkGreen: '#1B5E3C', paleGreen: '#ECFDF5',
  navy: '#10213A', muted: '#64748B', line: '#D9E2EA', soft: '#F6F8FA',
  amber: '#B56700', paleAmber: '#FFF7E6', blue: '#2563EB', red: '#C2413B', white: '#FFFFFF',
};

function actorOf(inspection: any) {
  return inspection.generador || inspection.transportista || inspection.operador || {};
}

function formatDate(value?: Date | string | null, withTime = false): string {
  if (!value) return 'Sin informar';
  return new Date(value).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Mendoza',
    ...(withTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }),
  });
}

function stateLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function inspectionFingerprint(inspection: any): string {
  const canonical = {
    numero: inspection.numero,
    numeroActa: inspection.numeroActa,
    version: inspection.version,
    tipoActor: inspection.tipoActor,
    actor: actorOf(inspection)?.id,
    inspector: inspection.inspectorId,
    estado: inspection.estado,
    iniciadaAt: inspection.iniciadaAt,
    cerradaCampoAt: inspection.cerradaCampoAt,
    observaciones: inspection.observaciones,
    comparaciones: inspection.comparaciones.map((row: any) => ({ id: row.id, resultado: row.resultado, valorDeclarado: row.valorDeclarado, valorObservado: row.valorObservado, observacion: row.observacion })),
    items: inspection.items.map((row: any) => ({ id: row.id, resultado: row.resultado, observacion: row.observacion, evidencias: (row.evidencias || []).map((item: any) => item.sha256) })),
    evidencias: inspection.evidencias.map((item: any) => ({ id: item.id, sha256: item.sha256, capturadaAt: item.capturadaAt, createdAt: item.createdAt, creadoPorId: item.creadoPorId })),
    eventos: inspection.eventos.map((event: any) => ({ id: event.id, tipo: event.tipo, detalle: event.detalle, usuarioId: event.usuarioId, createdAt: event.createdAt })),
  };
  return crypto.createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - 100) doc.addPage();
}

function section(doc: PDFKit.PDFDocument, title: string, subtitle?: string) {
  ensureSpace(doc, subtitle ? 58 : 40);
  const y = doc.y + 10;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.navy).text(title, 44, y, { width: doc.page.width - 88 });
  if (subtitle) doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(subtitle, 44, y + 19, { width: doc.page.width - 88 });
  const lineY = y + (subtitle ? 35 : 24);
  doc.moveTo(44, lineY).lineTo(doc.page.width - 44, lineY).lineWidth(0.6).strokeColor(C.line).stroke();
  doc.y = lineY + 9;
}

function statusColor(status: string) {
  if (status === 'COINCIDE' || status === 'CUMPLE') return C.green;
  if (status === 'DIFIERE' || status === 'NO_CUMPLE') return C.amber;
  return C.muted;
}

function header(doc: PDFKit.PDFDocument, inspection: any) {
  const actor = actorOf(inspection);
  doc.rect(0, 0, doc.page.width, 92).fill(C.darkGreen);
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(20).text('SITREP Mendoza', 44, 22);
  doc.font('Helvetica').fontSize(8).fillColor('#CDEBDD').text('Sistema de Trazabilidad de Residuos Peligrosos', 44, 47);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white).text('INFORME DIGITAL DEL EXPEDIENTE', 44, 67);
  doc.font('Helvetica-Bold').fontSize(14).text(inspection.numero, 360, 25, { width: 190, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#CDEBDD').text(`Estado: ${stateLabel(String(inspection.estado))}`, 360, 47, { width: 190, align: 'right' });
  doc.y = 112;

  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(18).text(actor.razonSocial || 'Actor inspeccionado', 44, 112, { width: doc.page.width - 88 });
  doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`${inspection.tipoActor} · CUIT ${actor.cuit || 's/d'} · Acta ${inspection.numeroActa || 'sin número asignado'}`, 44, 136, { width: doc.page.width - 88 });
  doc.y = 160;

  const y = doc.y;
  const cells = [
    ['Inspector', `${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`.trim()],
    ['Fecha programada', formatDate(inspection.fechaProgramada)],
    ['Inicio en campo', formatDate(inspection.iniciadaAt, true)],
    ['Ubicación', inspection.ubicacion || actor.domicilio || 'Sin informar'],
  ];
  const width = (doc.page.width - 88) / cells.length;
  cells.forEach(([label, value], i) => {
    const x = 44 + i * width;
    if (i) doc.moveTo(x, y).lineTo(x, y + 38).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(label, x + (i ? 10 : 0), y, { width: width - 12 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.navy).text(value, x + (i ? 10 : 0), y + 12, { width: width - 12, height: 25, ellipsis: true });
  });
  doc.y = y + 48;
  doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(
    `Creada ${formatDate(inspection.createdAt, true)}  ·  Actualizada ${formatDate(inspection.updatedAt, true)}  ·  Cierre de campo ${formatDate(inspection.cerradaCampoAt, true)}  ·  Plazo ${formatDate(inspection.plazoRespuestaAt, true)}`,
    44,
    doc.y,
    { width: doc.page.width - 88, align: 'left' },
  );
  doc.y += 18;
}

function metrics(doc: PDFKit.PDFDocument, inspection: any) {
  const verified = inspection.comparaciones.filter((row: any) => row.resultado !== 'PENDIENTE').length;
  const differs = inspection.comparaciones.filter((row: any) => row.resultado === 'DIFIERE').length;
  const nonCompliant = inspection.items.filter((row: any) => row.resultado === 'NO_CUMPLE').length;
  const values = [
    ['Datos verificados', `${verified}/${inspection.comparaciones.length}`, C.blue],
    ['Diferencias', String(differs), differs ? C.amber : C.green],
    ['No conformidades', String(nonCompliant), nonCompliant ? C.amber : C.green],
    ['Evidencias / eventos', `${inspection.evidencias.length} / ${inspection.eventos.length}`, C.navy],
  ];
  const width = (doc.page.width - 88 - 18) / 4;
  const y = doc.y;
  values.forEach(([label, value, color], index) => {
    const x = 44 + index * (width + 6);
    doc.roundedRect(x, y, width, 42, 4).fill(C.soft);
    doc.font('Helvetica').fontSize(6.5).fillColor(C.muted).text(label, x + 8, y + 8, { width: width - 16 });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(color).text(value, x + 8, y + 20, { width: width - 16 });
  });
  doc.y = y + 49;
}

function comparisonTable(doc: PDFKit.PDFDocument, rows: any[]) {
  const widths = [118, 113, 113, 65, 100];
  const labels = ['Concepto', 'Declarado', 'Verificado', 'Resultado', 'Observación'];
  const x0 = 44;
  const drawHeader = () => {
    const y = doc.y;
    doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), 24).fill(C.soft);
    let x = x0;
    labels.forEach((label, i) => {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.navy).text(label, x + 5, y + 8, { width: widths[i] - 10 });
      x += widths[i];
    });
    doc.y = y + 24;
  };
  drawHeader();
  rows.forEach((row) => {
    const values = [row.etiqueta, row.valorDeclarado || 'Sin dato', row.valorObservado || 'No verificado', String(row.resultado).replace('_', ' '), row.observacion || ''];
    const heights = values.map((value, i) => doc.heightOfString(String(value), { width: widths[i] - 10 }));
    const height = Math.max(27, Math.max(...heights) + 12);
    if (doc.y + height > doc.page.height - 100) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    doc.rect(x0, y, widths.reduce((a, b) => a + b, 0), height).fill(row.resultado === 'DIFIERE' ? C.paleAmber : C.white);
    let x = x0;
    values.forEach((value, i) => {
      doc.font(i === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(7.2).fillColor(i === 3 ? statusColor(row.resultado) : C.navy)
        .text(String(value), x + 5, y + 6, { width: widths[i] - 10 });
      doc.moveTo(x, y + height).lineTo(x + widths[i], y + height).lineWidth(0.4).strokeColor(C.line).stroke();
      x += widths[i];
    });
    doc.y = y + height;
  });
}

function checklist(doc: PDFKit.PDFDocument, items: any[]) {
  items.forEach((item) => {
    const evidenceNames = (item.evidencias || []).map((evidence: any) => evidence.nombreOriginal).join(' · ');
    const observationHeight = item.observacion ? Math.max(12, doc.heightOfString(item.observacion, { width: 465 })) : 0;
    const evidenceHeight = evidenceNames ? Math.max(12, doc.heightOfString(`Evidencia vinculada: ${evidenceNames}`, { width: 465 })) : 0;
    const rowHeight = 24 + observationHeight + evidenceHeight + (item.observacion && evidenceNames ? 4 : 0);
    ensureSpace(doc, rowHeight + 5);
    const y = doc.y;
    doc.circle(50, y + 8, 4).fill(statusColor(item.resultado));
    doc.font('Helvetica').fontSize(8).fillColor(C.navy).text(item.etiqueta, 61, y + 3, { width: 350 });
    doc.font('Helvetica-Bold').fontSize(7).fillColor(statusColor(item.resultado)).text(String(item.resultado).replace('_', ' '), 420, y + 3, { width: 125, align: 'right' });
    let cursor = y + 15;
    if (item.observacion) {
      doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(item.observacion, 61, cursor, { width: 465 });
      cursor += observationHeight + 2;
    }
    if (evidenceNames) {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(C.blue).text(`Evidencia vinculada: ${evidenceNames}`, 61, cursor, { width: 465 });
      cursor += evidenceHeight;
    }
    doc.y = Math.max(y + 24, cursor + 5);
  });
}

function evidenceGallery(doc: PDFKit.PDFDocument, inspection: any, resolveEvidence: (key: string) => string) {
  const photos = inspection.evidencias.filter((item: any) => item.tipo === 'FOTO').slice(0, 6);
  if (photos.length === 0) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text('No se incorporaron fotografías al expediente.');
    return;
  }
  const gap = 10;
  const width = (doc.page.width - 88 - gap * 2) / 3;
  for (let i = 0; i < photos.length; i += 3) {
    ensureSpace(doc, 145);
    const y = doc.y;
    photos.slice(i, i + 3).forEach((photo: any, column: number) => {
      const x = 44 + column * (width + gap);
      const path = resolveEvidence(photo.storageKey);
      try {
        if (fs.existsSync(path)) doc.image(path, x, y, { fit: [width, 92], align: 'center', valign: 'center' });
        else doc.rect(x, y, width, 92).fill(C.soft);
      } catch { doc.rect(x, y, width, 92).fill(C.soft); }
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.navy).text(photo.nombreOriginal, x, y + 98, { width, height: 12, ellipsis: true });
      doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(photo.descripcion || `Capturada ${formatDate(photo.capturadaAt, true)}`, x, y + 112, { width, height: 24, ellipsis: true });
    });
    doc.y = y + 142;
  }
}

function timeline(doc: PDFKit.PDFDocument, events: any[]) {
  events.forEach((event) => {
    const attachments = event.adjuntos || [];
    const eventHeight = 40 + (event.detalle ? 18 : 0) + attachments.length * 13;
    ensureSpace(doc, eventHeight);
    const y = doc.y;
    const color = event.estadoEntrega === 'NO_ENVIADO' ? C.amber : event.tipo === 'RESPUESTA_ACTOR' ? C.blue : C.green;
    doc.circle(50, y + 7, 4.5).fill(color);
    doc.moveTo(50, y + 12).lineTo(50, y + eventHeight - 4).lineWidth(0.8).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.navy).text(event.titulo, 63, y + 1, { width: 330 });
    doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(`${formatDate(event.createdAt, true)} · ${event.usuario.nombre} ${event.usuario.apellido || ''}`.trim(), 397, y + 2, { width: 150, align: 'right' });
    let cursor = y + 15;
    if (event.detalle) {
      doc.font('Helvetica').fontSize(7.5).fillColor(C.navy).text(event.detalle, 63, cursor, { width: 480, height: 18, ellipsis: true });
      cursor += 20;
    }
    if (event.canal === 'EMAIL') {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(color).text(`Correo: ${event.estadoEntrega === 'NO_ENVIADO' ? 'no enviado' : event.estadoEntrega || 'sin estado'}${event.destinatario ? ` · ${event.destinatario}` : ''}`, 63, cursor, { width: 480 });
      cursor += 13;
    }
    attachments.forEach((file: any) => {
      doc.font('Helvetica').fontSize(7).fillColor(C.blue).text(`Adjunto: ${file.nombreOriginal}`, 63, cursor, { width: 480 });
      cursor += 13;
    });
    doc.y = Math.max(y + eventHeight, cursor + 5);
  });
}

function integrityLedger(doc: PDFKit.PDFDocument, inspection: any, fingerprint: string) {
  doc.roundedRect(44, doc.y, doc.page.width - 88, 55, 5).fill(C.soft);
  const startY = doc.y;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy).text('Huella técnica del expediente', 56, startY + 9);
  doc.font('Courier').fontSize(6.6).fillColor(C.blue).text(fingerprint, 56, startY + 23, { width: doc.page.width - 112 });
  doc.font('Helvetica').fontSize(6.7).fillColor(C.muted).text(`Versión ${inspection.version} · SHA-256 · esta huella no sustituye una firma digital`, 56, startY + 39, { width: doc.page.width - 112 });
  doc.y = startY + 64;
  inspection.evidencias.forEach((evidence: any, index: number) => {
    ensureSpace(doc, 39);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.navy).text(`${index + 1}. ${evidence.nombreOriginal}`, 50, y, { width: 300, height: 12, ellipsis: true });
    doc.font('Helvetica').fontSize(6.8).fillColor(C.muted).text(`Captura ${formatDate(evidence.capturadaAt, true)} · Recepción ${formatDate(evidence.createdAt, true)} · ${evidence.creadoPor ? `${evidence.creadoPor.nombre} ${evidence.creadoPor.apellido || ''}`.trim() : 'Autor sin informar'}`, 50, y + 13, { width: 495 });
    doc.font('Courier').fontSize(6.2).fillColor(C.blue).text(evidence.sha256 || 'Huella no disponible', 50, y + 25, { width: 495 });
    doc.y = y + 39;
  });
}

export async function streamInspectionActPdf(
  res: Response,
  inspection: any,
  resolveEvidence: (key: string) => string,
): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, info: { Title: `Informe de inspección ${inspection.numero}`, Author: 'SITREP Mendoza' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=informe_inspeccion_${inspection.numero}.pdf`);
  doc.pipe(res);

  header(doc, inspection);
  section(doc, 'Síntesis del resultado', 'Lectura ejecutiva de la inspección y situación del expediente');
  const differs = inspection.comparaciones.filter((row: any) => row.resultado === 'DIFIERE').length;
  const nonCompliant = inspection.items.filter((row: any) => row.resultado === 'NO_CUMPLE').length;
  const synthesis = inspection.observaciones || `Se verificaron ${inspection.comparaciones.length} datos declarados y ${inspection.items.length} puntos de control. Se detectaron ${differs} diferencias declarativas y ${nonCompliant} incumplimientos en el checklist.`;
  const summaryY = doc.y;
  doc.roundedRect(44, summaryY, doc.page.width - 88, 58, 5).fill(C.paleGreen);
  doc.font('Helvetica').fontSize(9).fillColor(C.navy).text(synthesis, 57, summaryY + 11, { width: doc.page.width - 114, height: 40, ellipsis: true });
  doc.y = summaryY + 65;
  metrics(doc, inspection);

  if (inspection.evidencias.some((item: any) => item.tipo === 'FOTO')) {
    section(doc, 'Evidencia fotográfica', 'Imágenes preservadas en el expediente digital con fecha de captura');
    evidenceGallery(doc, inspection, resolveEvidence);
  }

  section(doc, 'Declarado vs. verificado', 'Snapshot de los datos declarados al crear la inspección y resultado observado en campo');
  comparisonTable(doc, inspection.comparaciones);

  section(doc, 'Checklist del acta', 'Controles aplicados según el tipo de actor inspeccionado');
  checklist(doc, inspection.items);

  section(doc, 'Trazabilidad del expediente', 'Comentarios, revisiones, comunicaciones, respuestas y documentos adjuntos');
  timeline(doc, inspection.eventos);

  const fingerprint = inspectionFingerprint(inspection);
  section(doc, 'Integridad y cadena de custodia', 'Identificadores técnicos para verificar que las evidencias y el contenido no fueron sustituidos');
  integrityLedger(doc, inspection, fingerprint);

  ensureSpace(doc, 74);
  const closureY = doc.y + 8;
  doc.roundedRect(44, closureY, doc.page.width - 88, 66, 5).fill(C.soft);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Control documental', 56, closureY + 10);
  doc.font('Helvetica').fontSize(6.7).fillColor(C.muted).text('El documento reproduce la versión indicada del expediente SITREP. Las huellas SHA-256 permiten verificar integridad técnica, pero no sustituyen la firma de los intervinientes ni una firma digital emitida conforme al régimen aplicable.', 56, closureY + 25, { width: doc.page.width - 112 });
  doc.font('Helvetica-Bold').fontSize(6.7).fillColor(C.navy).text('Marco de referencia: Ley Provincial 5.917 y Decreto Provincial 2.625/1999, art. 44.', 56, closureY + 52, { width: doc.page.width - 112 });
  doc.y = closureY + 72;

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 78;
    doc.moveTo(44, footerY - 8).lineTo(doc.page.width - 44, footerY - 8).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
      .text(`${inspection.numero} · v${inspection.version} · ${fingerprint.slice(0, 16)}… · SITREP Mendoza`, 44, footerY, { width: 390, lineBreak: false })
      .text(`Página ${i + 1} de ${range.count}`, 454, footerY, { width: 97, align: 'right', lineBreak: false });
  }
  doc.end();
}
