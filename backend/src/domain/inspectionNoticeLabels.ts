import type { TipoIntercambioInspeccion } from '@prisma/client';

export const INSPECTION_EXCHANGE_LABELS: Record<TipoIntercambioInspeccion, [string, string]> = {
  REQUERIMIENTO: ['Nuevo requerimiento', 'Abrí este aviso para revisar el pedido, su plazo y responder.'],
  RESPUESTA: ['Nueva respuesta', 'Abrí el intercambio para leer la respuesta y revisar qué sigue.'],
  DESCARGO: ['Descargo presentado', 'Revisá el descargo recibido antes de resolver.'],
  SUBSANACION: ['Subsanación presentada', 'Revisá la documentación recibida antes de resolver.'],
  PRONUNCIAMIENTO: ['Pronunciamiento disponible', 'Consultá el pronunciamiento de la autoridad en el expediente.'],
  CIERRE_CONFORME: ['Cierre conforme', 'La autoridad cerró el seguimiento conforme. Consultá el fundamento en el expediente.'],
  DERIVACION_LEGALES: ['Derivación a Legales', 'La autoridad derivó el expediente a Legales. Consultá el fundamento de la decisión.'],
};

export const INSPECTION_AGENDA_LABELS = {
  CREADA: ['Nueva inspección', 'Revisá el responsable y prepará la visita.'],
  PROGRAMADA: ['Inspección programada', 'Revisá la fecha prevista y el responsable en la agenda.'],
  REPROGRAMADA: ['Inspección reprogramada', 'La fecha prevista cambió. Consultá la agenda actualizada antes de la visita.'],
  AGENDA_RETIRADA: ['Inspección sin fecha programada', 'Se retiró la fecha prevista. Administración debe definir la próxima visita.'],
  REASIGNADA: ['Responsable de inspección actualizado', 'Consultá el responsable y la fecha vigentes en el expediente.'],
  SUJETO_VINCULADO: ['Sujeto de inspección identificado', 'Se vinculó el sujeto del expediente. Revisá su seguimiento y el ámbito competente.'],
  EN_CAMPO: ['Inspección en campo', 'El recorrido comenzó. El inspector asignado registra los controles y evidencias.'],
  EN_REVISION: ['Inspección para revisar', 'El trabajo de campo está cerrado. Administración debe revisar el expediente.'],
  NOTIFICADA: ['Inspección puesta a disposición', 'Consultá el expediente, las observaciones y el plazo de respuesta.'],
  CANCELADA: ['Inspección cancelada', 'La visita quedó cancelada. Consultá el motivo en el expediente.'],
  EN_TRAMITE_LEGAL: ['Expediente en trámite legal', 'Consultá el seguimiento de la derivación y la próxima actuación.'],
  FINALIZADA: ['Inspección finalizada', 'Consultá el resultado y la trazabilidad del expediente.'],
} as const;
