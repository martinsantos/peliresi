export type InspectionActorType = 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';
export type InspectionType = InspectionActorType | 'PETROLEO' | 'AIRE' | 'ESPONTANEA';
export const INSPECTION_TYPES: Record<InspectionType, { label: string; serie: string }> = {
  GENERADOR: { label: 'Generador', serie: 'GRP' }, TRANSPORTISTA: { label: 'Transporte', serie: 'TRP' },
  OPERADOR: { label: 'Operador', serie: 'ORP' }, PETROLEO: { label: 'Petróleo', serie: 'PRP' },
  AIRE: { label: 'Aire', serie: 'ARP' }, ESPONTANEA: { label: 'Espontánea / denuncia', serie: 'IRP' },
};

/** The official series is immutable, independent of a later actor association. */
export function inspectionTypeOf(record: { numero: string; tipoActor?: InspectionActorType | null }): InspectionType {
  const serie = /^(GRP|TRP|ORP|PRP|ARP|IRP)-\d{4}-\d{5}$/.exec(record.numero)?.[1];
  return (Object.keys(INSPECTION_TYPES) as InspectionType[]).find((type) => INSPECTION_TYPES[type].serie === serie) || record.tipoActor || 'ESPONTANEA';
}

export function inspectionNumberExample(type: InspectionType): string {
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Argentina/Mendoza' }).format(new Date());
  return `${INSPECTION_TYPES[type].serie}-${year}-00001`;
}
export type InspectionItemResult = 'PENDIENTE' | 'CUMPLE' | 'NO_CUMPLE' | 'NO_APLICA';
export type InspectionEvidenceType = 'FOTO' | 'AUDIO' | 'DOCUMENTO';
export type InspectionComparisonResult = 'PENDIENTE' | 'COINCIDE' | 'DIFIERE' | 'NO_VERIFICADO' | 'NO_APLICA';
export type InspectionExchangeParty = 'AUTORIDAD' | 'INSPECCIONADO' | 'SISTEMA';
export type InspectionExchangeType =
  | 'REQUERIMIENTO' | 'RESPUESTA' | 'DESCARGO' | 'SUBSANACION'
  | 'PRONUNCIAMIENTO' | 'CIERRE_CONFORME' | 'DERIVACION_LEGALES';
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

export interface InspectionVerification {
  url: string;
  huella: string;
  version: number;
  estadoVerificacion?: 'VIGENTE' | 'HISTORICA_AUTENTICA';
  versionActual?: number;
  huellaActual?: string;
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

export interface InspectionDeclaredDocument {
  id: string;
  tipo: string;
  nombre: string;
  anio?: number | null;
  estado: string;
  createdAt: string;
}

export interface InspectionDeclaredSnapshot {
  schemaVersion: number;
  capturedAt: string;
  actorType: InspectionActorType;
  actorId: string;
  documents?: InspectionDeclaredDocument[];
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

export interface InspectionExchangeAttachment {
  id: string;
  nombreOriginal: string;
  mimeDetectado: string;
  bytes: number;
  sha256: string;
  descripcion?: string | null;
  capturadaAt: string;
  createdAt: string;
}

export interface InspectionExchange {
  id: string;
  inspeccionId: string;
  secuencia: number;
  clienteId?: string | null;
  respondeAId?: string | null;
  tipo: InspectionExchangeType;
  parte: InspectionExchangeParty;
  destinatario: InspectionExchangeParty;
  asunto: string;
  cuerpo: string;
  plazoRespuestaAt?: string | null;
  presentadoFueraDePlazo: boolean;
  canal: 'PORTAL_SITREP';
  versionExpediente: number;
  contenidoSha256: string;
  hashAnterior?: string | null;
  hashCadena: string;
  autorId: string;
  puestaDisposicionAt: string;
  vistaPorDestinatarioAt?: string | null;
  createdAt: string;
  autor: { id: string; nombre: string; apellido?: string | null; rol: string };
  adjuntos: InspectionExchangeAttachment[];
}

export interface InspectionExchangeTimeline {
  inspeccion: {
    id: string;
    numero: string;
    numeroActa?: string | null;
    estado: InspectionState;
    tipoActor: InspectionActorType | null;
    actor: InspectionActor | null;
    plazoRespuestaAt?: string | null;
    version: number;
  };
  parteActual: InspectionExchangeParty;
  intercambios: InspectionExchange[];
  comunicacionExterna: false;
}

export interface Inspection {
  id: string;
  numero: string;
  numeroActa?: string | null;
  tipoActor: InspectionActorType | null;
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
  verificacion?: InspectionVerification | null;
  declaradoSnapshot?: InspectionDeclaredSnapshot | null;
  items: InspectionItem[];
  comparaciones: InspectionComparison[];
  evidencias: InspectionEvidence[];
  eventos: InspectionEvent[];
  _count?: { items: number; evidencias: number; eventos: number };
}

export const inspectionActor = (inspection: Inspection): InspectionActor | null =>
  inspection.generador || inspection.transportista || inspection.operador || null;
