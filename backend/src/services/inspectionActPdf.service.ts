import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import {
  buildInspectionDocumentFingerprint,
  inspectDossierReadiness,
  type InspectionDossierReadiness,
} from './inspectionDocumentIntegrity.service';
import { prepareInspectionPdfImages, type PreparedInspectionImage } from './inspectionPdfImage.service';
import {
  drawMendozaMark,
  drawSitrepMark,
  loadInspectionPdfBranding,
  type InspectionPdfBranding,
} from './inspectionPdfBranding.service';

const C = {
  green: '#0D8A4F', darkGreen: '#1B5E3C', paleGreen: '#ECFDF5',
  navy: '#10213A', ink: '#172033', muted: '#5E6B7F', line: '#CAD4DF', soft: '#F4F6F8',
  amber: '#9A5A00', paleAmber: '#FFF4D8', blue: '#1E5AA8', red: '#B13A35', white: '#FFFFFF',
};

const PAGE = { left: 44, right: 44, top: 62, bottom: 78 };

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

function ensureSpace(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > doc.page.height - PAGE.bottom) {
    doc.addPage();
    // Keep flow content below the running header even when the page was
    // created from inside a wrapped PDFKit text operation.
    doc.x = PAGE.left;
    doc.y = PAGE.top;
  }
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

function documentState(inspection: any, readiness: InspectionDossierReadiness) {
  if (!readiness.ready) return {
    label: `BORRADOR DOCUMENTAL · ${readiness.missing.length} requisito${readiness.missing.length === 1 ? '' : 's'} pendiente${readiness.missing.length === 1 ? '' : 's'}`,
    fill: C.paleAmber,
    ink: C.amber,
  };
  if (inspection.estado === 'EN_REVISION') return { label: 'DOCUMENTO EN REVISIÓN TÉCNICA', fill: C.paleAmber, ink: C.amber };
  return { label: `ESTADO DEL EXPEDIENTE · ${stateLabel(String(inspection.estado))}`, fill: C.paleGreen, ink: C.darkGreen };
}

function runningHeader(
  doc: PDFKit.PDFDocument,
  inspection: any,
  state: string,
  branding: InspectionPdfBranding,
) {
  drawMendozaMark(doc, branding, 44, 13, 94, 30);
  doc.font('Helvetica-Bold').fontSize(5.8).fillColor(C.darkGreen)
    .text('MINISTERIO DE ENERGÍA Y AMBIENTE · DGFA', 147, 19, { width: 224, lineBreak: false });
  doc.font('Helvetica').fontSize(5.5).fillColor(C.muted)
    .text(`INFORME TÉCNICO · ${inspection.numero} · v${inspection.version}`, 147, 29, { width: 224, lineBreak: false });
  drawSitrepMark(doc, 424, 16, { compact: true, width: 127 });
  doc.moveTo(44, 47).lineTo(doc.page.width - 44, 47).lineWidth(0.9).strokeColor(C.darkGreen).stroke();
  doc.font('Helvetica').fontSize(6.4).fillColor(C.muted)
    .text(state, 44, 51, { width: doc.page.width - 88, align: 'right', lineBreak: false });
  doc.y = PAGE.top;
}

function header(
  doc: PDFKit.PDFDocument,
  inspection: any,
  readiness: InspectionDossierReadiness,
  generatedAt: Date,
  branding: InspectionPdfBranding,
) {
  const actor = actorOf(inspection);
  const state = documentState(inspection, readiness);
  drawMendozaMark(doc, branding, 44, 20, 154, 48);
  drawSitrepMark(doc, 358, 23, { width: 193 });
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor(C.darkGreen)
    .text('MINISTERIO DE ENERGÍA Y AMBIENTE · SUBSECRETARÍA DE AMBIENTE · DGFA', 44, 71, { width: 355, lineBreak: false });
  doc.font('Helvetica').fontSize(6.2).fillColor(C.muted)
    .text('Documento 2 de 2 · Complementa el acta de campo', 350, 71, { width: 201, align: 'right', lineBreak: false });
  doc.moveTo(44, 86).lineTo(doc.page.width - 44, 86).lineWidth(1.5).strokeColor(C.darkGreen).stroke();

  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.darkGreen).text('INFORME TÉCNICO DE INSPECCIÓN', 44, 103, { characterSpacing: 0.45 });
  doc.font('Helvetica-Bold').fontSize(23).fillColor(C.navy).text(inspection.numero, 44, 120, { width: 315 });
  doc.font('Helvetica').fontSize(8.2).fillColor(C.muted).text(`Versión ${inspection.version} · Acta ${inspection.numeroActa || 'sin número asignado'}`, 44, 150, { width: 330 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.navy).text('EXPEDIENTE DE INSPECCIÓN', 366, 109, { width: 185, align: 'right' });
  doc.font('Helvetica').fontSize(7.6).fillColor(C.muted).text(`Estado: ${stateLabel(String(inspection.estado))}`, 366, 127, { width: 185, align: 'right' });
  doc.text(`Emitido ${formatDate(generatedAt, true)} ART`, 366, 143, { width: 185, align: 'right' });

  doc.roundedRect(44, 171, doc.page.width - 88, 31, 3).fill(state.fill);
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(state.ink).text(state.label, 55, 181, { width: doc.page.width - 110, align: 'center' });
  doc.y = 222;

  doc.fillColor(C.navy).font('Helvetica-Bold').fontSize(17).text(actor.razonSocial || 'Actor inspeccionado', 44, doc.y, { width: doc.page.width - 88 });
  doc.font('Helvetica').fontSize(8.8).fillColor(C.muted).text(`${inspection.tipoActor} · CUIT ${actor.cuit || 's/d'} · Acta ${inspection.numeroActa || 'sin número asignado'}`, 44, doc.y + 23, { width: doc.page.width - 88 });
  doc.y += 52;

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
  doc.y = y + 49;
  doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(
    `Creada ${formatDate(inspection.createdAt, true)}  ·  Actualizada ${formatDate(inspection.updatedAt, true)}  ·  Cierre de campo ${formatDate(inspection.cerradaCampoAt, true)}  ·  Plazo ${formatDate(inspection.plazoRespuestaAt, true)}`,
    44,
    doc.y,
    { width: doc.page.width - 88, align: 'left' },
  );
  doc.y += 18;
}

