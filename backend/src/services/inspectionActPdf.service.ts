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
    evidencias: inspection.evidencias.map((item: any) => ({
      id: item.id,
      sha256: item.sha256,
      capturadaAt: item.capturadaAt,
      createdAt: item.createdAt,
      creadoPorId: item.creadoPorId,
      anuladaAt: item.anuladaAt,
      anuladaPorId: item.anuladaPorId,
      motivoAnulacion: item.motivoAnulacion,
    })),
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
  doc.font('Helvetica').fontSize(7).fillColor('#CDEBDD').text('Ministerio de Energía y Ambiente · Subsecretaría de Ambiente · DGFA', 44, 46);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.white).text('INFORME TÉCNICO DE INSPECCIÓN', 44, 67);
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
  ensureSpace(doc, 58);
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

function narrativeBox(doc: PDFKit.PDFDocument, text: string) {
  const width = doc.page.width - 114;
  doc.font('Helvetica').fontSize(9);
  const textHeight = doc.heightOfString(text, { width, lineGap: 2 });
  if (textHeight <= 160) {
    const height = Math.max(58, textHeight + 24);
    ensureSpace(doc, height + 8);
    const y = doc.y;
    doc.roundedRect(44, y, doc.page.width - 88, height, 5).fill(C.paleGreen);
    doc.font('Helvetica').fontSize(9).fillColor(C.navy).text(text, 57, y + 11, { width, lineGap: 2 });
    doc.y = y + height + 7;
    return;
  }

  // Un relato extenso no se fuerza dentro de una caja de una sola página:
  // PDFKit lo pagina y conserva el cursor real para que no genere hojas vacías.
  doc.font('Helvetica').fontSize(9).fillColor(C.navy).text(text, 44, doc.y, {
    width: doc.page.width - 88,
    lineGap: 3,
  });
  doc.y += 8;
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
    const evidenceNames = (item.evidencias || []).map((evidence: any) => `${evidence.anuladaAt ? '[ANULADA] ' : ''}${evidence.nombreOriginal}${evidence.anuladaAt && evidence.motivoAnulacion ? ` (${evidence.motivoAnulacion})` : ''}`).join(' · ');
    doc.font('Helvetica').fontSize(7);
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
  const photos = inspection.evidencias.filter((item: any) => item.tipo === 'FOTO' && !item.anuladaAt);
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
      const target = evidenceTargetLabel(inspection, photo);
      doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(target || `Capturada ${formatDate(photo.capturadaAt, true)}`, x, y + 112, { width, height: 24, ellipsis: true });
    });
    doc.y = y + 142;
  }
}

function evidenceTargetLabel(inspection: any, evidence: any): string {
  if (evidence.itemId) {
    const item = inspection.items.find((row: any) => row.id === evidence.itemId);
    return item ? `Checklist ${item.codigo || ''} · ${item.etiqueta}` : 'Checklist';
  }
  if (evidence.comparacionId) {
    const comparison = inspection.comparaciones.find((row: any) => row.id === evidence.comparacionId);
    return comparison ? `Comparación ${comparison.codigo || ''} · ${comparison.etiqueta}` : 'Comparación declarada';
  }
  if (evidence.eventoId) {
    const event = inspection.eventos.find((row: any) => row.id === evidence.eventoId);
    return event ? `Trazabilidad · ${event.titulo}` : 'Trazabilidad';
  }
  return 'Evidencia general del expediente';
}

function evidenceInventory(doc: PDFKit.PDFDocument, inspection: any) {
  if (inspection.evidencias.length === 0) {
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text('No se incorporaron archivos al expediente.');
    return;
  }
  inspection.evidencias.forEach((evidence: any, index: number) => {
    const target = evidenceTargetLabel(inspection, evidence);
    const status = evidence.anuladaAt ? 'ANULADA - archivo preservado' : 'VIGENTE';
    const metadata = [
      `${evidence.tipo} · ${status}`,
      target,
      `Captura ${formatDate(evidence.capturadaAt, true)} · Recepción ${formatDate(evidence.createdAt, true)}`,
      evidence.creadoPor ? `Incorporada por ${`${evidence.creadoPor.nombre} ${evidence.creadoPor.apellido || ''}`.trim()}` : 'Autor sin informar',
      evidence.latitud != null && evidence.longitud != null ? `Coordenadas ${evidence.latitud}, ${evidence.longitud}` : '',
    ].filter(Boolean).join(' · ');
    const details = [
      evidence.descripcion ? `Descripción: ${evidence.descripcion}` : '',
      evidence.transcripcion ? `Transcripción: ${evidence.transcripcion}` : '',
      evidence.anuladaAt ? `Anulación ${formatDate(evidence.anuladaAt, true)} por ${evidence.anuladaPor ? `${evidence.anuladaPor.nombre} ${evidence.anuladaPor.apellido || ''}`.trim() : 'usuario no informado'}. Motivo: ${evidence.motivoAnulacion || 'sin motivo informado'}` : '',
    ].filter(Boolean).join('\n');
    doc.font('Helvetica').fontSize(6.8);
    const metadataHeight = Math.max(12, doc.heightOfString(metadata, { width: 475 }));
    doc.font('Helvetica').fontSize(7.2);
    const detailsHeight = details ? Math.max(12, doc.heightOfString(details, { width: 475 })) : 0;
    const height = 34 + metadataHeight + detailsHeight;
    ensureSpace(doc, height + 8);
    const y = doc.y;
    doc.roundedRect(44, y, doc.page.width - 88, height, 4).fill(evidence.anuladaAt ? C.soft : C.white).strokeColor(C.line).lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(8.2).fillColor(evidence.anuladaAt ? C.muted : C.navy).text(`${index + 1}. ${evidence.nombreOriginal}`, 56, y + 8, { width: 475 });
    doc.font('Helvetica').fontSize(6.8).fillColor(C.muted).text(metadata, 56, y + 21, { width: 475 });
    if (details) doc.font('Helvetica').fontSize(7.2).fillColor(C.navy).text(details, 56, y + 24 + metadataHeight, { width: 475 });
    doc.y = y + height + 6;
  });
}

