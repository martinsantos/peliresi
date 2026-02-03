/**
 * SITREP v6 - Domain Models
 * Interfaces TypeScript basadas en el schema Prisma del backend
 */

// ========================================
// ENUMS
// ========================================

export enum Rol {
  ADMIN = 'ADMIN',
  GENERADOR = 'GENERADOR',
  TRANSPORTISTA = 'TRANSPORTISTA',
  OPERADOR = 'OPERADOR',
}

export enum EstadoManifiesto {
  BORRADOR = 'BORRADOR',
  PENDIENTE_APROBACION = 'PENDIENTE_APROBACION',
  APROBADO = 'APROBADO',
  EN_TRANSITO = 'EN_TRANSITO',
  ENTREGADO = 'ENTREGADO',
  RECIBIDO = 'RECIBIDO',
  EN_TRATAMIENTO = 'EN_TRATAMIENTO',
  TRATADO = 'TRATADO',
  RECHAZADO = 'RECHAZADO',
  CANCELADO = 'CANCELADO',
}

export enum TipoNotificacion {
  MANIFIESTO_FIRMADO = 'MANIFIESTO_FIRMADO',
  MANIFIESTO_EN_TRANSITO = 'MANIFIESTO_EN_TRANSITO',
  MANIFIESTO_ENTREGADO = 'MANIFIESTO_ENTREGADO',
  MANIFIESTO_RECIBIDO = 'MANIFIESTO_RECIBIDO',
  MANIFIESTO_TRATADO = 'MANIFIESTO_TRATADO',
  MANIFIESTO_RECHAZADO = 'MANIFIESTO_RECHAZADO',
  INCIDENTE_REPORTADO = 'INCIDENTE_REPORTADO',
  ANOMALIA_DETECTADA = 'ANOMALIA_DETECTADA',
  VENCIMIENTO_PROXIMO = 'VENCIMIENTO_PROXIMO',
  ALERTA_SISTEMA = 'ALERTA_SISTEMA',
  INFO_GENERAL = 'INFO_GENERAL',
}

export enum PrioridadNotificacion {
  BAJA = 'BAJA',
  NORMAL = 'NORMAL',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}

export enum EventoAlerta {
  CAMBIO_ESTADO = 'CAMBIO_ESTADO',
  INCIDENTE = 'INCIDENTE',
  DESVIO_RUTA = 'DESVIO_RUTA',
  TIEMPO_EXCESIVO = 'TIEMPO_EXCESIVO',
  DIFERENCIA_PESO = 'DIFERENCIA_PESO',
  RECHAZO_CARGA = 'RECHAZO_CARGA',
  VENCIMIENTO = 'VENCIMIENTO',
  ANOMALIA_GPS = 'ANOMALIA_GPS',
}

export enum EstadoAlerta {
  PENDIENTE = 'PENDIENTE',
  EN_REVISION = 'EN_REVISION',
  RESUELTA = 'RESUELTA',
  DESCARTADA = 'DESCARTADA',
}

export enum TipoAnomalia {
  DESVIO_RUTA = 'DESVIO_RUTA',
  TIEMPO_EXCESIVO = 'TIEMPO_EXCESIVO',
  VELOCIDAD_ANORMAL = 'VELOCIDAD_ANORMAL',
  PARADA_PROLONGADA = 'PARADA_PROLONGADA',
  GPS_PERDIDO = 'GPS_PERDIDO',
  RUTA_NO_AUTORIZADA = 'RUTA_NO_AUTORIZADA',
}

export enum SeveridadAnomalia {
  BAJA = 'BAJA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  CRITICA = 'CRITICA',
}

export enum TipoDiferencia {
  FALTANTE = 'FALTANTE',
  EXCEDENTE = 'EXCEDENTE',
  NINGUNA = 'NINGUNA',
}

// ========================================
// MODELS
// ========================================

export interface Usuario {
  id: string;
  email: string;
  rol: Rol;
  cuit: string | null;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  telefono: string | null;
  activo: boolean;
  dosFaVerificado: boolean;
  createdAt: string;
  updatedAt: string;
  generador?: Generador;
  transportista?: Transportista;
  operador?: Operador;
}

export interface Generador {
  id: string;
  usuarioId: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroInscripcion: string;
  categoria: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  usuario?: Usuario;
}