function metrics(doc: PDFKit.PDFDocument, inspection: any) {
  ensureSpace(doc, 68);
  const verified = inspection.comparaciones.filter((row: any) => row.resultado !== 'PENDIENTE').length;
  const differs = inspection.comparaciones.filter((row: any) => row.resultado === 'DIFIERE').length;
  const nonCompliant = inspection.items.filter((row: any) => row.resultado === 'NO_CUMPLE').length;
  const values = [
    ['Datos verificados', `${verified}/${inspection.comparaciones.length}`, C.blue],
    ['Diferencias', String(differs), differs ? C.amber : C.green],
    ['No conformidades', String(nonCompliant), nonCompliant ? C.amber : C.green],
    ['Evidencias / eventos', `${inspection.evidencias.length} / ${inspection.eventos.length}`, C.navy],
  ];
  const width = (doc.page.width - 88) / 4;
  const y = doc.y;
  doc.moveTo(44, y).lineTo(doc.page.width - 44, y).lineWidth(1).strokeColor(C.darkGreen).stroke();
  values.forEach(([label, value, color], index) => {
    const x = 44 + index * width;
    if (index) doc.moveTo(x, y + 8).lineTo(x, y + 52).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica-Bold').fontSize(6.6).fillColor(C.muted).text(String(label).toUpperCase(), x + 8, y + 11, { width: width - 16, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(15).fillColor(String(color)).text(String(value), x + 8, y + 27, { width: width - 16, align: 'center' });
  });
  doc.moveTo(44, y + 58).lineTo(doc.page.width - 44, y + 58).lineWidth(0.5).strokeColor(C.line).stroke();
  doc.y = y + 66;
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
  if (rows.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('No se incorporaron comparaciones a esta inspección.');
    doc.y += 18;
    return;
  }
  const widths = [110, 112, 112, 68, 105];
  const labels = ['Concepto', 'Declarado', 'Verificado', 'Resultado', 'Observación'];
  const x0 = 44;
  // Keep the first heading and at least one data row together. Without this
  // guard a page could end with a detached column header and force its first
  // record onto the following page.
  ensureSpace(doc, 100);
  const drawHeader = () => {
    const y = doc.y;
    let x = x0;
    labels.forEach((label, i) => {
      doc.rect(x, y, widths[i], 28).fillAndStroke(C.darkGreen, C.white);
      doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.white).text(label.toUpperCase(), x + 5, y + 10, { width: widths[i] - 10, align: i === 3 ? 'center' : 'left' });
      x += widths[i];
    });
    doc.y = y + 28;
  };
  drawHeader();
  rows.forEach((row) => {
    const values = [row.etiqueta, row.valorDeclarado || 'Sin dato', row.valorObservado || 'No verificado', String(row.resultado).replace('_', ' '), row.observacion || ''];
    const heights = values.map((value, i) => doc.heightOfString(String(value), { width: widths[i] - 10 }));
    const height = Math.max(34, Math.max(...heights) + 15);
    if (doc.y + height > doc.page.height - PAGE.bottom) { doc.addPage(); drawHeader(); }
    const y = doc.y;
    let x = x0;
    values.forEach((value, i) => {
      doc.rect(x, y, widths[i], height).fillAndStroke(row.resultado === 'DIFIERE' ? C.paleAmber : C.white, C.line);
      doc.font(i === 0 || i === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(i === 3 ? 7.1 : 7.8).fillColor(i === 3 ? statusColor(row.resultado) : C.ink)
        .text(String(value), x + 6, y + 7, { width: widths[i] - 12, lineGap: 1.2, align: i === 3 ? 'center' : 'left' });
      x += widths[i];
    });
    doc.y = y + height;
  });
}

