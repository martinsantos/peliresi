import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import logger from '../utils/logger';

export class AppError extends Error {
  public statusCode?: number;
  public code?: string | number;
  public details?: any;
  /** Explicit, user-facing form guidance; never generic internal error details. */
  public fieldErrors?: Partial<Record<'generador' | 'transportista' | 'operador', string>>;
  public meta?: {
    target?: string[];
  };

  constructor(message: string, statusCode?: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let details = err.details;
  let responseCode: string | number | undefined;
  let retryAfterSeconds: number | undefined;

  // Match safeParse() controllers without exposing the serialized issue tree.
  if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues[0]?.message || 'Revise los datos enviados';
    details = undefined;
  }

  // Manejar errores de Prisma
  if (err instanceof PrismaClientKnownRequestError) {
    // Error de restricción única
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'El registro ya existe';
      details = {
        target: err.meta?.target,
      };
    }
    // Registro no encontrado
    else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Recurso no encontrado';
    }
    // This specific P2028 occurs before the transaction starts. Other P2028
    // variants can have different outcomes and must not be labelled retryable.
    else if (err.code === 'P2028' && (err.meta as Record<string, unknown> | undefined)?.error === 'Unable to start a transaction in the given time.') {
      statusCode = 503;
      message = 'El sistema está ocupado. Esperá unos segundos y revisá el estado antes de volver a intentar.';
      responseCode = 'TRANSACTION_BUSY';
      retryAfterSeconds = 5;
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }
  }

  if (err instanceof MulterError) {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE'
      ? 'El archivo supera el tamaño máximo permitido'
      : 'No se pudo procesar el archivo enviado';
    details = undefined;
  }

  // In production, don't expose internal error details for 500 errors
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Error interno del servidor';
    details = undefined;
  }

  // Log the status actually returned, without exposing internal details to users.
  logger.error({
    err,
    method: req.method,
    path: req.path?.replace(/(\/empresas\/invitaciones\/)[^/]+/,'$1[redacted]'),
    statusCode,
  }, err.message);

  // Respuesta de error
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    code: responseCode ?? (err instanceof AppError && ['INSPECTION_COMMAND_NOT_APPLIED', 'INSPECTION_COMMAND_CONFLICT', 'SUPPORT_ACTION_NOT_APPLIED', 'INSPECTION_SCAN_UNAVAILABLE', 'INSPECTION_SCAN_REJECTED'].includes(String(err.code)) ? err.code : undefined),
    retryAfterSeconds,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    fieldErrors: statusCode === 400 && err instanceof AppError ? err.fieldErrors : undefined,
  });
};

// Manejador para rutas no encontradas
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    status: 404,
    message: `No se encontró ${req.originalUrl} en este servidor`,
  });
};
