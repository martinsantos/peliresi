/**
 * SITREP v6 - API Types
 * Tipos para requests/responses del backend
 */

import type {
  Usuario, Manifiesto, Generador, Transportista, Operador,
  Vehiculo, Chofer, TipoResiduo, Notificacion, ReglaAlerta,
  AlertaGenerada, AnomaliaTransporte, Auditoria, Rol, EstadoManifiesto,
} from './models';

// ========================================
// GENERIC RESPONSE TYPES
// ========================================

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  status: number;
  message: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type PaginatedResponse<T> = ApiSuccessResponse<PaginatedData<T>>;

// ========================================
// AUTH
// ========================================

export interface LoginRequest {
  email?: string;
  cuit?: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Usuario;
  restricted?: boolean;
  solicitudId?: string | null;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ========================================
// MANIFIESTOS
// ========================================

export interface CreateManifiestoRequest {
  generadorId: string;
  transportistaId?: string;
  operadorId: string;
  modalidad?: 'FIJO' | 'IN_SITU';
  fechaEstimadaRetiro?: string;
  observaciones?: string;
  residuos: CreateManifiestoResiduoRequest[];
}

export interface CreateManifiestoResiduoRequest {
  tipoResiduoId: string;
  cantidad: number;
  unidad: string;
  descripcion?: string;
}

export interface FirmarManifiestoRequest {
  firma?: string;
}

export interface ConfirmarRetiroRequest {
  observaciones?: string;
  latitud?: number;
  longitud?: number;
}

export interface ConfirmarEntregaRequest {
  observaciones?: string;
  latitud?: number;
  longitud?: number;
}

export interface PesajeRequest {
  residuos: { id: string; cantidadRecibida: number }[];
  observaciones?: string;
}

export interface ConfirmarRecepcionRequest {
  observaciones?: string;
}

export interface RegistrarTratamientoRequest {
  metodo: string;
  observaciones?: string;
}

export interface RechazarManifiestoRequest {
  motivo: string;
  descripcion?: string;
}

export interface RegistrarIncidenteRequest {
  tipo: string;
  descripcion?: string;
  latitud?: number;
  longitud?: number;
}

export interface ManifiestoFilters {
  estado?: EstadoManifiesto;
  generadorId?: string;
  transportistaId?: string;
  operadorId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'numero' | 'estado';
  sortOrder?: 'asc' | 'desc';
}

export interface ManifiestoDashboard {
  total: number;
  porEstado: Record<EstadoManifiesto, number>;
  ultimosMeses: { mes: string; cantidad: number }[];
}

// ========================================
// ACTORES
// ========================================

export interface CreateGeneradorRequest {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroInscripcion: string;
  categoria: string;
  actividad?: string;
  rubro?: string;
  corrientesControl?: string;
  latitud?: number;
  longitud?: number;
  expedienteInscripcion?: string;
  domicilioLegalCalle?: string;
  domicilioLegalLocalidad?: string;
  domicilioLegalDepto?: string;
  domicilioRealCalle?: string;
  domicilioRealLocalidad?: string;
  domicilioRealDepto?: string;
  certificacionISO?: string;
  resolucionInscripcion?: string;
  factorR?: number;
  montoMxR?: number;
  categoriaIndividual?: string;
  libroOperatoria?: boolean;
  tefInputs?: Record<string, unknown>;
}

export interface CreateTransportistaRequest {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  localidad?: string;
  telefono: string;
  numeroHabilitacion: string;
  vencimientoHabilitacion?: string;
  latitud?: number;
  longitud?: number;
  corrientesAutorizadas?: string;
  expedienteDPA?: string;
  resolucionDPA?: string;
  resolucionSSP?: string;
  actaInspeccion?: string;
  actaInspeccion2?: string;
}

export interface CreateOperadorRequest {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroHabilitacion: string;
  categoria: string;
  tipoOperador?: string;
  tecnologia?: string;
  corrientesY?: string;
  expedienteInscripcion?: string;
  certificadoNumero?: string;
  domicilioLegalCalle?: string;
  domicilioLegalLocalidad?: string;
  domicilioLegalDepto?: string;
  domicilioRealCalle?: string;
  domicilioRealLocalidad?: string;
  domicilioRealDepto?: string;
  representanteLegalNombre?: string;
  representanteLegalDNI?: string;
  representanteLegalTelefono?: string;
  representanteTecnicoNombre?: string;
  representanteTecnicoMatricula?: string;
  representanteTecnicoTelefono?: string;
  vencimientoHabilitacion?: string;
  resolucionDPA?: string;
  latitud?: number;
  longitud?: number;
  tefInputs?: Record<string, unknown>;
}

// ========================================
// RENOVACIONES
// ========================================

export interface Renovacion {
  id: string;
  anio: number;
  tipoActor: 'GENERADOR' | 'OPERADOR';
  generadorId?: string;
  operadorId?: string;
  modalidad: 'SIN_CAMBIOS' | 'CON_CAMBIOS';
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  datosActuales?: string;
  datosNuevos?: string;
  camposModificados?: string;
  tefAnterior?: number;
  tefNuevo?: number;
  revisadoPor?: string;
  fechaRevision?: string;
  observaciones?: string;
  motivoRechazo?: string;
  createdAt: string;
  generador?: { razonSocial: string; cuit: string };
  operador?: { razonSocial: string; cuit: string };
}

export interface RenovacionFilters {
  anio?: number;
  tipoActor?: string;
  estado?: string;
  page?: number;
  limit?: number;
}

export interface CreateRenovacionRequest {
  anio: number;
  tipoActor: 'GENERADOR' | 'OPERADOR';
  generadorId?: string;
  operadorId?: string;
  modalidad: 'SIN_CAMBIOS' | 'CON_CAMBIOS';
  datosNuevos?: any;
  camposModificados?: string[];
  tefAnterior?: number;
  tefNuevo?: number;
  observaciones?: string;
}

// ========================================
// SOLICITUDES DE INSCRIPCION
// ========================================

export type EstadoSolicitud = 'BORRADOR' | 'ENVIADA' | 'EN_REVISION' | 'OBSERVADA' | 'APROBADA' | 'RECHAZADA';

export interface SolicitudInscripcion {
  id: string;
  usuarioId: string;
  tipoActor: 'GENERADOR' | 'OPERADOR';
  estado: EstadoSolicitud;
  datosActor: string;
  datosResiduos?: string;
  datosTEF?: string;
  datosRegulatorio?: string;
  fechaEnvio?: string;
  fechaRevision?: string;
  revisadoPor?: string;
  motivoRechazo?: string;
  observaciones?: string;
  generadorId?: string;
  operadorId?: string;
  createdAt: string;
  updatedAt: string;
  usuario?: { id: string; email: string; nombre: string; rol: string };
  documentos?: DocumentoSolicitud[];
  mensajes?: MensajeSolicitud[];
  _count?: { documentos: number; mensajes: number };
}

export interface DocumentoSolicitud {
  id: string;
  solicitudId: string;
  tipo: string;
  nombre: string;
  path: string;
  mimeType: string;
  size: number;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  observaciones?: string;
  revisadoPor?: string;
  revisadoAt?: string;
  createdAt: string;
}

export interface MensajeSolicitud {
  id: string;
  solicitudId: string;
  autorId: string;
  autorRol: 'ADMIN' | 'CANDIDATO';
  contenido: string;
  leido: boolean;
  leidoAt?: string;
  createdAt: string;
}

export interface SolicitudFilters {
  estado?: EstadoSolicitud;
  tipoActor?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IniciarSolicitudRequest {
  email: string;
  password: string;
  nombre: string;
  tipoActor: 'GENERADOR' | 'OPERADOR';
  cuit: string;
}

export interface UpdateSolicitudRequest {
  datosActor?: string;
  datosResiduos?: string;
  datosTEF?: string;
  datosRegulatorio?: string;
}

// ========================================
// HISTORIAL / AUDITORIA ACTORES
// ========================================

export interface AuditoriaEntry {
  id: string;
  accion: string;
  modulo: string;
  datosAntes?: string;
  datosDespues?: string;
  createdAt: string;
  usuario?: { nombre: string; email: string; rol: string };
}

export interface ActorFilters {
  search?: string;
  activo?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ========================================
// TRACKING
// ========================================

export interface TrackingUpdateRequest {
  manifiestoId: string;
  latitud: number;
  longitud: number;
  velocidad?: number;
  direccion?: number;
  precision?: number;
}

// ========================================
// NOTIFICACIONES
// ========================================

export interface NotificacionFilters {
  leida?: boolean;
  tipo?: string;
  page?: number;
  limit?: number;
}

// ========================================
// ALERTAS
// ========================================

export interface CreateReglaAlertaRequest {
  nombre: string;
  descripcion?: string;
  evento: string;
  condicion: string;
  destinatarios: string;
}

export interface AlertaFilters {
  estado?: string;
  reglaId?: string;
  page?: number;
  limit?: number;
}

// ========================================
// REPORTES
// ========================================

export interface ReporteFilters {
  fechaDesde?: string;
  fechaHasta?: string;
  generadorId?: string;
  transportistaId?: string;
  operadorId?: string;
  tipo?: string;
}

export type ExportFormat = 'pdf' | 'excel' | 'csv';

// ========================================
// USUARIOS (ADMIN)
// ========================================

export interface CreateUsuarioRequest {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  rol: Rol;
  empresa?: string;
  telefono?: string;
  cuit?: string;
}

export interface UpdateUsuarioRequest {
  email?: string;
  nombre?: string;
  apellido?: string;
  empresa?: string;
  telefono?: string;
  activo?: boolean;
  esInspector?: boolean;
}

export interface UsuarioFilters {
  rol?: Rol;
  activo?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ========================================
// ANALYTICS / DASHBOARD
// ========================================

export interface DashboardStats {
  // Backend real format from GET /api/manifiestos/dashboard
  estadisticas?: {
    borradores: number;
    aprobados: number;
    enTransito: number;
    entregados: number;
    recibidos: number;
    tratados: number;
    total: number;
  };
  recientes?: Manifiesto[];
  enTransitoList?: Manifiesto[];
  // Legacy frontend format (kept for compatibility)
  manifiestos?: {
    total: number;
    enTransito: number;
    completados: number;
    pendientes: number;
  };
  actores?: {
    generadores: number;
    transportistas: number;
    operadores: number;
  };
  alertas?: {
    pendientes: number;
    criticas: number;
  };
  residuos?: {
    totalKg: number;
    tratados: number;
  };
}

export interface DashboardChart {
  label: string;
  value: number;
}

// ========================================
// CATALOGOS
// ========================================

// CatalogoItem covers all actor/catalog types returned by /api/catalogos/*
// The index signature is intentional: different actor types have different shapes.
export interface CatalogoItem {
  id: string;
  nombre?: string;
  razonSocial?: string;
  label?: string;
  cuit?: string;
  telefono?: string;
  domicilio?: string;
  numeroInscripcion?: string;
  numeroHabilitacion?: string;
  categoria?: string;
  activo?: boolean;
  patente?: string;       // Vehiculo
  licencia?: string;      // Chofer
  metodo?: string;        // TratamientoAutorizado
  usuario?: { email: string; nombre?: string };
  [key: string]: unknown;
}

export interface CatalogosResponse {
  tiposResiduo: TipoResiduo[];
  generadores: CatalogoItem[];
  transportistas: CatalogoItem[];
  operadores: CatalogoItem[];
  vehiculos: CatalogoItem[];
  choferes: CatalogoItem[];
  tratamientos: CatalogoItem[];
}