export interface Transportista {
  id: string;
  usuarioId: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroHabilitacion: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  usuario?: Usuario;
  vehiculos?: Vehiculo[];
  choferes?: Chofer[];
}

export interface Operador {
  id: string;
  usuarioId: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroHabilitacion: string;
  categoria: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  usuario?: Usuario;
  tratamientos?: TratamientoAutorizado[];
}

export interface Vehiculo {
  id: string;
  transportistaId: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number;
  capacidad: number;
  numeroHabilitacion: string;
  vencimiento: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Chofer {
  id: string;
  transportistaId: string;
  nombre: string;
  apellido: string;
  dni: string;
  licencia: string;
  vencimiento: string;
  telefono: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TipoResiduo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  caracteristicas: string | null;
  peligrosidad: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Manifiesto {
  id: string;
  numero: string;
  generadorId: string;
  transportistaId: string;
  operadorId: string;
  creadoPorId: string;
  estado: EstadoManifiesto;
  observaciones: string | null;
  fechaCreacion: string;
  fechaFirma: string | null;
  fechaRetiro: string | null;
  fechaEntrega: string | null;
  fechaRecepcion: string | null;
  fechaCierre: string | null;
  qrCode: string | null;
  createdAt: string;
  updatedAt: string;
  generador?: Generador;
  transportista?: Transportista;
  operador?: Operador;
  creadoPor?: Usuario;
  residuos?: ManifiestoResiduo[];
  eventos?: EventoManifiesto[];
  tracking?: TrackingGPS[];
}

export interface ManifiestoResiduo {
  id: string;
  manifiestoId: string;
  tipoResiduoId: string;
  cantidad: number;
  unidad: string;
  cantidadRecibida: number | null;
  tipoDiferencia: TipoDiferencia | null;
  observaciones: string | null;
  descripcion: string | null;
  estado: string;
  createdAt: string;
  tipoResiduo?: TipoResiduo;
}

export interface EventoManifiesto {
  id: string;
  manifiestoId: string;
  tipo: string;
  descripcion: string;
  ubicacion: string | null;
  latitud: number | null;
  longitud: number | null;
  usuarioId: string;
  createdAt: string;
  usuario?: Usuario;
}

export interface TrackingGPS {
  id: string;
  manifiestoId: string;
  latitud: number;
  longitud: number;
  velocidad: number | null;
  direccion: number | null;
  precision: number | null;
  timestamp: string;
}

export interface TratamientoAutorizado {
  id: string;
  operadorId: string;
  tipoResiduoId: string;
  metodo: string;
  descripcion: string | null;
  capacidad: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  tipoResiduo?: TipoResiduo;
}

export interface Notificacion {
  id: string;
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  datos: string | null;
  manifiestoId: string | null;
  leida: boolean;
  fechaLeida: string | null;
  prioridad: PrioridadNotificacion;
  createdAt: string;
}

export interface ReglaAlerta {
  id: string;
  nombre: string;
  descripcion: string | null;
  evento: EventoAlerta;
  condicion: string;
  destinatarios: string;
  activa: boolean;
  creadoPorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertaGenerada {
  id: string;
  reglaId: string;
  manifiestoId: string | null;
  datos: string;
  estado: EstadoAlerta;
  resueltaPor: string | null;
  fechaResolucion: string | null;
  notas: string | null;
  createdAt: string;
  regla?: ReglaAlerta;
  manifiesto?: Manifiesto;
}

export interface AnomaliaTransporte {
  id: string;
  manifiestoId: string;
  tipo: TipoAnomalia;
  descripcion: string;
  latitud: number;
  longitud: number;
  valorDetectado: number | null;
  valorEsperado: number | null;
  severidad: SeveridadAnomalia;
  resuelta: boolean;
  resueltaPor: string | null;
  fechaResolucion: string | null;
  notas: string | null;
  createdAt: string;
}

export interface Auditoria {
  id: string;
  accion: string;
  modulo: string;
  datosAntes: string | null;
  datosDespues: string | null;
  ip: string | null;
  userAgent: string | null;
  usuarioId: string;
  manifiestoId: string | null;
  createdAt: string;
  usuario?: Usuario;
}
