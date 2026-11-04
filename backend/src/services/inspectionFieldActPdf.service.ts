import { syntheticPreviewEnabled } from '../config/syntheticPreview';
import { inspectionMeasureText } from '../domain/inspectionFieldModel';
import { inspectionMapSummary, inspectionPointText } from '../domain/inspectionMapGeometry';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { drawSyntheticPreviewFooter } from './syntheticPreviewPdf.service';
import {
  buildInspectionDocumentFingerprint,
  buildInspectionFieldActFingerprint,
} from './inspectionDocumentIntegrity.service';
import { prepareInspectionPdfImages, type PreparedInspectionImage } from './inspectionPdfImage.service';
import {
  drawInstitutionalMasthead,
  drawInstitutionalRule,
  loadInspectionPdfBranding,
  type InspectionPdfBranding,
} from './inspectionPdfBranding.service';
import { buildInspectionPdfQr, drawInspectionPdfQrCard } from './inspectionPdfQr.service';
import { drawInspectionPdfBlocks, inspectionEvidenceReference, measureInspectionPdfBlocks, type InspectionPdfTextBlock } from './inspectionPdfLayout.service';

const COLORS = {
  green: '#1B5E3C',
  accent: '#0D8A4F',
  ink: '#111827',
  muted: '#64748B',
  line: '#9CA3AF',
  soft: '#F4F7F5',
  successSoft: '#EAF7F0',
  warning: '#9A5B00',
  warningSoft: '#FFF4D6',
  error: '#A61B1B',
  errorSoft: '#FDECEC',
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
  danosEstado?: 'OBSERVADOS' | 'NO_OBSERVADOS' | 'NO_VERIFICADO';
  danosDetalle?: string;
  tercerosTestigosEstado?: 'IDENTIFICADOS' | 'NO_IDENTIFICADOS' | 'NO_VERIFICADO';
  tercerosTestigosDetalle?: string;
  libroOperacionesEstado?: 'EXHIBIDO' | 'NO_EXHIBIDO' | 'NO_DISPONIBLE' | 'SECUESTRADO' | 'NO_APLICA' | 'NO_VERIFICADO';
  libroOperacionesDetalle?: string;
  firmaIntervinienteEstado?: 'FIRMADA' | 'NEGATIVA' | 'IMPOSIBILIDAD' | 'AUSENTE' | 'PENDIENTE';
  firmaIntervinienteDetalle?: string;
  copiaActaEstado?: 'ENTREGADA' | 'NEGATIVA_RECEPCION' | 'NO_ENTREGADA' | 'PENDIENTE';
  copiaActaDetalle?: string;
  domicilioLegal?: string;
  notificacionEstado?: 'COMUNICADA_EN_ACTA' | 'CONSTANCIA_FORMAL' | 'NO_REALIZADA' | 'PENDIENTE';
  notificacionDetalle?: string;
};

type Article44Formality = {
  key: 'damages' | 'witnesses' | 'operationsBook' | 'signature' | 'copyDelivery' | 'notification';
  label: string;
  state: string;
  detail: string;
  resolved: boolean;
  adverse: boolean;
  unresolvedReason?: string;
};

export type InspectionFieldActPresentation = {
  status: 'CERRADA_COMPLETA' | 'BORRADOR_PENDIENTE_CIERRE' | 'BORRADOR_INCOMPLETA' | 'CERRADA_INCOMPLETA';
  statusLabel: string;
  statusExplanation: string;
  closed: boolean;
  /** All six structured controls contain the minimum documentary context. */
  complete: boolean;
  formalities: Article44Formality[];
  unresolved: Article44Formality[];
  adverse: Article44Formality[];
  hasAdverseOutcomes: boolean;
};

const DAMAGE_STATES: Record<string, string> = {
  OBSERVADOS: 'Daños observados',
  NO_OBSERVADOS: 'Sin daños observados',
  NO_VERIFICADO: 'No verificado',
};

const WITNESS_STATES: Record<string, string> = {
  IDENTIFICADOS: 'Terceros o testigos identificados',
  NO_IDENTIFICADOS: 'Sin terceros o testigos identificados',
  NO_VERIFICADO: 'No verificado',
};

const OPERATIONS_BOOK_STATES: Record<string, string> = {
  EXHIBIDO: 'Libro exhibido',
  NO_EXHIBIDO: 'Libro no exhibido',
  NO_DISPONIBLE: 'Libro no disponible',
  SECUESTRADO: 'Libro secuestrado',
  NO_APLICA: 'No aplica',
  NO_VERIFICADO: 'No verificado',
};

const SIGNATURE_STATES: Record<string, string> = {
  FIRMADA: 'Firma informada como realizada',
  NEGATIVA: 'Negativa a firmar',
  IMPOSIBILIDAD: 'Imposibilidad de firmar',
  AUSENTE: 'Interviniente ausente',
  PENDIENTE: 'Pendiente',
};

const COPY_STATES: Record<string, string> = {
  ENTREGADA: 'Copia entregada',
  NEGATIVA_RECEPCION: 'Negativa a recibir la copia',
  NO_ENTREGADA: 'Copia no entregada',
  PENDIENTE: 'Pendiente',
};