function checklist(doc: PDFKit.PDFDocument, items: any[]) {
  if (items.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('No se incorporaron controles al acta.');
    doc.y += 18;
    return;
  }
  items.forEach((item, index) => {
    const evidenceNames = (item.evidencias || []).map((evidence: any) => `${evidence.anuladaAt ? '[ANULADA] ' : ''}${evidence.nombreOriginal}${evidence.anuladaAt && evidence.motivoAnulacion ? ` (${evidence.motivoAnulacion})` : ''}`).join(' · ');
    doc.font('Helvetica').fontSize(8.4);
    const observationHeight = item.observacion ? Math.max(12, doc.heightOfString(item.observacion, { width: 465 })) : 0;
    const evidenceHeight = evidenceNames ? Math.max(12, doc.heightOfString(`Evidencia vinculada: ${evidenceNames}`, { width: 465 })) : 0;
    const rowHeight = 40 + observationHeight + evidenceHeight + (item.observacion && evidenceNames ? 4 : 0);
    ensureSpace(doc, rowHeight + 5);
    const y = doc.y;
    doc.rect(44, y, 4, rowHeight).fill(statusColor(item.resultado));
    doc.rect(48, y, doc.page.width - 92, rowHeight).fillAndStroke(index % 2 ? C.soft : C.white, C.line);
    doc.font('Helvetica-Bold').fontSize(8.8).fillColor(C.navy).text(`${item.codigo || 'SIN CÓDIGO'} · ${item.etiqueta}`, 60, y + 9, { width: 350 });
    doc.font('Helvetica-Bold').fontSize(7.4).fillColor(statusColor(item.resultado)).text(String(item.resultado).replace(/_/g, ' '), 420, y + 10, { width: 125, align: 'right' });
    let cursor = y + 28;
    if (item.observacion) {
      doc.font('Helvetica').fontSize(8.4).fillColor(C.ink).text(item.observacion, 60, cursor, { width: 475, lineGap: 2 });
      cursor += observationHeight + 2;
    }
    if (evidenceNames) {
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.blue).text(`Evidencia vinculada: ${evidenceNames}`, 60, cursor, { width: 475, lineGap: 1 });
      cursor += evidenceHeight;
    }
    doc.y = Math.max(y + rowHeight, cursor + 7) + 6;
  });
}

function evidenceGallery(doc: PDFKit.PDFDocument, inspection: any, preparedImages: Map<string, PreparedInspectionImage>) {
  const photos = inspection.evidencias.filter((item: any) => item.tipo === 'FOTO' && !item.anuladaAt && !item.intercambioId);
  if (photos.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('No se incorporaron fotografías vigentes al expediente.');
    doc.y += 18;
    return;
  }
  const gap = 12;
  const width = (doc.page.width - 88 - gap) / 2;
  for (let i = 0; i < photos.length; i += 2) {
    const row = photos.slice(i, i + 2);
    doc.font('Helvetica').fontSize(7.4);
    const rowHeight = Math.max(...row.map((photo: any) => {
      const description = photo.descripcion || 'Sin descripción adicional.';
      return 222 + Math.min(44, doc.heightOfString(description, { width: width - 20, lineGap: 1.5 }));
    }), 246);
    ensureSpace(doc, rowHeight + 12);
    const y = doc.y;
    row.forEach((photo: any, column: number) => {
      const x = 44 + column * (width + gap);
      const prepared = preparedImages.get(photo.id);
      doc.roundedRect(x, y, width, rowHeight, 4).fillAndStroke(C.white, C.line);
      doc.rect(x + 7, y + 7, width - 14, 139).fill(C.soft);
      if (prepared?.buffer) doc.image(prepared.buffer, x + 7, y + 7, { fit: [width - 14, 139], align: 'center', valign: 'center' });
      else doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text(
        prepared?.status === 'MISSING'
          ? 'El archivo no estaba disponible al emitir esta copia; el registro y la huella permanecen preservados.'
          : 'No fue posible representar la imagen; el original y la huella permanecen preservados.',
        x + 24,
        y + 59,
        { width: width - 48, align: 'center' },
      );
      doc.font('Helvetica-Bold').fontSize(8.2).fillColor(C.navy)
        .text(`E-${String(i + column + 1).padStart(3, '0')} · ${photo.nombreOriginal}`, x + 10, y + 154, { width: width - 20, height: 22, ellipsis: true });
      const target = evidenceTargetLabel(inspection, photo);
      doc.font('Helvetica').fontSize(7.2).fillColor(C.muted).text(target, x + 10, y + 176, { width: width - 20, height: 20, ellipsis: true });
      doc.font('Helvetica').fontSize(7.3).fillColor(C.ink)
        .text(photo.descripcion || 'Sin descripción adicional.', x + 10, y + 198, { width: width - 20, height: rowHeight - 239, lineGap: 1.5, ellipsis: true });
      const coordinates = photo.latitud != null && photo.longitud != null ? ` · ${photo.latitud}, ${photo.longitud}` : '';
      doc.font('Helvetica').fontSize(6.6).fillColor(C.muted)
        .text(`Captura ${formatDate(photo.capturadaAt, true)}${coordinates}`, x + 10, y + rowHeight - 30, { width: width - 20, height: 10, ellipsis: true });
      doc.font('Courier').fontSize(6.1).fillColor(C.blue)
        .text(`SHA-256 ${(photo.sha256 || 'no disponible').slice(0, 24)}…`, x + 10, y + rowHeight - 17, { width: width - 20, lineBreak: false });
    });
    doc.y = y + rowHeight + 10;
  }
}

