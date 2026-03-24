import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import logger from '../utils/logger';

export class AppError extends Error {
  public statusCode?: number;
  public code?: string | number;
  public details?: any;
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
  // Log error with structured context
  logger.error({
    err,
    method: req.method,
    path: req.path,
    statusCode: err.statusCode || 500,
  }, err.message);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';
  let details = err.details;

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
  }

  // In production, don't expose internal error details for 500 errors
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Error interno del servidor';
    details = undefined;
  }

  // Respuesta de error
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
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