function timeline(doc: PDFKit.PDFDocument, events: any[]) {
  events.forEach((event) => {
    const attachments = event.adjuntos || [];
    doc.font('Helvetica').fontSize(7.5);
    const detailHeight = event.detalle ? Math.max(12, doc.heightOfString(event.detalle, { width: 480 })) : 0;
    const emailHeight = event.canal === 'EMAIL' ? 14 : 0;
    const eventHeight = 27 + detailHeight + emailHeight + attachments.length * 13;
    ensureSpace(doc, eventHeight);
    const y = doc.y;
    const color = event.estadoEntrega === 'NO_ENVIADO' ? C.amber : event.tipo === 'RESPUESTA_ACTOR' ? C.blue : C.green;
    doc.circle(50, y + 7, 4.5).fill(color);
    doc.moveTo(50, y + 12).lineTo(50, y + eventHeight - 4).lineWidth(0.8).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.navy).text(event.titulo, 63, y + 1, { width: 330 });
    doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(`${formatDate(event.createdAt, true)} · ${event.usuario.nombre} ${event.usuario.apellido || ''}`.trim(), 397, y + 2, { width: 150, align: 'right' });
    let cursor = y + 15;
    if (event.detalle) {
      doc.font('Helvetica').fontSize(7.5).fillColor(C.navy).text(event.detalle, 63, cursor, { width: 480 });
      cursor += detailHeight + 4;
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
    const lifecycle = evidence.anuladaAt ? `Captura ${formatDate(evidence.capturadaAt, true)} · Recepción ${formatDate(evidence.createdAt, true)} · ${evidence.creadoPor ? `${evidence.creadoPor.nombre} ${evidence.creadoPor.apellido || ''}`.trim() : 'Autor sin informar'} · ANULADA ${formatDate(evidence.anuladaAt, true)} · ${evidence.motivoAnulacion || 'sin motivo'}` : `Captura ${formatDate(evidence.capturadaAt, true)} · Recepción ${formatDate(evidence.createdAt, true)} · ${evidence.creadoPor ? `${evidence.creadoPor.nombre} ${evidence.creadoPor.apellido || ''}`.trim() : 'Autor sin informar'} · VIGENTE`;
    doc.font('Helvetica-Bold').fontSize(7.5);
    const nameHeight = Math.max(10, doc.heightOfString(`${index + 1}. ${evidence.nombreOriginal}`, { width: 495 }));
    doc.font('Helvetica').fontSize(6.8);
    const lifecycleHeight = Math.max(10, doc.heightOfString(lifecycle, { width: 495 }));
    const rowHeight = nameHeight + lifecycleHeight + 21;
    ensureSpace(doc, rowHeight);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.navy).text(`${index + 1}. ${evidence.nombreOriginal}`, 50, y, { width: 495 });
    doc.font('Helvetica').fontSize(6.8).fillColor(C.muted).text(lifecycle, 50, y + nameHeight + 2, { width: 495 });
    doc.font('Courier').fontSize(6.2).fillColor(C.blue).text(evidence.sha256 || 'Huella no disponible', 50, y + nameHeight + lifecycleHeight + 6, { width: 495 });
    doc.y = y + rowHeight;
  });
}

