import prisma from '../lib/prisma';
import logger from './logger';
import type { Prisma } from '@prisma/client';

interface AuditarActorParams {
  accion: 'CREATE' | 'UPDATE' | 'DELETE';
  modulo: 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA' | 'VEHICULO' | 'CHOFER';
  datosAntes?: any;
  datosDespues?: any;
  usuarioId: string;
  generadorId?: string;
  operadorId?: string;
  transportistaId?: string;
  ip?: string;
  userAgent?: string;
}

export async function auditarActor(params: AuditarActorParams, transaction?: Prisma.TransactionClient): Promise<void> {
  const record = async () => {
    await (transaction || prisma).auditoria.create({
      data: {
        accion: params.accion,
        modulo: params.modulo,
        datosAntes: params.datosAntes ? JSON.stringify(params.datosAntes) : null,
        datosDespues: params.datosDespues ? JSON.stringify(params.datosDespues) : null,
        usuarioId: params.usuarioId,
        generadorId: params.generadorId,
        operadorId: params.operadorId,
        transportistaId: params.transportistaId,
        ip: params.ip,
        userAgent: params.userAgent,
      },
    });
  };
  // A profile update and its before/after history must commit or roll back together.
  if (transaction) { await record(); return; }
  try {
    await record();
  } catch (err) {
    logger.error({ err }, 'Error registrando auditoria de actor');
  }
}
