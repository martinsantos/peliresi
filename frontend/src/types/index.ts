// Tipos de usuario
export type Rol = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR';

export interface Usuario {
    id: string;
    email: string;
    rol: Rol;
    nombre: string;
    apellido?: string;
    empresa?: string;
    telefono?: string;
    activo: boolean;
    createdAt: string;
    generador?: Generador;
    transportista?: Transportista;
    operador?: Operador;
}

// Actores del sistema
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
    latitud?: number;
    longitud?: number;
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
    latitud?: number;
    longitud?: number;
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
}

export interface TipoResiduo {
    id: string;
    codigo: string;
    nombre: string;
    descripcion?: string;
    categoria: string;
    caracteristicas?: string;
    peligrosidad: string;
    activo: boolean;
}

export interface TratamientoAutorizado {
    id: string;
    operadorId: string;
    tipoResiduoId: string;
    metodo: string;
    descripcion?: string;
    capacidad: number;
    activo: boolean;
    tipoResiduo?: TipoResiduo;
}

// Manifiestos
export type EstadoManifiesto =
    | 'BORRADOR'
    | 'PENDIENTE_APROBACION'
    | 'APROBADO'
    | 'EN_TRANSITO'
    | 'ENTREGADO'
    | 'RECIBIDO'
    | 'EN_TRATAMIENTO'
    | 'TRATADO'
    | 'RECHAZADO'
    | 'CANCELADO';

export interface Manifiesto {
    id: string;
    numero: string;
    generadorId: string;
    transportistaId: string;
    operadorId: string;
    estado: EstadoManifiesto;
    observaciones?: string;
    fechaCreacion: string;
    fechaFirma?: string;
    fechaRetiro?: string;
    fechaEntrega?: string;
    fechaRecepcion?: string;
    fechaCierre?: string;
    qrCode?: string;
    createdAt: string;
    updatedAt: string;
    generador?: Generador;
    transportista?: Transportista;
    operador?: Operador;
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
    descripcion?: string;
    observaciones?: string; // CORRECCIÓN 3: Campo para observaciones del residuo
    estado: string;
    tipoResiduo?: TipoResiduo;
}

export interface EventoManifiesto {
    id: string;
    manifiestoId: string;
    tipo: string;
    descripcion: string;
    ubicacion?: string;
    latitud?: number;
    longitud?: number;
    usuarioId: string;
    createdAt: string;
    usuario?: {
        nombre: string;
        apellido?: string;
        rol: Rol;
    };
}

export interface TrackingGPS {
    id: string;
    manifiestoId: string;
    latitud: number;
    longitud: number;
    velocidad?: number;
    direccion?: number;
    precision?: number;
    timestamp: string;
}

// API Response types
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface DashboardStats {
    estadisticas: {
        borradores: number;
        aprobados: number;
        enTransito: number;
        entregados: number;
        recibidos: number;
        tratados: number;
        total: number;
    };
    recientes: Manifiesto[];
    enTransitoList: Manifiesto[];
    // Also support flat structure from API
    borradores?: number;
    aprobados?: number;
    enTransito?: number;
    entregados?: number;
    recibidos?: number;
    tratados?: number;
    total?: number;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}

export interface LoginResponse {
    user: Usuario;
    tokens: AuthTokens;
}