const NOTIFICATION_STATES: Record<string, string> = {
  COMUNICADA_EN_ACTA: 'Comunicada en el acta',
  CONSTANCIA_FORMAL: 'Constancia formal registrada',
  NO_REALIZADA: 'No realizada',
  PENDIENTE: 'Pendiente',
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

function hasText(input: unknown): boolean {
  return typeof input === 'string' && input.trim().length > 0;
}

function stateLabel(state: unknown, labels: Record<string, string>): string {
  if (!hasText(state)) return 'No consignado';
  return labels[String(state)] || `Estado no reconocido: ${String(state)}`;
}

/**
 * Builds the exact documentary status rendered in the field act. Completeness
 * comes from datosActa; the workflow state only prevents a reopened field act
 * from being labelled as closed. Later reports and exchanges are ignored.
 */
export function buildInspectionFieldActPresentation(inspection: any): InspectionFieldActPresentation {
  const act = actDataOf(inspection);
  const damagesResolved = act.danosEstado === 'NO_OBSERVADOS'
    || (act.danosEstado === 'OBSERVADOS' && hasText(act.danosDetalle));
  const witnessesResolved = act.tercerosTestigosEstado === 'NO_IDENTIFICADOS'
    || (act.tercerosTestigosEstado === 'IDENTIFICADOS' && hasText(act.tercerosTestigosDetalle));
  const operationsBookResolved = Boolean(
    act.libroOperacionesEstado
    && ['EXHIBIDO', 'NO_EXHIBIDO', 'NO_DISPONIBLE', 'SECUESTRADO', 'NO_APLICA'].includes(act.libroOperacionesEstado)
    && hasText(act.libroOperacionesDetalle),
  );
  const signatureResolved = act.firmaIntervinienteEstado === 'FIRMADA'
    || (['NEGATIVA', 'IMPOSIBILIDAD', 'AUSENTE'].includes(String(act.firmaIntervinienteEstado || ''))
      && hasText(act.firmaIntervinienteDetalle));
  const copyDeliveryResolved = Boolean(
    act.copiaActaEstado
    && ['ENTREGADA', 'NEGATIVA_RECEPCION', 'NO_ENTREGADA'].includes(act.copiaActaEstado)
    && hasText(act.copiaActaDetalle),
  );
  const notificationResolved = Boolean(
    act.notificacionEstado
    && ['COMUNICADA_EN_ACTA', 'CONSTANCIA_FORMAL', 'NO_REALIZADA'].includes(act.notificacionEstado)
    && hasText(act.domicilioLegal)
    && hasText(act.notificacionDetalle)
    && typeof act.plazoDescargoDias === 'number',
  );

  const formalities: Article44Formality[] = [
    {
      key: 'damages',
      label: 'Daños a personas o bienes',
      state: stateLabel(act.danosEstado, DAMAGE_STATES),
      detail: value(act.danosDetalle, 'Sin detalle adicional consignado.'),
      resolved: damagesResolved,
      adverse: act.danosEstado === 'OBSERVADOS',
      unresolvedReason: !act.danosEstado
        ? 'Falta consignar el estado.'
        : act.danosEstado === 'NO_VERIFICADO'
          ? 'La verificación permanece pendiente.'
          : act.danosEstado === 'OBSERVADOS' && !hasText(act.danosDetalle)
            ? 'Falta describir los daños observados.'
            : undefined,
    },
    {
      key: 'witnesses',
      label: 'Terceros y testigos intervinientes',
      state: stateLabel(act.tercerosTestigosEstado, WITNESS_STATES),
      detail: value(act.tercerosTestigosDetalle, 'Sin detalle adicional consignado.'),
      resolved: witnessesResolved,
      adverse: false,
      unresolvedReason: !act.tercerosTestigosEstado
        ? 'Falta consignar el estado.'
        : act.tercerosTestigosEstado === 'NO_VERIFICADO'
          ? 'La verificación permanece pendiente.'
          : act.tercerosTestigosEstado === 'IDENTIFICADOS' && !hasText(act.tercerosTestigosDetalle)
            ? 'Falta identificar o describir a los terceros/testigos.'
            : undefined,
    },
    {
      key: 'operationsBook',
      label: 'Libro de Registro de Operaciones',
      state: stateLabel(act.libroOperacionesEstado, OPERATIONS_BOOK_STATES),
      detail: value(act.libroOperacionesDetalle, 'Sin constancia circunstanciada consignada.'),
      resolved: operationsBookResolved,
      adverse: ['NO_EXHIBIDO', 'NO_DISPONIBLE', 'SECUESTRADO'].includes(String(act.libroOperacionesEstado || '')),
      unresolvedReason: !act.libroOperacionesEstado
        ? 'Falta consignar el estado.'
        : act.libroOperacionesEstado === 'NO_VERIFICADO'
          ? 'La verificación permanece pendiente.'
          : !hasText(act.libroOperacionesDetalle)
            ? 'Falta la constancia circunstanciada del libro.'
            : undefined,
    },
    {
      key: 'signature',
      label: 'Firma e intervinientes',
      state: stateLabel(act.firmaIntervinienteEstado, SIGNATURE_STATES),
      detail: value(
        act.firmaIntervinienteDetalle,
        act.firmaIntervinienteEstado === 'FIRMADA'
          ? 'Sin detalle adicional consignado. Este PDF no incorpora una firma gráfica.'
          : 'Sin constancia adicional consignada.',
      ),
      resolved: signatureResolved,
      adverse: ['NEGATIVA', 'IMPOSIBILIDAD', 'AUSENTE'].includes(String(act.firmaIntervinienteEstado || '')),
      unresolvedReason: !act.firmaIntervinienteEstado
        ? 'Falta consignar el estado de firma.'
        : act.firmaIntervinienteEstado === 'PENDIENTE'
          ? 'La firma o su constancia permanece pendiente.'
          : act.firmaIntervinienteEstado !== 'FIRMADA' && !hasText(act.firmaIntervinienteDetalle)
            ? 'Falta documentar la negativa, imposibilidad o ausencia.'
            : undefined,
    },
    {
      key: 'copyDelivery',
      label: 'Entrega de copia del acta',
      state: stateLabel(act.copiaActaEstado, COPY_STATES),
      detail: value(act.copiaActaDetalle, 'Sin constancia de entrega o recepción consignada.'),
      resolved: copyDeliveryResolved,
      adverse: ['NEGATIVA_RECEPCION', 'NO_ENTREGADA'].includes(String(act.copiaActaEstado || '')),
      unresolvedReason: !act.copiaActaEstado
        ? 'Falta consignar el estado de entrega.'
        : act.copiaActaEstado === 'PENDIENTE'
          ? 'La entrega o su constancia permanece pendiente.'
          : !hasText(act.copiaActaDetalle)
            ? 'Falta documentar la entrega, negativa o falta de entrega.'
            : undefined,
    },
    {
      key: 'notification',
      label: 'Notificación y domicilio legal',
      state: stateLabel(act.notificacionEstado, NOTIFICATION_STATES),
      detail: `Domicilio legal: ${value(act.domicilioLegal, 'No consignado.')}\nConstancia: ${value(act.notificacionDetalle, 'Sin detalle de notificación consignado.')}\nPlazo registrado: ${typeof act.plazoDescargoDias === 'number' ? `${act.plazoDescargoDias} día${act.plazoDescargoDias === 1 ? '' : 's'} hábil${act.plazoDescargoDias === 1 ? '' : 'es'}` : 'No consignado.'}`,
      resolved: notificationResolved,
      adverse: act.notificacionEstado === 'NO_REALIZADA',
      unresolvedReason: !act.notificacionEstado
        ? 'Falta consignar el estado de notificación.'
        : act.notificacionEstado === 'PENDIENTE'
          ? 'La notificación permanece pendiente.'
          : [
              !hasText(act.domicilioLegal) ? 'domicilio legal' : '',
              !hasText(act.notificacionDetalle) ? 'constancia de notificación' : '',
              typeof act.plazoDescargoDias !== 'number' ? 'plazo' : '',
            ].filter(Boolean).length
            ? `Falta consignar: ${[
              !hasText(act.domicilioLegal) ? 'domicilio legal' : '',
              !hasText(act.notificacionDetalle) ? 'constancia de notificación' : '',
              typeof act.plazoDescargoDias !== 'number' ? 'plazo' : '',
            ].filter(Boolean).join(', ')}.`
            : undefined,
    },
  ];

  const unresolved = formalities.filter((entry) => !entry.resolved);
  const adverse = formalities.filter((entry) => entry.resolved && entry.adverse);
  const closed = Boolean(inspection.cerradaCampoAt)
    && !['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].includes(String(inspection.estado || ''));
  const complete = unresolved.length === 0;
  if (!closed && !complete) {
    return {
      status: 'BORRADOR_INCOMPLETA',
      statusLabel: 'BORRADOR / INCOMPLETA',
      statusExplanation: `Acta de campo sin cierre y con ${unresolved.length} formalidad${unresolved.length === 1 ? '' : 'es'} pendiente${unresolved.length === 1 ? '' : 's'}.`,
      closed,
      complete,
      formalities,
      unresolved,
      adverse,
      hasAdverseOutcomes: adverse.length > 0,
    };
  }
  if (!closed) {
    return {
      status: 'BORRADOR_PENDIENTE_CIERRE',
      statusLabel: 'BORRADOR / PENDIENTE DE CIERRE',
      statusExplanation: 'Las formalidades estructuradas están consignadas, pero el cierre de campo no fue registrado.',
      closed,
      complete,
      formalities,
      unresolved,
      adverse,
      hasAdverseOutcomes: adverse.length > 0,
    };
  }
  if (!complete) {
    return {
      status: 'CERRADA_INCOMPLETA',
      statusLabel: 'CERRADA / INCOMPLETA',
      statusExplanation: `El cierre de campo fue registrado, pero quedan ${unresolved.length} formalidad${unresolved.length === 1 ? '' : 'es'} pendiente${unresolved.length === 1 ? '' : 's'}.`,
      closed,
      complete,
      formalities,
      unresolved,
      adverse,
      hasAdverseOutcomes: adverse.length > 0,
    };
  }
  return {
    status: 'CERRADA_COMPLETA',
    statusLabel: adverse.length
      ? 'ACTA CERRADA / DATOS COMPLETOS - CONSTANCIAS ADVERSAS'
      : 'ACTA CERRADA / DATOS ESTRUCTURADOS COMPLETOS',
    statusExplanation: adverse.length
      ? `Los seis controles tienen datos suficientes; existen ${adverse.length} constancia${adverse.length === 1 ? '' : 's'} adversa${adverse.length === 1 ? '' : 's'}. Esto no expresa cumplimiento legal.`
      : 'Cierre de campo y seis controles estructurados consignados. Esto no expresa una valoración jurídica.',
    closed,
    complete,
    formalities,
    unresolved,
    adverse,
    hasAdverseOutcomes: adverse.length > 0,
  };
}

function dateParts(input: Date | string | null | undefined): { date: string; time: string } {
  if (!input) return { date: 'Sin informar', time: 'Sin informar' };
  const date = new Date(input);
  return {
    date: date.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Mendoza' }),
    time: date.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit' }),
  };
}

function institutionalHeader(
  doc: PDFKit.PDFDocument,
  actNumber: string,
  branding: InspectionPdfBranding,
  subtitle?: string,
) {
  drawInstitutionalMasthead(doc, branding, 34, 16, doc.page.width - 68);
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text('MINISTERIO DE ENERGÍA Y AMBIENTE · SUBSECRETARÍA DE AMBIENTE · DGFA', 34, 77, { width: doc.page.width - 68, lineBreak: false });
  drawInstitutionalRule(doc, 34, 89, doc.page.width - 68);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink)
    .text('ACTA DE INSPECCIÓN / CONSTATACIÓN', 34, 97, { width: 310 });
  doc.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.green)
    .text(`N.º ${actNumber}`, 337, 94, { width: 224, align: 'right' });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text(syntheticPreviewEnabled() ? 'PRÁCTICA - SIN VALIDEZ OFICIAL' : 'DOCUMENTO GENERADO POR SITREP', 34, 115, { width: 295, lineBreak: false });
  if (subtitle) doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text(subtitle, 337, 115, { width: 224, align: 'right', height: 13, ellipsis: true });
  doc.moveTo(34, 133).lineTo(doc.page.width - 34, 133).lineWidth(0.6).strokeColor(COLORS.line).stroke();
  doc.y = 143;
}

