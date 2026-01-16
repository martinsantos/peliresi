/**
 * Logger Estructurado con Pino
 * OPTIMIZADO: JSON logging para ELK stack / CloudWatch
 */
import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
    bindings: () => ({
      service: 'sitrep-backend',
      version: process.env.npm_package_version || '1.0.0',
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // En desarrollo, usar pino-pretty para legibilidad
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});

// Helpers para logging contextual
export const createRequestLogger = (reqId: string, userId?: string) => {
  return logger.child({ reqId, userId });
};

// Log de performance
export const logPerformance = (
  operation: string,
  durationMs: number,
  metadata?: object
) => {
  const logMethod = durationMs > 1000 ? 'warn' : 'info';
  logger[logMethod]({
    type: 'performance',
    operation,
    durationMs,
    slow: durationMs > 1000,
    ...metadata,
  });
};

// Log de base de datos
export const logQuery = (
  query: string,
  durationMs: number,
  params?: unknown[]
) => {
  if (durationMs > 500) {
    logger.warn({
      type: 'db_slow_query',
      query: query.substring(0, 200), // Truncar queries largas
      durationMs,
      params: params?.length || 0,
    });
  }
};

// Log de errores con contexto
export const logError = (
  error: Error,
  context: { operation: string; userId?: string; [key: string]: unknown }
) => {
  logger.error({
    type: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    },
    ...context,
  });
};

// Log de seguridad
export const logSecurity = (
  event: string,
  details: { userId?: string; ip?: string; [key: string]: unknown }
) => {
  logger.warn({
    type: 'security',
    event,
    ...details,
  });
};

export default logger;