function evidenceTargetLabel(inspection: any, evidence: any): string {
  if (evidence.intercambioId) {
    const exchange = (inspection.intercambios || []).find((row: any) => row.id === evidence.intercambioId);
    return exchange
      ? `Intercambio formal #${exchange.secuencia} · ${stateLabel(String(exchange.tipo))}`
      : 'Intercambio formal del expediente';
  }
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

function timeline(doc: PDFKit.PDFDocument, inspection: any) {
  const events = inspection.eventos || [];
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.darkGreen)
    .text('ANTECEDENTE TÉCNICO PARA INTERVENCIÓN LEGAL; NO ES SANCIÓN NI ACTO FINAL', 44, doc.y, { width: doc.page.width - 88, align: 'center' });
  doc.y += 22;
  if (events.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('No se registraron eventos de trazabilidad.');
    doc.y += 18;
    return;
  }
  events.forEach((event: any) => {
    const attachments = event.adjuntos || [];
    const inspectedSide = event.tipo === 'RESPUESTA_ACTOR';
    const side = inspectedSide ? 'INSPECCIONADO' : 'ORGANISMO';
    const action = event.tipo === 'RESPUESTA_ACTOR'
      ? 'RESPUESTA'
      : event.tipo === 'SOLICITUD_CORRECCION' || event.tipo === 'NOTIFICACION_PREPARADA'
        ? 'REQUERIMIENTO'
        : 'ACTUACIÓN';
    const deadlineValue = event.metadata?.plazoRespuestaAt || (action === 'REQUERIMIENTO' ? inspection.plazoRespuestaAt : null);
    const deadline = deadlineValue ? `Plazo / vencimiento: ${formatDate(deadlineValue, true)}` : 'Plazo / vencimiento: no consignado';
    doc.font('Helvetica').fontSize(8.2);
    const detailHeight = event.detalle ? Math.max(14, doc.heightOfString(event.detalle, { width: 455, lineGap: 2 })) : 0;
    const emailHeight = event.canal === 'EMAIL' ? 16 : 0;
    const eventHeight = 58 + detailHeight + emailHeight + attachments.length * 15;
    ensureSpace(doc, eventHeight);
    const y = doc.y;
    const color = event.estadoEntrega === 'NO_ENVIADO' ? C.amber : inspectedSide ? C.blue : C.green;
    doc.rect(44, y, 4, eventHeight).fill(color);
    doc.rect(48, y, doc.page.width - 92, eventHeight).fillAndStroke(C.white, C.line);
    doc.roundedRect(60, y + 9, inspectedSide ? 96 : 82, 19, 3).fill(inspectedSide ? '#EAF1FF' : C.paleGreen);
    doc.font('Helvetica-Bold').fontSize(6.7).fillColor(color).text(side, 64, y + 15, { width: inspectedSide ? 88 : 74, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8.6).fillColor(C.navy).text(`${action} · ${event.titulo}`, 156, y + 10, { width: 245 });
    doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(`${formatDate(event.createdAt, true)} · ${event.usuario.nombre} ${event.usuario.apellido || ''}`.trim(), 397, y + 10, { width: 138, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(7.2).fillColor(deadlineValue ? C.amber : C.muted).text(deadline, 60, y + 34, { width: 475 });
    let cursor = y + 49;
    if (event.detalle) {
      doc.font('Helvetica').fontSize(8.2).fillColor(C.ink).text(event.detalle, 60, cursor, { width: 475, lineGap: 2 });
      cursor += detailHeight + 4;
    }
    if (event.canal === 'EMAIL') {
      doc.font('Helvetica-Bold').fontSize(7.4).fillColor(color).text(`Comunicación por correo: ${event.estadoEntrega === 'NO_ENVIADO' ? 'NO ENVIADA' : event.estadoEntrega || 'sin estado'}${event.destinatario ? ` · ${event.destinatario}` : ''}`, 60, cursor, { width: 475 });
      cursor += 15;
    }
    attachments.forEach((file: any) => {
      doc.font('Helvetica-Bold').fontSize(7.4).fillColor(C.blue).text(`Adjunto de ${side.toLowerCase()}: ${file.nombreOriginal}`, 60, cursor, { width: 475 });
      cursor += 15;
    });
    doc.y = Math.max(y + eventHeight, cursor + 7) + 7;
  });
}

function formalExchange(doc: PDFKit.PDFDocument, inspection: any) {
  const exchanges = [...(inspection.intercambios || [])]
    .sort((left: any, right: any) => Number(left.secuencia || 0) - Number(right.secuencia || 0));
  if (exchanges.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
      .text('No se registraron presentaciones formales entre el organismo y el inspeccionado en esta versión del expediente.');
    doc.y += 18;
    return;
  }

  const byId = new Map(exchanges.map((entry: any) => [entry.id, entry]));
  exchanges.forEach((entry: any) => {
    ensureSpace(doc, 108);
    const inspectedSide = entry.parte === 'INSPECCIONADO';
    const color = inspectedSide ? C.blue : C.green;
    const side = inspectedSide ? 'INSPECCIONADO' : 'ORGANISMO';
    const author = entry.autor
      ? `${entry.autor.nombre || ''} ${entry.autor.apellido || ''}`.trim()
      : 'Autor no informado';
    const parent = entry.respondeAId ? byId.get(entry.respondeAId) as any : null;
    const deadline = entry.plazoRespuestaAt || parent?.plazoRespuestaAt || null;
    const startY = doc.y;

    doc.rect(44, startY, 4, 48).fill(color);
    doc.rect(48, startY, doc.page.width - 92, 48).fillAndStroke(C.white, C.line);
    doc.roundedRect(60, startY + 8, inspectedSide ? 96 : 82, 18, 3)
      .fill(inspectedSide ? '#EAF1FF' : C.paleGreen);
    doc.font('Helvetica-Bold').fontSize(6.6).fillColor(color)
      .text(side, 64, startY + 14, { width: inspectedSide ? 88 : 74, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(8.6).fillColor(C.navy)
      .text(`#${entry.secuencia} · ${stateLabel(String(entry.tipo))}`, 164, startY + 9, { width: 226 });
    doc.font('Helvetica').fontSize(6.9).fillColor(C.muted)
      .text(`${formatDate(entry.createdAt, true)} · ${author}`, 392, startY + 9, { width: 143, align: 'right' });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.ink)
      .text(entry.asunto || 'Presentación sin asunto', 60, startY + 30, { width: 475, height: 13, ellipsis: true });
    doc.y = startY + 56;

    const procedural = [
      `Canal ${entry.canal || 'sin informar'}`,
      `Versión del expediente ${entry.versionExpediente || 's/d'}`,
      parent ? `Responde a #${parent.secuencia}` : '',
      deadline ? `Plazo de referencia ${formatDate(deadline, true)}` : 'Sin plazo consignado',
      entry.presentadoFueraDePlazo ? 'PRESENTACIÓN FUERA DE PLAZO' : 'Presentación dentro del plazo o sin vencimiento aplicable',
    ].filter(Boolean).join(' · ');
    doc.font('Helvetica-Bold').fontSize(7.2)
      .fillColor(entry.presentadoFueraDePlazo ? C.red : C.muted)
      .text(procedural, 56, doc.y, { width: 483, lineGap: 1.5 });
    doc.y += 7;

    doc.font('Helvetica').fontSize(9).fillColor(C.ink)
      .text(entry.cuerpo || 'Sin cuerpo registrado.', 56, doc.y, { width: 483, lineGap: 2.5 });
    doc.y += 10;

    const attachments = entry.adjuntos || [];
    if (attachments.length) {
      // Keep the attachment label with at least the first file and its digest.
      ensureSpace(doc, 60);
      doc.font('Helvetica-Bold').fontSize(7.4).fillColor(C.navy)
        .text(`ADJUNTOS DE LA PRESENTACIÓN (${attachments.length})`, 56, doc.y, { width: 483 });
      doc.y += 13;
      attachments.forEach((file: any, index: number) => {
        ensureSpace(doc, 31);
        const attachmentText = `${index + 1}. ${file.nombreOriginal || 'Archivo sin nombre'} · ${file.mimeDetectado || 'tipo no informado'} · ${file.bytes != null ? `${file.bytes} bytes` : 'tamaño no informado'}`;
        doc.font('Helvetica-Bold').fontSize(7.4).fillColor(C.blue)
          .text(attachmentText, 64, doc.y, { width: 467 });
        doc.y += 11;
        doc.font('Courier').fontSize(6).fillColor(C.muted)
          .text(`SHA-256 ${file.sha256 || 'no disponible'}`, 64, doc.y, { width: 467 });
        doc.y += 14;
      });
    }

    ensureSpace(doc, 59);
    doc.font('Helvetica-Bold').fontSize(6.8).fillColor(C.muted)
      .text('HUELLAS DE LA PRESENTACIÓN Y DEL ENCADENAMIENTO', 56, doc.y, { width: 483 });
    doc.y += 12;
    [
      ['Contenido', entry.contenidoSha256],
      ['Anterior', entry.hashAnterior || 'GÉNESIS'],
      ['Cadena', entry.hashCadena],
    ].forEach(([label, value]) => {
      doc.font('Helvetica-Bold').fontSize(6.2).fillColor(C.navy).text(`${label}:`, 64, doc.y, { width: 54 });
      doc.font('Courier').fontSize(5.9).fillColor(C.blue).text(value || 'no disponible', 118, doc.y, { width: 413, lineBreak: false, ellipsis: true });
      doc.y += 11;
    });
    doc.moveTo(44, doc.y + 2).lineTo(doc.page.width - 44, doc.y + 2).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.y += 13;
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

function priorityFindings(doc: PDFKit.PDFDocument, inspection: any) {
  const rows = [
    ...inspection.comparaciones
      .filter((row: any) => row.resultado === 'DIFIERE' || row.resultado === 'NO_VERIFICADO')
      .map((row: any) => ({ code: row.codigo, title: row.etiqueta, result: row.resultado, detail: `Declarado: ${row.valorDeclarado || 'Sin dato'} · Verificado: ${row.valorObservado || 'No verificado'}${row.observacion ? ` · ${row.observacion}` : ''}`, evidence: row.evidencias || [] })),
    ...inspection.items
      .filter((row: any) => row.resultado === 'NO_CUMPLE')
      .map((row: any) => ({ code: row.codigo, title: row.etiqueta, result: row.resultado, detail: row.observacion || 'No se consignó una descripción adicional.', evidence: row.evidencias || [] })),
  ];
  if (!rows.length) {
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('No se registraron diferencias ni controles no conformes en esta versión.');
    doc.y += 18;
    return;
  }
  rows.forEach((row: any, index: number) => {
    const evidence = row.evidence.map((item: any) => item.nombreOriginal).join(' · ');
    doc.font('Helvetica').fontSize(8.4);
    const detailHeight = Math.max(14, doc.heightOfString(row.detail, { width: 475, lineGap: 2 }));
    const evidenceHeight = evidence ? Math.max(12, doc.heightOfString(`Evidencias: ${evidence}`, { width: 475, lineGap: 1 })) : 0;
    const height = 44 + detailHeight + evidenceHeight;
    ensureSpace(doc, height + 7);
    const y = doc.y;
    doc.rect(44, y, 4, height).fill(statusColor(row.result));
    doc.rect(48, y, doc.page.width - 92, height).fillAndStroke(C.white, C.line);
    doc.font('Helvetica-Bold').fontSize(8.9).fillColor(C.navy).text(`H-${String(index + 1).padStart(2, '0')} · ${row.code || 'SIN CÓDIGO'} · ${row.title}`, 60, y + 9, { width: 355 });
    doc.font('Helvetica-Bold').fontSize(7.4).fillColor(statusColor(row.result)).text(String(row.result).replace(/_/g, ' '), 420, y + 10, { width: 115, align: 'right' });
    doc.font('Helvetica').fontSize(8.4).fillColor(C.ink).text(row.detail, 60, y + 28, { width: 475, lineGap: 2 });
    if (evidence) doc.font('Helvetica-Bold').fontSize(7.4).fillColor(C.blue).text(`Evidencias: ${evidence}`, 60, y + 31 + detailHeight, { width: 475, lineGap: 1 });
    doc.y = y + height + 6;
  });
}

export async function streamInspectionTechnicalReportPdf(
  res: Response,
  inspection: any,
  resolveEvidence: (key: string) => string,
): Promise<void> {
  const generatedAt = new Date();
  const fingerprint = buildInspectionDocumentFingerprint(inspection);
  const readiness = inspectDossierReadiness(inspection);
  const state = documentState(inspection, readiness);
  const branding = await loadInspectionPdfBranding();
  const preparedImages = await prepareInspectionPdfImages(inspection.evidencias || [], resolveEvidence);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE.top, right: PAGE.right, bottom: PAGE.bottom, left: PAGE.left },
    bufferPages: true,
    info: {
      Title: `Informe técnico de inspección ${inspection.numero}`,
      Author: 'Ministerio de Energía y Ambiente · DGFA · SITREP Mendoza',
      Subject: `Expediente ${inspection.numero} · Acta ${inspection.numeroActa || 'sin número'}`,
      Keywords: 'SITREP, inspección ambiental, trazabilidad, evidencia, Mendoza',
      Creator: 'SITREP Mendoza',
      Producer: 'SITREP Mendoza · PDFKit',
      CreationDate: generatedAt,
      ModDate: generatedAt,
    },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=informe_tecnico_${inspection.numero}.pdf`);
  doc.pipe(res);

  header(doc, inspection, readiness, generatedAt, branding);
  const technical = inspection.informeTecnico && typeof inspection.informeTecnico === 'object' ? inspection.informeTecnico : {};
  const actor = actorOf(inspection);

  section(doc, 'Resumen ejecutivo', 'Lectura inicial del alcance, el resultado y el respaldo documental');
  metrics(doc, inspection);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.darkGreen).text('CONCLUSIÓN TÉCNICA · EXTRACTO', 44, doc.y + 2);
  doc.y += 18;
  const conclusion = String(technical.conclusion || inspection.observaciones || 'No se registró una conclusión técnica.');
  narrativeBox(doc, conclusion.length > 620 ? `${conclusion.slice(0, conclusion.lastIndexOf(' ', 620))}… (ver conclusión completa)` : conclusion);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(C.darkGreen).text('RECOMENDACIÓN · EXTRACTO', 44, doc.y + 2);
  doc.y += 18;
  const recommendation = String(technical.recomendacion || 'No se registró una recomendación técnica.');
  narrativeBox(doc, recommendation.length > 420 ? `${recommendation.slice(0, recommendation.lastIndexOf(' ', 420))}… (ver recomendación completa)` : recommendation);

  // Keep the section title with the first finding instead of leaving an
  // orphan heading at the bottom of the executive-summary page.
  ensureSpace(doc, 160);
  section(doc, 'Hallazgos prioritarios', 'Diferencias declarativas y controles no conformes que requieren lectura inmediata');
  priorityFindings(doc, inspection);

  const technicalSections = [
    ['1. Objetivo', technical.objetivo || `No se registró un objetivo técnico específico para ${actor.razonSocial || 'la entidad inspeccionada'}. Esta ausencia se explicita para evitar que el sistema complete el criterio profesional del inspector.`],
    ['2. Antecedentes y referencias', technical.antecedentes || [technical.expedienteElectronico ? `Expediente electrónico: ${technical.expedienteElectronico}.` : '', technical.referencias || '', `Inspección SITREP ${inspection.numero}${inspection.numeroActa ? `, acta ${inspection.numeroActa}` : ''}.`].filter(Boolean).join('\n\n')],
    ['3. Evaluación técnica', technical.evaluacion || inspection.observaciones || 'No se incorporó una evaluación narrativa adicional. Los resultados verificables se detallan en las comparativas, el checklist y las evidencias de este informe.'],
    ['4. Conclusión técnica', technical.conclusion || 'No se registró una conclusión técnica específica. Esta ausencia se explicita para evitar inferencias automáticas sobre los hallazgos.'],
    ['5. Recomendación técnica', technical.recomendacion || 'No se registró una recomendación técnica específica. Toda medida o derivación deberá ser consignada y validada por el área competente.'],
  ];
  technicalSections.forEach(([title, body]) => {
    section(doc, title);
    doc.font('Helvetica').fontSize(10.1).fillColor(C.ink).text(String(body), 44, doc.y, { width: doc.page.width - 88, lineGap: 3.2 });
    doc.y += 9;
  });

  section(doc, 'Marco normativo y alcance', 'Referencia general prudente; la calificación jurídica corresponde al área legal competente');
  doc.font('Helvetica').fontSize(10).fillColor(C.ink).text('El expediente se documenta en el marco general de la Ley Provincial 5.917, el Decreto Provincial 2.625/1999 y la Ley Nacional 24.051, según resulte aplicable. Los hallazgos son constataciones y evaluaciones técnicas. La determinación de obligaciones concretas, artículos aplicables, infracciones, sanciones y efectos jurídicos requiere revisión legal y no es inferida automáticamente por SITREP.', 44, doc.y, { width: doc.page.width - 88, lineGap: 3.2 });
  doc.y += 10;

  section(doc, 'Anexo técnico de constatación', 'Matrices, controles, evidencias y trazabilidad que sustentan la evaluación profesional');

  ensureSpace(doc, 150);
  section(doc, 'Declarado y verificado', 'Datos declarados al abrir la inspección y resultado constatado en campo');
  comparisonTable(doc, inspection.comparaciones);

  section(doc, 'Checklist de inspección', 'Controles aplicados según el tipo de actor y evidencia vinculada a cada punto');
  checklist(doc, inspection.items);

  if (inspection.evidencias.some((item: any) => item.tipo === 'FOTO' && !item.anuladaAt && !item.intercambioId)) {
    section(doc, 'Evidencia fotográfica', 'Láminas de dos imágenes con vínculo, descripción, captura y huella técnica');
    evidenceGallery(doc, inspection, preparedImages);
  }

  section(doc, 'Inventario de evidencias', 'Archivos vigentes y anulados, vínculos, autores, tiempos, observaciones y transcripciones');
  evidenceInventory(doc, inspection);

  section(doc, 'Trazabilidad operativa', 'Bitácora de estados, actuaciones, comunicaciones preparadas y eventos internos del expediente');
  timeline(doc, inspection);

  section(doc, 'Intercambio formal y contradicción', 'Presentaciones inmutables del organismo y del inspeccionado, con plazos, adjuntos y encadenamiento criptográfico');
  formalExchange(doc, inspection);

  section(doc, 'Integridad y cadena de custodia', 'Identificadores técnicos para detectar sustituciones en los datos fuente y en las evidencias');
  integrityLedger(doc, inspection, fingerprint);

  section(doc, 'Control documental y remisión', 'Condición de la versión exportada y responsabilidad profesional');
  const readinessText = readiness.ready
    ? `Integridad formal: ${readiness.completed}/${readiness.total} controles documentales completos.`
    : `Integridad formal: ${readiness.completed}/${readiness.total}. Pendiente: ${readiness.missing.join('; ')}.`;
  const closureParagraphs = [
    `Este informe técnico complementa el acta de inspección ${inspection.numeroActa || 'sin número asignado'}. Ambas piezas pertenecen al expediente ${inspection.numero} y deben conservarse y remitirse conjuntamente cuando corresponda la intervención del área legal.`,
    'Antecedente técnico para intervención legal; no es sanción ni acto final. SITREP no presume el dictamen ni reemplaza su contenido.',
    readinessText,
    'La huella SHA-256 identifica los datos fuente de esta versión y permite detectar cambios posteriores. No reemplaza la firma de los intervinientes ni una firma digital emitida conforme al régimen aplicable.',
  ];
  closureParagraphs.forEach((paragraph) => {
    doc.font('Helvetica').fontSize(9.2).fillColor(C.ink).text(paragraph, 44, doc.y, { width: doc.page.width - 88, lineGap: 2.8 });
    doc.y += 8;
  });
  ensureSpace(doc, 104);
  const signatureY = doc.y + 10;
  const half = (doc.page.width - 104) / 2;
  doc.moveTo(44, signatureY + 37).lineTo(44 + half, signatureY + 37).lineWidth(0.7).strokeColor(C.line).stroke();
  doc.moveTo(60 + half, signatureY + 37).lineTo(doc.page.width - 44, signatureY + 37).lineWidth(0.7).strokeColor(C.line).stroke();
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(C.navy).text(`${inspection.inspector.nombre} ${inspection.inspector.apellido || ''}`.trim(), 44, signatureY + 45, { width: half, align: 'center' });
  doc.font('Helvetica').fontSize(7.1).fillColor(C.muted).text(`Responsable técnico${inspection.datosActa?.area ? ` · ${inspection.datosActa.area}` : ''}`, 44, signatureY + 59, { width: half, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor(C.navy).text('Revisión / aprobación institucional', 60 + half, signatureY + 45, { width: half, align: 'center' });
  doc.font('Helvetica').fontSize(7.1).fillColor(C.muted).text('Firma o validación no incorporada en esta exportación', 60 + half, signatureY + 59, { width: half, align: 'center' });
  doc.y = signatureY + 83;

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Draw running furniture after pagination is final. Drawing it from a
    // pageAdded listener lets PDFKit's internal line wrapper reset the cursor
    // and can place continuation content over the header.
    if (i > range.start) runningHeader(doc, inspection, state.label, branding);
    // El pie vive dentro del margen reservado. PDFKit puede crear páginas
    // fantasma al escribir allí si conserva el margen inferior de flujo.
    const flowBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 55;
    doc.moveTo(44, footerY - 8).lineTo(doc.page.width - 44, footerY - 8).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(6.8).fillColor(C.muted)
      .text(`Informe técnico · ${inspection.numero} · v${inspection.version}`, 44, footerY, { width: 205, lineBreak: false })
      .text(`Huella ${fingerprint.slice(0, 16)}…`, 224, footerY, { width: 170, align: 'center', lineBreak: false })
      .text(`Página ${i + 1} de ${range.count}`, 421, footerY, { width: 130, align: 'right', lineBreak: false });
    doc.fontSize(6.1).text(`Gobierno de Mendoza · Ministerio de Energía y Ambiente · Documento oficial generado por SITREP · ${formatDate(generatedAt, true)} ART`, 44, footerY + 13, { width: doc.page.width - 88, align: 'center', lineBreak: false });
    doc.page.margins.bottom = flowBottomMargin;
  }
  doc.end();
}
