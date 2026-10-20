import type { InspectionActorType } from './inspection';
export type FindingDifference = { corriente: string; unidad: string; declarado: number | null; observado: number | null; tipo: string };
export interface OperatorFinding {
  formato: string; fecha: string; autorId: string; estadoAlRegistrar: string; motivo: string;
  diferencias: FindingDifference[];
  alcanceOperador: { estado: string; valorOriginal: string | null; corrientesNoRegistradas: string[]; fichaActualizadaAt: string; nombre: string };
}
export interface InspectionIntake {
  id: string; origen: string; origenId: string; referencia: string; tipoActor: InspectionActorType;
  actorId: string | null; actorNombre: string; motivos: string[]; huellaEvidencia: string;
  estado: string; version: number; createdAt: string;
  evidencia: Partial<OperatorFinding> & { motivo?: string; participante?: Record<string, string>; etapaAlRegistrar?: string; inicio?: string };
  eventos: { id: string; accion: string; motivo: string; autorId: string; fecha: string }[];
  inspeccion?: { id: string; numero: string; estado: string } | null;
}
export const INTAKE_REASON_LABELS: Record<string, string> = {
  CANTIDAD_DIFERENTE: 'Cantidad diferente', Y_OMITIDA: 'Y omitida en el manifiesto', NO_OBSERVADA: 'Corriente no observada', UNIDAD_DIFERENTE: 'Unidad diferente',
  Y_NO_CONSTA_EN_FICHA_OPERADOR: 'Y no registrada en la ficha del operador', ALCANCE_SIN_VERIFICAR: 'Alcance del operador sin verificar',
  PARTICIPANTE_SIN_ALTA: 'Participante sin alta', RELEVO_SIN_ALTA: 'Relevo sin alta', IDENTIDAD_INCOMPLETA: 'Identidad incompleta',
};
export const INTAKE_STATE_LABELS: Record<string, string> = { PENDIENTE: 'Por evaluar', EN_EVALUACION: 'En evaluación', VINCULADA: 'Con inspección', DESCARTADA: 'Descartada con motivo' };
