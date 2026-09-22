export type InspectionActorType = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
export type InspectionItemResult = 'PENDIENTE' | 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA';
export type InspectionEvidenceType = 'FOTO' | 'AUDIO' | 'DOCUMENTO';
export type InspectionComparisonResult = 'PENDIENTE' | 'COINCIDE' | 'DIFIERE' | 'NO_VERIFICADO' | 'NO_APLICA';
export type InspectionState =
  | 'BORRADOR' | 'PLANIFICADA' | 'EN_CAMPO' | 'EN_REVISION' | 'NOTIFICADA'
  | 'EN_DESCARGO' | 'REQUIERE_SUBSANACION' | 'CERRADA_CONFORME'
  | 'DERIVADA_LEGALES' | 'EN_TRAMITE_LEGAL' | 'DERIVADA_ATM'
  | 'FINALIZADA' | 'CANCELADA';

export interface InspectionActor {
  id: string;
  razonSocial: string;
  cuit: string;
  domicilio?: string;
  telefono?: string;
  email?: string;
  representanteLegalNombre?: string | null;
  representanteLegalDNI?: string | null;
  activo?: boolean;
}

export interface InspectionActData {
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
}

export interface InspectionTechnicalReport {
  expedienteElectronico?: string;
  referencias?: string;
  objetivo?: string;
  antecedentes?: string;
  evaluacion?: string;
  conclusion?: string;
  recomendacion?: string;
}

export interface InspectionItem {
  id: string;
  codigo: string;
  categoria: string;
  etiqueta: string;
  orden: number;
  obligatorio: boolean;
  resultado: InspectionItemResult;
  observacion?: string | null;
  evidencias: InspectionEvidence[];
}

export interface InspectionEvidence {
  id: string;
  clienteId?: string | null;
  tipo: InspectionEvidenceType;
  nombreOriginal: string;
  mimeDetectado: string;
  bytes: number;
  sha256?: string;
  descripcion?: string | null;
  transcripcion?: string | null;
  capturadaAt: string;
  createdAt: string;
  latitud?: number | null;
  longitud?: number | null;
  anuladaAt?: string | null;
  anuladaPorId?: string | null;
  motivoAnulacion?: string | null;
  comparacionId?: string | null;
  eventoId?: string | null;
  itemId?: string | null;
  creadoPor?: { id: string; nombre: string; apellido?: string | null };
  anuladaPor?: { id: string; nombre: string; apellido?: string | null } | null;
}

export interface InspectionComparison {
  id: string;
  codigo: string;
  categoria: string;
  etiqueta: string;
  origen: string;
  valorDeclarado?: string | null;
  valorObservado?: string | null;
  resultado: InspectionComparisonResult;
  observacion?: string | null;
  orden: number;
  verificadoAt?: string | null;
  evidencias: InspectionEvidence[];
}

export interface InspectionEvent {
  id: string;
  tipo: string;
  titulo: string;
  detalle?: string | null;
  estadoDesde?: string | null;
  estadoHasta?: string | null;
  visibleActor: boolean;
  canal?: string;
  estadoEntrega?: string | null;
  destinatario?: string | null;
  createdAt: string;
  usuario: { id: string; nombre: string; apellido?: string | null };
  adjuntos?: InspectionEvidence[];
}

export interface Inspection {
  id: string;
  numero: string;
  numeroActa?: string | null;
  tipoActor: InspectionActorType;
  estado: InspectionState;
  inspectorId: string;
  inspector: { id: string; nombre: string; apellido?: string | null; email?: string };
  generador?: InspectionActor | null;
  transportista?: InspectionActor | null;
  operador?: InspectionActor | null;
  ubicacion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  fechaProgramada?: string | null;
  iniciadaAt?: string | null;
  cerradaCampoAt?: string | null;
  plazoRespuestaAt?: string | null;
  observaciones?: string | null;
  datosActa?: InspectionActData | null;
  informeTecnico?: InspectionTechnicalReport | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: InspectionItem[];
  comparaciones: InspectionComparison[];
  evidencias: InspectionEvidence[];
  eventos: InspectionEvent[];
  _count?: { items: number; evidencias: number; eventos: number };
}

export const inspectionActor = (inspection: Inspection): InspectionActor | null =>
  inspection.generador || inspection.transportista || inspection.operador || null;