function band(doc: PDFKit.PDFDocument, title: string) {
  const y = doc.y;
  doc.rect(34, y, doc.page.width - 68, 18).fill(COLORS.green);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.white).text(title.toUpperCase(), 40, y + 5, { width: doc.page.width - 80, align: 'center' });
  doc.y = y + 18;
}

function statusBanner(doc: PDFKit.PDFDocument, presentation: InspectionFieldActPresentation) {
  const completeAndClosed = presentation.status === 'CERRADA_COMPLETA' && !presentation.hasAdverseOutcomes;
  const color = completeAndClosed ? COLORS.green : presentation.status === 'CERRADA_INCOMPLETA' ? COLORS.error : COLORS.warning;
  const background = completeAndClosed ? COLORS.successSoft : presentation.status === 'CERRADA_INCOMPLETA' ? COLORS.errorSoft : COLORS.warningSoft;
  const y = doc.y;
  doc.roundedRect(34, y, doc.page.width - 68, 42, 4).fill(background);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(color)
    .text(`ESTADO DOCUMENTAL: ${presentation.statusLabel}`, 44, y + 7, { width: doc.page.width - 88 });
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.ink)
    .text(presentation.statusExplanation, 44, y + 20, { width: doc.page.width - 88, height: 18, ellipsis: true });
  doc.y = y + 48;
}

function row(
  doc: PDFKit.PDFDocument,
  cells: Array<{ label: string; value: string; weight?: number }>,
  minimumHeight: number,
  newPage: () => void,
) {
  const totalWeight = cells.reduce((sum, cell) => sum + (cell.weight || 1), 0);
  const available = doc.page.width - 68;
  const widths = cells.map((cell) => available * (cell.weight || 1) / totalWeight);
  // Measure using the exact font used to draw each line. PDFKit's automatic
  // flow cannot paginate a table row: it leaves its border and other cells on
  // the old page while moving text onto an unheaded page.
  doc.font('Helvetica').fontSize(8.3);
  const lines = cells.map((cell, index) => wrappedLines(doc, cell.value, widths[index] - 12));
  const offsets = cells.map(() => 0);
  const lineHeight = doc.currentLineHeight(true) + 1;
  let continued = false;
  while (lines.some((cell, index) => offsets[index] < cell.length)) {
    const bottom = doc.page.height - 82;
    const availableHeight = bottom - doc.y;
    const capacity = Math.floor((availableHeight - 21) / lineHeight);
    const remaining = Math.max(...lines.map((cell, index) => cell.length - offsets[index]));
    if (availableHeight < minimumHeight || capacity < Math.min(2, remaining)) {
      newPage();
      continue;
    }
    const lineCount = Math.min(capacity, remaining);
    const height = Math.max(minimumHeight, 21 + lineCount * lineHeight);
    const y = doc.y;
    let x = 34;
    cells.forEach((cell, index) => {
      const width = widths[index];
      const fragment = lines[index].slice(offsets[index], offsets[index] + lineCount);
      doc.rect(x, y, width, height).fillAndStroke(COLORS.white, COLORS.line);
      doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.muted)
        .text(`${cell.label.toUpperCase()}${continued && fragment.length ? ' · CONT.' : ''}`, x + 6, y + 5,
          { width: width - 12, lineBreak: false });
      doc.font('Helvetica').fontSize(8.3).fillColor(COLORS.ink);
      if (fragment.length) {
        fragment.forEach((line, lineIndex) => {
          if (line) doc.text(line, x + 6, y + 15 + lineIndex * lineHeight, { width: width - 12, lineBreak: false });
        });
        offsets[index] += fragment.length;
      } else if (continued) {
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted)
          .text('Ver página anterior', x + 6, y + 15, { width: width - 12, lineBreak: false });
      }
      x += width;
    });
    doc.y = y + height;
    if (lines.some((cell, index) => offsets[index] < cell.length)) {
      newPage();
      continued = true;
    }
  }
}

