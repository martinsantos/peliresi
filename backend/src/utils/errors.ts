/**
 * Sistema centralizado de errores
 * Mensajes descriptivos y códigos consistentes
 */

export const ERROR_CODES = {
  // Autenticación (401)
  AUTH_TOKEN_MISSING: 'AUTH_TOKEN_MISSING',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',

  // Autorización (403)
  FORBIDDEN_ROLE_MISMATCH: 'FORBIDDEN_ROLE_MISMATCH',
  FORBIDDEN_NOT_OWNER: 'FORBIDDEN_NOT_OWNER',
  FORBIDDEN_DEMO_MODE_PROD: 'FORBIDDEN_DEMO_MODE_PROD',
  FORBIDDEN_ACTION_NOT_ALLOWED: 'FORBIDDEN_ACTION_NOT_ALLOWED',

  // Recursos (404)
  NOT_FOUND_MANIFIESTO: 'NOT_FOUND_MANIFIESTO',
  NOT_FOUND_USER: 'NOT_FOUND_USER',
  NOT_FOUND_ACTOR: 'NOT_FOUND_ACTOR',

  // Validación (400)
  VALIDATION_INVALID_STATE: 'VALIDATION_INVALID_STATE',
  VALIDATION_MISSING_FIELD: 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_DATA: 'VALIDATION_INVALID_DATA',

  // Sistema (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Mensajes de error con contexto útil para el usuario
 */
export const ERROR_MESSAGES: Record<ErrorCode, {
  message: string;
  hint?: string;
  httpStatus: number;
}> = {
  // Autenticación
  [ERROR_CODES.AUTH_TOKEN_MISSING]: {
    message: 'No se proporcionó token de autenticación',
    hint: 'Inicia sesión para continuar',
    httpStatus: 401
  },
  [ERROR_CODES.AUTH_TOKEN_INVALID]: {
    message: 'Token de autenticación inválido',
    hint: 'Tu sesión puede haber expirado. Inicia sesión nuevamente',
    httpStatus: 401
  },
  [ERROR_CODES.AUTH_TOKEN_EXPIRED]: {
    message: 'Tu sesión ha expirado',
    hint: 'Por seguridad, las sesiones expiran después de un tiempo. Inicia sesión nuevamente',
    httpStatus: 401
  },
  [ERROR_CODES.AUTH_SESSION_EXPIRED]: {
    message: 'Sesión expirada',
    hint: 'Inicia sesión nuevamente para continuar',
    httpStatus: 401
  },

  // Autorización
  [ERROR_CODES.FORBIDDEN_ROLE_MISMATCH]: {
    message: 'No tienes el perfil requerido para esta acción',
    hint: 'Esta acción requiere un perfil diferente. Usa el selector de perfil en el menú para cambiar',
    httpStatus: 403
  },
  [ERROR_CODES.FORBIDDEN_NOT_OWNER]: {
    message: 'No tienes permisos sobre este recurso',
    hint: 'Solo el propietario o un administrador puede realizar esta acción',
    httpStatus: 403
  },
  [ERROR_CODES.FORBIDDEN_DEMO_MODE_PROD]: {
    message: 'Modo demo no disponible en producción',
    hint: 'El modo demo solo está disponible en el ambiente de desarrollo',
    httpStatus: 403
  },
  [ERROR_CODES.FORBIDDEN_ACTION_NOT_ALLOWED]: {
    message: 'Acción no permitida',
    hint: 'No tienes permisos para realizar esta acción',
    httpStatus: 403
  },

  // Recursos no encontrados
  [ERROR_CODES.NOT_FOUND_MANIFIESTO]: {
    message: 'Manifiesto no encontrado',
    hint: 'El manifiesto puede haber sido eliminado o el ID es incorrecto',
    httpStatus: 404
  },
  [ERROR_CODES.NOT_FOUND_USER]: {
    message: 'Usuario no encontrado',
    httpStatus: 404
  },
  [ERROR_CODES.NOT_FOUND_ACTOR]: {
    message: 'Actor no encontrado',
    hint: 'El generador, transportista u operador no existe',
    httpStatus: 404
  },

  // Validación
  [ERROR_CODES.VALIDATION_INVALID_STATE]: {
    message: 'El estado actual no permite esta operación',
    hint: 'Verifica el estado del manifiesto antes de continuar',
    httpStatus: 400
  },
  [ERROR_CODES.VALIDATION_MISSING_FIELD]: {
    message: 'Faltan campos requeridos',
    httpStatus: 400
  },
  [ERROR_CODES.VALIDATION_INVALID_DATA]: {
    message: 'Datos inválidos',
    httpStatus: 400
  },

  // Sistema
  [ERROR_CODES.INTERNAL_ERROR]: {
    message: 'Error interno del servidor',
    hint: 'Intenta nuevamente. Si el problema persiste, contacta al administrador',
    httpStatus: 500
  },
  [ERROR_CODES.DATABASE_ERROR]: {
    message: 'Error de base de datos',
    hint: 'Intenta nuevamente en unos momentos',
    httpStatus: 500
  },
};

/**
 * Clase de error con código y contexto
 */
export class AppErrorWithCode extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly hint?: string;
  public readonly context?: Record<string, any>;

  constructor(
    code: ErrorCode,
    context?: Record<string, any>,
    customMessage?: string
  ) {
    const errorDef = ERROR_MESSAGES[code];
    const message = customMessage || errorDef.message;

    super(message);
    this.name = 'AppErrorWithCode';
    this.code = code;
    this.httpStatus = errorDef.httpStatus;
    this.hint = errorDef.hint;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        hint: this.hint,
        ...(this.context && { context: this.context })
      }
    };
  }
}

/**
 * Helper para crear error de rol incorrecto con contexto
 */
export function createRoleMismatchError(
  currentRole: string,
  requiredRoles: string[],
  action?: string
): AppErrorWithCode {
  const rolesText = requiredRoles.join(' o ');
  const actionText = action ? ` para "${action}"` : '';

  return new AppErrorWithCode(
    ERROR_CODES.FORBIDDEN_ROLE_MISMATCH,
    {
      currentRole,
      requiredRoles,
      action
    },
    `Tu perfil actual es ${currentRole}, pero se requiere ${rolesText}${actionText}`
  );
}

/**
 * Mapeo de roles a nombres legibles
 */
export const ROLE_NAMES: Record<string, string> = {
  ADMIN: 'Administrador DGFA',
  GENERADOR: 'Generador de Residuos',
  TRANSPORTISTA: 'Transportista',
  OPERADOR: 'Operador de Tratamiento',
  ADMIN_TRANSPORTISTAS: 'Admin de Transportistas',
  ADMIN_OPERADORES: 'Admin de Operadores'
};

/**
 * Obtener nombre legible del rol
 */
export function getRoleName(role: string): string {
  return ROLE_NAMES[role] || role;
}
