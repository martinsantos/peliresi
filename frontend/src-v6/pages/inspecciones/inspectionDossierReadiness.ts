import type {
  Inspection,
  InspectionActData,
  InspectionComparison,
  InspectionItem,
  InspectionTechnicalReport,
} from '../../types/inspection';

export interface InspectionDossierReadiness {
  ready: boolean;
  completed: number;
  total: number;
  missing: string[];
}

interface InspectionDossierDraft {
  numeroActa: string;
  plazoRespuestaAt: string;
  observaciones: string;
  datosActa: InspectionActData;
  informeTecnico: InspectionTechnicalReport;
  items: InspectionItem[];
  comparaciones: InspectionComparison[];
}

const hasText = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;

function hasCompletedArticle44Formalities(act: InspectionActData) {
  return {
    damages: act.danosEstado === 'NO_OBSERVADOS'
      || (act.danosEstado === 'OBSERVADOS' && hasText(act.danosDetalle)),
    witnesses: act.tercerosTestigosEstado === 'NO_IDENTIFICADOS'
      || (act.tercerosTestigosEstado === 'IDENTIFICADOS' && hasText(act.tercerosTestigosDetalle)),
    operationsBook: Boolean(
      act.libroOperacionesEstado
      && act.libroOperacionesEstado !== 'NO_VERIFICADO'
      && hasText(act.libroOperacionesDetalle),
    ),
    signature: act.firmaIntervinienteEstado === 'FIRMADA'
      || (Boolean(act.firmaIntervinienteEstado)
        && act.firmaIntervinienteEstado !== 'PENDIENTE'
        && hasText(act.firmaIntervinienteDetalle)),
    copyDelivery: Boolean(
      act.copiaActaEstado
      && act.copiaActaEstado !== 'PENDIENTE'
      && hasText(act.copiaActaDetalle),
    ),
    notification: Boolean(
      act.notificacionEstado
      && act.notificacionEstado !== 'PENDIENTE'
      && hasText(act.domicilioLegal)
      && hasText(act.notificacionDetalle),
    ),
  };
}

/**
 * Mirrors the documentary controls expected before an administrative review.
 * This is intentionally a UI guardrail, not a legal opinion or a replacement
 * for the server-side state machine.
 */
export function getInspectionDossierReadiness(
  inspection: Pick<Inspection, 'cerradaCampoAt'>,
  draft: InspectionDossierDraft,
): InspectionDossierReadiness {
  const act = draft.datosActa;
  const report = draft.informeTecnico;
  const formalities = hasCompletedArticle44Formalities(act);
  const checks: Array<[boolean, string]> = [
    [hasText(draft.numeroActa), 'Número de acta'],
    [hasText(draft.plazoRespuestaAt), 'Plazo de respuesta'],
    [Boolean(inspection.cerradaCampoAt), 'Cierre de campo confirmado'],
    [hasText(draft.observaciones), 'Observaciones generales'],
    [hasText(act.area), 'Área interviniente'],
    [hasText(act.motivoInspeccion), 'Motivo de inspección'],
    [hasText(act.lugarAfectacion), 'Lugar de afectación'],
    [formalities.damages, 'Daños a personas o bienes'],
    [formalities.witnesses, 'Terceros y testigos'],
    [formalities.operationsBook, 'Libro de Registro de Operaciones'],
    [formalities.signature, 'Firma o constancia de negativa/imposibilidad'],
    [formalities.copyDelivery, 'Entrega de copia del acta'],
    [formalities.notification, 'Notificación y domicilio legal'],
    [hasText(report.expedienteElectronico), 'Expediente electrónico'],
    [hasText(report.objetivo), 'Objetivo técnico'],
    [hasText(report.antecedentes), 'Antecedentes'],
    [hasText(report.evaluacion), 'Evaluación técnica'],
    [hasText(report.conclusion), 'Conclusión técnica'],
    [hasText(report.recomendacion), 'Recomendación técnica'],
    [draft.items.filter((item) => item.obligatorio).every((item) => item.resultado !== 'PENDIENTE'), 'Checklist obligatorio completo'],
    [draft.comparaciones.every((row) => row.resultado !== 'PENDIENTE'), 'Comparativa declarado/verificado completa'],
  ];
  const missing = checks.filter(([passed]) => !passed).map(([, label]) => label);
  return {
    ready: missing.length === 0,
    completed: checks.length - missing.length,
    total: checks.length,
    missing,
  };
}
