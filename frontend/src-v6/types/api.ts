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
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: Usuario;
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
  transportistaId: string;
  operadorId: string;
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
}

export interface ActorFilters {
  search?: string;
  activo?: boolean;
  page?: number;
  limit?: number;
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
  nombre?: string;
  apellido?: string;
  empresa?: string;
  telefono?: string;
  activo?: boolean;
}

export interface UsuarioFilters {
  rol?: Rol;
  activo?: boolean;
  search?: string;
  page?: number;
  limit?: number;
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
  recientes?: Array<any>;
  enTransitoList?: Array<any>;
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

export interface CatalogoItem {
  id: string;
  nombre?: string;
  razonSocial?: string;
  label?: string;
  cuit?: string;
  [key: string]: any;
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