function splitToken(doc: PDFKit.PDFDocument, token: string, width: number): string[] {
  if (doc.widthOfString(token) <= width) return [token];
  const chunks: string[] = [];
  let chunk = '';
  for (const character of token) {
    const candidate = `${chunk}${character}`;
    if (chunk && doc.widthOfString(candidate) > width) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk = candidate;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrappedLines(doc: PDFKit.PDFDocument, input: string, width: number): string[] {
  const lines: string[] = [];
  String(input).replace(/\r/g, '').split('\n').forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push('');
      return;
    }
    const tokens = paragraph.trim().split(/\s+/).flatMap((token) => splitToken(doc, token, width));
    let line = '';
    tokens.forEach((token) => {
      const candidate = line ? `${line} ${token}` : token;
      if (line && doc.widthOfString(candidate) > width) {
        lines.push(line);
        line = token;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function article44PageHeader(
  doc: PDFKit.PDFDocument,
  actNumber: string,
  inspectionNumber: string,
  presentation: InspectionFieldActPresentation,
  branding: InspectionPdfBranding,
  continuation = false,
) {
  institutionalHeader(
    doc,
    actNumber,
    branding,
    `DECRETO 2625/99, ART. 44${continuation ? ' - CONTINUACIÓN' : ''} - ${inspectionNumber}`,
  );
  statusBanner(doc, presentation);
  band(doc, continuation ? 'Formalidades del art. 44 - continuación' : 'Formalidades documentales del art. 44');
  doc.y += 7;
}

function formalityHeading(doc: PDFKit.PDFDocument, formality: Article44Formality, continuation = false) {
  const y = doc.y;
  const documentedWithoutAdverseOutcome = formality.resolved && !formality.adverse;
  const color = documentedWithoutAdverseOutcome ? COLORS.green : COLORS.warning;
  const background = documentedWithoutAdverseOutcome ? COLORS.successSoft : COLORS.warningSoft;
  doc.roundedRect(34, y, doc.page.width - 68, 37, 4).fill(background);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink)
    .text(`${formality.label}${continuation ? ' (continuación)' : ''}`, 44, y + 6, { width: 290, height: 12, ellipsis: true });
  doc.font('Helvetica').fontSize(6.8).fillColor(COLORS.muted)
    .text(`Estado registrado: ${formality.state}`, 44, y + 20, { width: 320, height: 11, ellipsis: true });
  doc.font('Helvetica-Bold').fontSize(7).fillColor(color)
    .text(
      formality.resolved
        ? formality.adverse ? 'DOCUMENTADA - CONSTANCIA ADVERSA' : 'DOCUMENTADA'
        : 'PENDIENTE / INCOMPLETA',
      352,
      y + 12,
      { width: 199, align: 'right' },
    );
  doc.y = y + 43;
}

function writeFormalityDetail(
  doc: PDFKit.PDFDocument,
  formality: Article44Formality,
  actNumber: string,
  inspectionNumber: string,
  presentation: InspectionFieldActPresentation,
  branding: InspectionPdfBranding,
  trailingSpace = 0,
) {
  doc.font('Helvetica-Bold').fontSize(6.4).fillColor(COLORS.muted);
  const detailLabel = formality.resolved ? 'CONSTANCIA REGISTRADA' : 'CONSTANCIA / PENDIENTE';
  const labelY = doc.y;
  doc.text(detailLabel, 40, labelY, { width: doc.page.width - 80, lineBreak: false });
  doc.y = labelY + 11;
  doc.font('Helvetica').fontSize(8.2).fillColor(COLORS.ink);
  const detail = formality.unresolvedReason
    ? `${formality.detail}\nControl de completitud: ${formality.unresolvedReason}`
    : formality.detail;
  const lines = wrappedLines(doc, detail, doc.page.width - 80);
  for (const [index, line] of lines.entries()) {
    const reserve = index === lines.length - 1 ? trailingSpace : 0;
    if (doc.y + 12 + reserve > doc.page.height - 82) {
      doc.addPage();
      article44PageHeader(doc, actNumber, inspectionNumber, presentation, branding, true);
      formalityHeading(doc, formality, true);
      doc.font('Helvetica').fontSize(8.2).fillColor(COLORS.ink);
    }
    const lineY = doc.y;
    if (line) doc.text(line, 40, lineY, { width: doc.page.width - 80, lineBreak: false });
    doc.y = lineY + 11;
  }
  doc.y += 9;
}

function article44Section(
  doc: PDFKit.PDFDocument,
  inspection: any,
  actNumber: string,
  presentation: InspectionFieldActPresentation,
  branding: InspectionPdfBranding,
  startNewPage = true,
) {
  if (startNewPage) {
    doc.addPage();
    article44PageHeader(doc, actNumber, inspection.numero, presentation, branding);
  } else {
    band(doc, 'Formalidades documentales del art. 44 · continuación del cierre');
    doc.y += 7;
  }
  const note = 'Esta sección reproduce únicamente datos consignados en el acta de campo. "No consignado" o "pendiente" no presume hechos, firmas, entrega de copias ni notificaciones. El control indicado es de completitud documental y no sustituye una valoración jurídica.';
  doc.font('Helvetica').fontSize(7.2);
  const noteHeight = Math.max(37, doc.heightOfString(note, { width: doc.page.width - 100 }) + 17);
  const noteY = doc.y;
  doc.roundedRect(40, noteY, doc.page.width - 80, noteHeight, 4).fill(COLORS.soft);
  doc.font('Helvetica').fontSize(7.2).fillColor(COLORS.ink)
    .text(note, 50, noteY + 8, { width: doc.page.width - 100, lineGap: 1 });
  doc.y = noteY + noteHeight + 10;

  const summary = presentation.unresolved.length
    ? `Pendientes documentales: ${presentation.unresolved.map((entry) => entry.label).join('; ')}.`
    : presentation.hasAdverseOutcomes
      ? `Los seis controles tienen datos suficientes. Constancias adversas: ${presentation.adverse.map((entry) => entry.label).join('; ')}. Esto no implica cumplimiento de la formalidad material.`
      : 'No se detectaron pendientes en los seis controles estructurados incluidos en esta sección.';
  doc.font('Helvetica-Bold').fontSize(7.2);
  const summaryHeight = Math.max(38, doc.heightOfString(summary, { width: doc.page.width - 100 }) + 20);
  presentation.formalities.forEach((formality, index) => {
    doc.font('Helvetica').fontSize(8.2);
    const detail = formality.unresolvedReason
      ? `${formality.detail}\nControl de completitud: ${formality.unresolvedReason}`
      : formality.detail;
    const blockHeight = 43 + 11 + wrappedLines(doc, detail, doc.page.width - 80).length * 11 + 9;
    const reserve = index === presentation.formalities.length - 1 ? summaryHeight + 18 : 0;
    // Keep a compact formality together. Longer statements still paginate,
    // repeating their heading. Keep the final summary with the last formality.
    if (doc.y + Math.min(blockHeight + reserve, doc.page.height - 82 - 216) > doc.page.height - 82) {
      doc.addPage();
      article44PageHeader(doc, actNumber, inspection.numero, presentation, branding, true);
    }
    formalityHeading(doc, formality);
    writeFormalityDetail(doc, formality, actNumber, inspection.numero, presentation, branding, reserve);
  });

  if (doc.y + summaryHeight > doc.page.height - 82) {
    doc.addPage();
    article44PageHeader(doc, actNumber, inspection.numero, presentation, branding, true);
  }
  const summaryY = doc.y;
  doc.roundedRect(40, summaryY, doc.page.width - 80, summaryHeight, 4)
    .fill(presentation.unresolved.length || presentation.hasAdverseOutcomes ? COLORS.warningSoft : COLORS.successSoft);
  doc.font('Helvetica-Bold').fontSize(7.2)
    .fillColor(presentation.unresolved.length || presentation.hasAdverseOutcomes ? COLORS.warning : COLORS.green)
    .text(summary, 50, summaryY + 9, { width: doc.page.width - 100, lineGap: 1 });
  doc.y = summaryY + summaryHeight + 8;
}

function signatureBlock(
  doc: PDFKit.PDFDocument,
  inspection: any,
  act: ActData,
  branding: InspectionPdfBranding,
  actNumber: string,
): boolean {
  const actor = actorOf(inspection);
  const y = doc.y + 18;
  const width = (doc.page.width - 92) / 2;
  let movedToNewPage = false;
  if (y + 92 > doc.page.height - 56) {
    movedToNewPage = true;
    doc.addPage();
    institutionalHeader(doc, actNumber, branding, `FIRMAS Y CONSTANCIAS · ${inspection.numero}`);
    // Never leave a detached signature sheet: explain what is being signed
    // before the signature fields when the block must move to a new page.
    band(doc, 'Cierre documental y firmas');
    doc.y += 9;
    const noteY = doc.y;
    doc.roundedRect(40, noteY, doc.page.width - 80, 42, 4).fill(COLORS.soft);
    doc.font('Helvetica').fontSize(7.2).fillColor(COLORS.ink)
      .text('Las constancias siguientes identifican a las personas intervinientes y el estado documental informado en el acta. Sólo las firmas identificadas como capturadas incluyen trazo manuscrito. No equivalen a conformidad con los hallazgos ni a firma digital certificada.', 50, noteY + 9, { width: doc.page.width - 100, lineGap: 1.2 });
    doc.y = noteY + 51;
  }
  const actualY = doc.y + 18;
  const captured: any[] = inspection.firmasCapturadas || [];
  const responsible = value(act.atendidoPor || act.titular || actor.representanteLegalNombre, 'Causante / responsable');
  const inspector = value(`${inspection.inspector?.nombre || ''} ${inspection.inspector?.apellido || ''}`);
  const blocks = [
    {
      name: captured.find(f => f.tipo === 'INSPECCIONADO')?.nombre || responsible,
      dni: act.dniAtendido || act.dniTitular || actor.representanteLegalDNI,
      role: 'CAUSANTE / RESPONSABLE',
      status: `ESTADO REGISTRADO: ${stateLabel(act.firmaIntervinienteEstado, SIGNATURE_STATES).toUpperCase()}`,
    },
    {
      name: captured.find(f => f.tipo === 'INSPECTOR')?.nombre || inspector,
      dni: '',
      role: 'INSPECTOR/A INTERVINIENTE',
      status: 'ESPACIO DE FIRMA - SIN FIRMA GRÁFICA INCORPORADA',
    },
  ];
  blocks.forEach(({ name, dni, role, status }, index) => {
    const x = 40 + index * (width + 12);
    const signature = captured.find(f => f.tipo === (index === 0 ? 'INSPECCIONADO' : 'INSPECTOR'));
    if (signature?.imagen?.startsWith('data:image/png;base64,')) {
      doc.image(Buffer.from(signature.imagen.split(',')[1], 'base64'), x + 10, actualY - 2, { fit: [width - 20, 34], align: 'center' });
      status = 'FIRMA MANUSCRITA EN PANTALLA · ' + new Date(signature.registradaAt).toLocaleDateString('es-AR');
    }
    doc.moveTo(x, actualY + 34).lineTo(x + width, actualY + 34).lineWidth(0.7).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.ink).text(name, x, actualY + 40, { width, align: 'center' });
    if (dni) doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(`DNI ${dni}`, x, actualY + 52, { width, align: 'center' });
    doc.font('Helvetica-Bold').fontSize(6.5).fillColor(COLORS.green).text(role, x, actualY + 63, { width, align: 'center' });
    doc.font('Helvetica').fontSize(5.6).fillColor(COLORS.muted).text(status, x, actualY + 75, { width, align: 'center', height: 16, ellipsis: true });
  });
  doc.y = actualY + 96;
  return movedToNewPage;
}

function observationsHeader(
  doc: PDFKit.PDFDocument,
  actNumber: string,
  branding: InspectionPdfBranding,
  continuation?: string,
) {
  institutionalHeader(doc, actNumber, branding, continuation);
  band(doc, 'Observaciones generales');
  doc.y += 9;
}

function writePaginatedText(
  doc: PDFKit.PDFDocument,
  text: string,
  actNumber: string,
  branding: InspectionPdfBranding,
  continuation?: string,
) {
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
        observationsHeader(doc, actNumber, branding, continuation);
        doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
      }
      const lineY = doc.y;
      doc.text(line, 40, lineY, { width: maxWidth, lineBreak: false });
      doc.y = lineY + lineHeight;
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
    if (item) return `${item.codigo} · ${item.etiqueta}${item.observacion ? ` - ${item.observacion}` : ''}`;
  }
  if (evidence.comparacionId) {
    const comparison = inspection.comparaciones.find((row: any) => row.id === evidence.comparacionId);
    if (comparison) return `${comparison.etiqueta}: ${comparison.valorObservado || comparison.resultado}`;
  }
  return 'Evidencia general del expediente';
}

function photoAnnex(
  doc: PDFKit.PDFDocument,
  inspection: any,
  preparedImages: Map<string, PreparedInspectionImage>,
  actNumber: string,
  branding: InspectionPdfBranding,
) {
  const photos = inspection.evidencias.filter((evidence: any) => evidence.tipo === 'FOTO' && !evidence.anuladaAt && !evidence.intercambioId);
  const newPhotoPage = () => {
    doc.addPage();
    institutionalHeader(doc, actNumber, branding, `ANEXO FOTOGRÁFICO · ${inspection.numero}`);
    doc.y += 7;
  };
  photos.forEach((photo: any, index: number) => {
    const caption: InspectionPdfTextBlock[] = [
      { text: `Fotografía · ${inspectionEvidenceReference(photo)}`, font: 'Helvetica-Bold', size: 8.2, color: COLORS.ink },
      { text: evidenceTarget(inspection, photo), size: 7.4, color: COLORS.muted },
      { text: photo.descripcion || 'Sin descripción adicional.', size: 8, color: COLORS.ink },
      { text: `Captura: ${dateParts(photo.capturadaAt).date} ${dateParts(photo.capturadaAt).time}`, size: 6.5, color: COLORS.muted },
      { text: `SHA-256 ${value(photo.sha256)}`, font: 'Courier', size: 6.2, color: COLORS.muted },
    ];
    const captionHeight = measureInspectionPdfBlocks(doc, caption, doc.page.width - 76);
    const minimumCaption = Math.min(captionHeight, 90);
    newPhotoPage(); // One full, proportional photograph per page; caption stays attached.
    const y = doc.y;
    // Caption height, not a fixed photograph count, determines page breaks.
    const imageHeight = Math.max(205, doc.page.height - doc.y - 92 - Math.min(captionHeight, 160));
    doc.roundedRect(34, y, doc.page.width - 68, imageHeight, 4).fill(COLORS.soft);
    const prepared = preparedImages.get(photo.id);
    if (prepared?.buffer) doc.image(prepared.buffer, 38, y + 4, { fit: [doc.page.width - 76, imageHeight - 8], align: 'center', valign: 'center' });
    else doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
      prepared?.status === 'MISSING'
        ? 'El archivo no estaba disponible al emitir esta copia; su registro y huella permanecen en el expediente.'
        : 'No fue posible representar la imagen; el archivo original y su huella permanecen en el expediente.',
      48,
      y + 112,
      { width: doc.page.width - 96, align: 'center' },
    );
    doc.y = y + imageHeight + 7;
    drawInspectionPdfBlocks(doc, caption, {
      x: 38, width: doc.page.width - 76, bottom: doc.page.height - 82,
      newPage: newPhotoPage,
      continuation: `Fotografía · ${inspectionEvidenceReference(photo)} - continuación`,
    });
    doc.y += 12;
  });
}