export async function streamInspectionTechnicalReportPdf(
  res: Response,
  inspection: any,
  resolveEvidence: (key: string) => string,
): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, info: { Title: `Informe técnico de inspección ${inspection.numero}`, Author: 'SITREP Mendoza' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=informe_tecnico_${inspection.numero}.pdf`);
  doc.pipe(res);

  header(doc, inspection);
  const technical = inspection.informeTecnico && typeof inspection.informeTecnico === 'object' ? inspection.informeTecnico : {};
  const actor = actorOf(inspection);
  const technicalSections = [
    ['1. Objetivo', technical.objetivo || `No se registró un objetivo técnico específico para ${actor.razonSocial || 'la entidad inspeccionada'}. Esta ausencia se explicita para evitar que el sistema complete el criterio profesional del inspector.`],
    ['2. Antecedentes', technical.antecedentes || [technical.expedienteElectronico ? `Expediente electrónico: ${technical.expedienteElectronico}.` : '', technical.referencias || '', `Inspección SITREP ${inspection.numero}${inspection.numeroActa ? `, acta ${inspection.numeroActa}` : ''}.`].filter(Boolean).join('\n\n')],
    ['3. Evaluación', technical.evaluacion || inspection.observaciones || 'No se incorporó una evaluación narrativa adicional. Los resultados verificables se detallan en las comparativas, el checklist y las evidencias de este informe.'],
    ['4. Conclusión', technical.conclusion || 'No se registró una conclusión técnica específica. Esta ausencia se explicita para evitar inferencias automáticas sobre los hallazgos.'],
    ['5. Recomendación', technical.recomendacion || 'No se registró una recomendación técnica específica. Toda medida o derivación deberá ser consignada y validada por el área competente.'],
  ];
  technicalSections.forEach(([title, body]) => {
    section(doc, title);
    doc.font('Helvetica').fontSize(9).fillColor(C.navy).text(String(body), 44, doc.y, { width: doc.page.width - 88, lineGap: 3 });
    doc.y += 8;
  });

  section(doc, 'Anexo técnico SITREP', 'Contrastes, controles, evidencias y trazabilidad que sustentan la evaluación');
  section(doc, 'Síntesis del resultado', 'Lectura ejecutiva de la inspección y situación del expediente');
  const differs = inspection.comparaciones.filter((row: any) => row.resultado === 'DIFIERE').length;
  const nonCompliant = inspection.items.filter((row: any) => row.resultado === 'NO_CUMPLE').length;
  const synthesis = inspection.observaciones || `Se verificaron ${inspection.comparaciones.length} datos declarados y ${inspection.items.length} puntos de control. Se detectaron ${differs} diferencias declarativas y ${nonCompliant} incumplimientos en el checklist.`;
  narrativeBox(doc, synthesis);
  metrics(doc, inspection);

  if (inspection.evidencias.some((item: any) => item.tipo === 'FOTO')) {
    section(doc, 'Evidencia fotográfica', 'Imágenes preservadas en el expediente digital con fecha de captura');
    evidenceGallery(doc, inspection, resolveEvidence);
  }

  section(doc, 'Declarado vs. verificado', 'Snapshot de los datos declarados al crear la inspección y resultado observado en campo');
  comparisonTable(doc, inspection.comparaciones);

  section(doc, 'Checklist del acta', 'Controles aplicados según el tipo de actor inspeccionado');
  checklist(doc, inspection.items);

  section(doc, 'Inventario completo de evidencias', 'Archivos vigentes y anulados, vínculos, autores, tiempos, observaciones y transcripciones');
  evidenceInventory(doc, inspection);

  section(doc, 'Trazabilidad del expediente', 'Comentarios, revisiones, comunicaciones, respuestas y documentos adjuntos');
  timeline(doc, inspection.eventos);

  const fingerprint = inspectionFingerprint(inspection);
  section(doc, 'Integridad y cadena de custodia', 'Identificadores técnicos para verificar que las evidencias y el contenido no fueron sustituidos');
  integrityLedger(doc, inspection, fingerprint);

  ensureSpace(doc, 170);
  const closureY = doc.y + 8;
  doc.roundedRect(44, closureY, doc.page.width - 88, 151, 5).fill(C.soft);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text('Integración documental para dictamen', 56, closureY + 11);
  doc.font('Helvetica').fontSize(7.4).fillColor(C.muted).text(`Este informe técnico complementa el acta de inspección ${inspection.numeroActa || 'sin número asignado'}. Ambas piezas pertenecen al expediente ${inspection.numero} y deben remitirse juntas cuando corresponda la intervención de Legales. El sistema no presume el dictamen ni reemplaza su contenido.`, 56, closureY + 28, { width: doc.page.width - 112, lineGap: 2 });
  doc.font('Helvetica-Bold').fontSize(6.7).fillColor(C.navy).text('Control documental', 56, closureY + 69);
  doc.font('Helvetica').fontSize(6.7).fillColor(C.muted).text('El documento reproduce la versión indicada del expediente SITREP. Las huellas SHA-256 permiten verificar integridad técnica, pero no sustituyen la firma de los intervinientes ni una firma digital emitida conforme al régimen aplicable.', 56, closureY + 82, { width: doc.page.width - 112 });
  doc.font('Helvetica-Bold').fontSize(6.7).fillColor(C.navy).text('Marco normativo de contexto: Ley Provincial 5.917 y Decreto Provincial 2.625/1999; régimen de la Ley Nacional 24.051, incluida la competencia de fiscalización y poder de policía ambiental de su art. 60 incs. c y d. La calificación jurídica, el alcance probatorio y el circuito posterior corresponden al área legal competente.', 56, closureY + 107, { width: doc.page.width - 112 });
  doc.moveTo(298, closureY + 136).lineTo(535, closureY + 136).lineWidth(0.6).strokeColor(C.line).stroke();
  doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.navy).text(`${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`.trim(), 298, closureY + 140, { width: 237, align: 'center' });
  doc.y = closureY + 160;

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