export async function streamInspectionActPdf(
  res: Response,
  inspection: any,
  resolveEvidence: (key: string) => string,
): Promise<void> {
  if (inspection.datosActa?.modeloCampo === 2) return streamTypicalInspectionAct(res, inspection, resolveEvidence);
  const actor = actorOf(inspection);
  const originalInspection = inspection;
  const storedAct = actDataOf(inspection);
  const extra = inspection.datosActa || {};
  const act = { ...storedAct, requerimientos: [storedAct.requerimientos, extra.medidas?.length ? inspectionMeasureText(extra.medidas) : ''].filter(Boolean).join('\n\n') };
  const additional = [
    extra.actividadObservada && `Actividad observada: ${extra.actividadObservada}`,
    extra.ampliacionEstado && `Instalaciones respecto de lo declarado: ${({ COINCIDE: 'Coincide', DIFIERE: 'Difiere', NO_VERIFICADO: 'No verificado / sin antecedente suficiente', NO_APLICA: 'No aplica' } as Record<string, string>)[extra.ampliacionEstado] || extra.ampliacionEstado}`,
    extra.ampliacionDetalle && `Diferencias o ampliaciones: ${extra.ampliacionDetalle}`,
    extra.entornoObservado && `Entorno: ${extra.entornoObservado}`,
    extra.receptores?.length && `Receptores considerados: ${extra.receptores.join(', ')}`,
    extra.restriccionReferencia && `Referencia de restricción o antecedente: ${extra.restriccionReferencia}`,
    extra.ubicacionCampo && `Ubicación confirmada: ${inspectionPointText(extra.ubicacionCampo)}`,
  ].filter(Boolean).join('\n');
  inspection = { ...inspection, datosActa: act, observaciones: [inspection.observaciones, additional].filter(Boolean).join('\n\n') };
  const actNumber = value(inspection.numeroActa, inspection.numero);
  const started = dateParts(inspection.iniciadaAt || inspection.fechaProgramada || inspection.createdAt);
  const presentation = buildInspectionFieldActPresentation(inspection);
  const fingerprint = buildInspectionFieldActFingerprint(originalInspection);
  // The public QR verifies the complete current dossier, while the field-act
  // footer intentionally preserves the frozen field-act fingerprint.
  const traceFingerprint = buildInspectionDocumentFingerprint(originalInspection);
  const traceQr = inspection.firmasCapturadas?.length ? null : await buildInspectionPdfQr({ id: inspection.id, numero: inspection.numero, version: inspection.version, fingerprint: traceFingerprint });
  const branding = await loadInspectionPdfBranding();
  const fieldEvidence = (inspection.evidencias || []).filter((evidence: any) => !evidence.intercambioId);
  const preparedImages = await prepareInspectionPdfImages(fieldEvidence, resolveEvidence);
  const doc = new PDFDocument({
    size: 'A4',
    margin: 34,
    bufferPages: true,
    info: {
      Title: `Acta de inspección ${actNumber}`,
      Author: 'SITREP Mendoza',
      Subject: `Estado documental: ${presentation.statusLabel}. Decreto 2625/99, art. 44.`,
      Keywords: 'SITREP, acta de campo, Decreto 2625/99, artículo 44, trazabilidad',
    },
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=acta_inspeccion_${actNumber.replace(/[^a-zA-Z0-9_-]+/g, '_')}.pdf`);
  doc.pipe(res);

  institutionalHeader(doc, actNumber, branding, `Expediente digital ${inspection.numero}`);
  statusBanner(doc, presentation);
  if (traceQr) doc.y = drawInspectionPdfQrCard(doc, traceQr, traceFingerprint, { y: doc.y, title: 'VERIFICAR TRAZABILIDAD DEL ACTA' }) + 8;
  const newCoverPage = () => {
    doc.addPage();
    institutionalHeader(doc, actNumber, branding, `CONTINUACIÓN · ${inspection.numero}`);
    band(doc, 'Datos del acta · continuación');
  };
  const coverBand = (title: string) => {
    if (doc.y + 18 + 44 > doc.page.height - 82) newCoverPage();
    band(doc, title);
  };
  const coverRow = (cells: Array<{ label: string; value: string; weight?: number }>, minimumHeight = 30) =>
    row(doc, cells, minimumHeight, newCoverPage);
  coverRow([
    { label: 'Fecha', value: started.date },
    { label: 'Hora', value: started.time },
    { label: 'Código postal', value: value(act.codigoPostal) },
  ]);
  coverBand('Domicilio inspeccionado');
  coverRow([
    { label: 'Departamento', value: value(act.departamento) },
    { label: 'Calle / domicilio', value: value(act.calle || inspection.ubicacion || actor.domicilio), weight: 2 },
    { label: 'N.º', value: value(act.numeroDomicilio) },
  ]);
  coverBand('Empresa / entidad inspeccionada');
  coverRow([
    { label: 'Razón social', value: value(actor.razonSocial), weight: 2 },
    { label: 'CUIT', value: value(actor.cuit) },
    { label: 'Teléfono', value: value(actor.telefono) },
  ]);
  coverRow([
    { label: 'Titular / propiedad de', value: value(act.titular || actor.representanteLegalNombre || actor.razonSocial), weight: 2 },
    { label: 'DNI', value: value(act.dniTitular || actor.representanteLegalDNI) },
    { label: 'Correo', value: value(actor.email) },
  ]);
  coverRow([
    { label: 'Atendido por', value: value(act.atendidoPor), weight: 2 },
    { label: 'DNI', value: value(act.dniAtendido) },
    { label: 'Cargo', value: value(act.cargoAtendido) },
  ]);
  coverBand('Inspectores intervinientes');
  coverRow([
    { label: 'Inspector/a asignado/a', value: value(`${inspection.inspector?.nombre || ''} ${inspection.inspector?.apellido || ''}`) },
    { label: 'Área', value: value(act.area) },
  ]);
  coverBand('Alcance de la constatación');
  coverRow([
    { label: 'Lugar de afectación', value: value(act.lugarAfectacion), weight: 2 },
    { label: 'Motivo de inspección', value: value(act.motivoInspeccion), weight: 2 },
    { label: 'Infraestructura', value: act.infraestructura === 'SI' ? 'Sí' : act.infraestructura === 'NO' ? 'No' : 'No verificada' },
  ], 34);
  coverRow([
    { label: 'Detalle de infraestructura', value: value(act.detalleInfraestructura), weight: 2 },
    { label: 'Estado', value: value(act.estadoInfraestructura) },
  ], 35);
  coverRow([
    { label: 'Generación / corrientes observadas', value: value(act.generacion), weight: 2 },
    { label: 'Acta antecedente', value: value(act.actaAnterior) },
  ], 34);
  const failedItems = inspection.items.filter((item: any) => item.resultado === 'NO_CUMPLE');
  const requirementsFallback = failedItems.length ? `Ver observaciones. Controles no conformes registrados: ${failedItems.map((item: any) => item.codigo).join(', ')}.` : 'Sin requerimientos expresos consignados.';
  coverRow([{ label: 'Requerimientos consignados', value: value(act.requerimientos, requirementsFallback) }], 42);
  const notice = typeof act.plazoDescargoDias === 'number'
    ? `En este acto se deja constancia del plazo de ${act.plazoDescargoDias} día${act.plazoDescargoDias === 1 ? '' : 's'} hábil${act.plazoDescargoDias === 1 ? '' : 'es'} registrado para formular descargo y ofrecer la prueba pertinente.`
    : 'Plazo de presentación o descargo no consignado en el expediente. Debe completarse antes de su notificación formal.';
  doc.font('Helvetica-Bold').fontSize(7.4);
  const noticeHeight = Math.max(37, doc.heightOfString(notice, { width: doc.page.width - 88 }) + 18);
  // Keep the deadline context and the following signatures on one headed page.
  if (doc.y + noticeHeight + 140 > doc.page.height - 82) newCoverPage();
  const noticeY = doc.y + 6;
  doc.roundedRect(34, noticeY, doc.page.width - 68, noticeHeight, 4).fill(COLORS.soft);
  doc.font('Helvetica-Bold').fontSize(7.4).fillColor(COLORS.ink).text(notice, 44, noticeY + 9, { width: doc.page.width - 88, align: 'center' });
  doc.y = noticeY + noticeHeight + 5;
  const signatureMovedToNewPage = signatureBlock(doc, inspection, act, branding, actNumber);

  // Keep the documentary section on the signature page when the cover page
  // could not fit the signatures, avoiding a detached signature-only sheet.
  article44Section(doc, inspection, actNumber, presentation, branding, !signatureMovedToNewPage);

  doc.addPage();
  observationsHeader(doc, actNumber, branding, act.actaAnterior ? `CONTINÚA / RELACIONADA CON ${act.actaAnterior}` : `Expediente digital ${inspection.numero}`);
  writePaginatedText(doc, inspection.observaciones || '', actNumber, branding, `Expediente digital ${inspection.numero}`);
  doc.y += 6;
  const factualFindings = inspection.items.filter((item: any) => item.resultado === 'NO_CUMPLE');
  if (factualFindings.length) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.green).text('CONTROLES NO CONFORMES REGISTRADOS', 40, doc.y, { width: doc.page.width - 80 });
    doc.y += 15;
    factualFindings.forEach((item: any) => {
      writePaginatedText(doc, `- ${item.codigo} - ${item.etiqueta}${item.observacion ? `: ${item.observacion}` : ''}`, actNumber, branding, `Expediente digital ${inspection.numero}`);
    });
  }
  const defenseNotice = typeof act.plazoDescargoDias === 'number'
    ? `Se registra un plazo de ${act.plazoDescargoDias} día${act.plazoDescargoDias === 1 ? '' : 's'} hábil${act.plazoDescargoDias === 1 ? '' : 'es'} para formular descargo y ofrecer la prueba pertinente. La comunicación y el cómputo efectivo deben constar en la trazabilidad del expediente.`
    : 'El plazo de descargo y su comunicación no fueron consignados. El documento no presume una notificación ni el inicio de un cómputo.';
  if (doc.y + 95 > doc.page.height - 60) {
    doc.addPage();
    observationsHeader(doc, actNumber, branding, `Expediente digital ${inspection.numero}`);
  }
  doc.roundedRect(40, doc.y + 6, doc.page.width - 80, 43, 4).fill(COLORS.soft);
  doc.font('Helvetica-Bold').fontSize(7.2).fillColor(COLORS.ink).text(defenseNotice, 50, doc.y + 16, { width: doc.page.width - 100, align: 'center' });
  doc.y += 55;
  signatureBlock(doc, inspection, act, branding, actNumber);

  if (inspection.firmasCapturadas?.length) {
    doc.addPage(); institutionalHeader(doc, actNumber, branding, 'CONSTANCIA DE FIRMA EN PANTALLA');
    writePaginatedText(doc, inspection.firmasCapturadas.map((f: any) => `${f.nombre} · ${f.caracter} · Documento ${f.documento}\n${f.alcance}\nContenido revisado SHA-256: ${f.contenidoSha256}\nCaptura: ${new Date(f.registradaAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}`).join('\n\n'), actNumber, branding);
    signatureBlock(doc, inspection, act, branding, actNumber);
  }
  const locationMap = (originalInspection.datosActa as any)?.ubicacionCampo;
  if (locationMap) {
    doc.addPage(); institutionalHeader(doc, actNumber, branding, 'Lugar y entorno de la visita');
    band(doc, 'Ubicación registrada');
    doc.moveDown(); doc.font('Helvetica').fontSize(10).fillColor(COLORS.ink).text(`Coordenadas: ${inspectionPointText(locationMap)}`, 40, doc.y, { width: 510 });
    doc.moveDown();
    if (locationMap.mapaImagen) {
      const y = doc.y; doc.image(Buffer.from(locationMap.mapaImagen.split(',')[1], 'base64'), 40, y, { fit: [515, 350], align: 'center' }); doc.y = y + 365;
      doc.fontSize(8).text('© OpenStreetMap contributors · Referencia del entorno; no representa el límite del predio ni determina restricciones ambientales.', 40, doc.y, { width: 510 });
    } else doc.text('Sin imagen de mapa guardada. Las coordenadas identifican el punto registrado.', 40, doc.y, { width: 510 });
    // Numbering matches the saved image; distances are recomputed from stored coordinates.
    doc.moveDown(); writePaginatedText(doc, [...inspectionMapSummary(locationMap), extra.entornoObservado, extra.restriccionReferencia ? 'Referencia verificada: ' + extra.restriccionReferencia : ''].filter(Boolean).join('\n'), actNumber, branding);
  }
  photoAnnex(doc, inspection, preparedImages, actNumber, branding);

  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    doc.switchToPage(index);
    // Mantener el pie dentro del área imprimible. PDFKit crea una página nueva
    // si el texto cruza el margen inferior, incluso al editar páginas bufferizadas.
    const flowBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 55;
    doc.moveTo(34, footerY - 5).lineTo(doc.page.width - 34, footerY - 5).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(5.7).fillColor(COLORS.muted)
      .text(`Huella estable del acta de campo (SHA-256): ${fingerprint}`, 34, footerY, { width: 527, lineBreak: false });
    doc.fontSize(6.1)
      .text(`Gobierno de Mendoza · SITREP · ${inspection.numero} · ${presentation.statusLabel}`, 34, footerY + 9, { width: 410, lineBreak: false })
      .text(`Página ${index + 1} de ${pages.count}`, 466, footerY + 9, { width: 95, align: 'right', lineBreak: false });
    drawSyntheticPreviewFooter(doc, footerY);
    doc.page.margins.bottom = flowBottomMargin;
  }
  doc.end();
}

/** Compact field model: only recorded observations, one location sheet and one page per photo. */
async function streamTypicalInspectionAct(res: Response, inspection: any, resolveEvidence: (key: string) => string) {
  const act = inspection.datosActa || {}, actor = actorOf(inspection), number = value(inspection.numeroActa, inspection.numero);
  const branding = await loadInspectionPdfBranding(), images = await prepareInspectionPdfImages(inspection.evidencias || [], resolveEvidence);
  const fingerprint = buildInspectionFieldActFingerprint(inspection);
  const doc = new PDFDocument({size:'A4',margins:{top:145,bottom:82,left:40,right:40},bufferPages:true,info:{Title:`Acta de inspección ${number}`,Author:'SITREP Mendoza'}});
  res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition',`attachment; filename=acta_${number.replace(/[^a-zA-Z0-9_-]+/g,'_')}.pdf`);doc.pipe(res);
  const newPage = () => { doc.addPage(); institutionalHeader(doc,number,branding,inspection.numero); };
  institutionalHeader(doc,number,branding,inspection.numero);
  const write = (label: string, body: unknown) => {
    if (!String(body ?? '').trim()) return;
    drawInspectionPdfBlocks(doc,[{text:label,font:'Helvetica-Bold',size:10,color:COLORS.green,gap:4},{text:String(body),size:10,color:COLORS.ink,gap:12}],{x:40,width:515,bottom:doc.page.height-85,newPage,continuation:label+' - continuación'});
  };
  write(inspection.firmasCapturadas?.length ? 'Copia firmada de la versión revisada' : 'Acta en preparación', inspection.firmasCapturadas?.length ? 'La firma deja constancia de lectura y recepción. No implica conformidad con los hallazgos ni cierre del expediente.' : 'Sin firma capturada para esta copia. La descarga no cierra ni notifica el expediente.');
  write('Visita', [dateParts(inspection.iniciadaAt || inspection.createdAt).date,inspection.ubicacion].filter(Boolean).join(' · '));
  write('Establecimiento', [actor.razonSocial,actor.cuit].filter(Boolean).join(' · ') || 'Lugar sin actor registrado vinculado');
  write('Inspector interviniente', [inspection.inspector?.nombre,inspection.inspector?.apellido].filter(Boolean).join(' '));
  write('Persona que atiende', [act.atendidoPor,act.dniAtendido,act.cargoAtendido].filter(Boolean).join(' · '));
  write('Motivo', [act.motivoTipo,act.motivoInspeccion].filter(Boolean).join(' · '));
  write('Constatación', inspection.observaciones);
  write('Actividad observada',act.actividadObservada);
  write('Instalaciones y ampliaciones', [act.ampliacionEstado,act.ampliacionDetalle].filter(Boolean).join(' · '));
  for(const r of inspection.items || []) if(r.resultado!=='PENDIENTE'||r.observacion)write(r.etiqueta,[r.resultado,r.observacion].filter(Boolean).join(' · '));
  for(const r of inspection.comparaciones || []) write(r.etiqueta,`Declarado: ${r.valorDeclarado || 'Sin dato'}\nObservado: ${r.valorObservado || 'Sin dato'}\nResultado: ${r.resultado}${r.observacion?' · '+r.observacion:''}`);
  write('Requerimientos y responsables',[act.requerimientos,inspectionMeasureText(act.medidas || [])].filter(Boolean).join('\n'));
  write('Contacto declarado para copia',act.contactoActa);
  const optional: Record<string,string> = {codigoPostal:'Código postal',departamento:'Departamento',calle:'Calle',numeroDomicilio:'Número de domicilio',titular:'Titular',dniTitular:'Documento del titular',area:'Área interviniente',lugarAfectacion:'Lugar de afectación',infraestructura:'Infraestructura',detalleInfraestructura:'Detalle de infraestructura',estadoInfraestructura:'Estado de infraestructura',generacion:'Generación observada',actaAnterior:'Acta anterior',plazoDescargoDias:'Días de descargo registrados',danosEstado:'Daños: estado',danosDetalle:'Daños: detalle',tercerosTestigosEstado:'Terceros y testigos',tercerosTestigosDetalle:'Detalle de terceros y testigos',libroOperacionesEstado:'Libro de operaciones',libroOperacionesDetalle:'Detalle del libro de operaciones',firmaIntervinienteEstado:'Firma: constancia',firmaIntervinienteDetalle:'Firma: detalle',copiaActaEstado:'Entrega de copia',copiaActaDetalle:'Entrega: detalle',domicilioLegal:'Domicilio legal',notificacionEstado:'Notificación',notificacionDetalle:'Notificación: detalle'};
  for(const [key,label] of Object.entries(optional)) write(label,act[key]);
  if(act.solicitaCopia===true) write('Copia solicitada','La persona solicitó una copia del acta.');
  if(doc.y>doc.page.height-200)newPage();
  signatureBlock(doc,inspection,act,branding,number);
  for(const f of inspection.firmasCapturadas || []) write('Constancia de firma',`${f.nombre} · ${f.documento} · ${f.caracter}\n${f.alcance}\nVersión revisada: ${f.contenidoSha256}`);
  const location = act.ubicacionCampo;
  if(location || act.entornoObservado || act.restriccionReferencia){
    newPage();write('Lugar y entorno',location ? inspectionPointText(location) : inspection.ubicacion);
    if(location?.mapaImagen){const y=doc.y;doc.image(Buffer.from(location.mapaImagen.split(',')[1],'base64'),40,y,{fit:[515,300],align:'center'});doc.y=y+312;}
    if(location)write('Sector y referencias del entorno',inspectionMapSummary(location).join('\n'));
    write('Referencia cartográfica',location?.mapaImagen?'© OpenStreetMap contributors. La vista guardada no delimita el predio ni determina por sí sola restricciones ambientales.':'No se guardó una imagen de mapa. Las coordenadas identifican el punto registrado.');
    write('Entorno observado',act.entornoObservado);write('Receptores considerados',(act.receptores || []).join(', '));write('Restricción o antecedente identificado',act.restriccionReferencia);
  }
  photoAnnex(doc,inspection,images,number,branding);
  const pages=doc.bufferedPageRange();for(let index=pages.start;index<pages.start+pages.count;index++){
    doc.switchToPage(index);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;const y=doc.page.height-55;
    doc.moveTo(34,y-5).lineTo(561,y-5).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(6).fillColor(COLORS.muted).text(`SITREP · ${inspection.numero} · Huella ${fingerprint.slice(0,20)}`,34,y,{width:420,lineBreak:false}).text(`${index+1} / ${pages.count}`,466,y,{width:95,align:'right',lineBreak:false});drawSyntheticPreviewFooter(doc,y);doc.page.margins.bottom=bottom;
  }doc.end();
}
