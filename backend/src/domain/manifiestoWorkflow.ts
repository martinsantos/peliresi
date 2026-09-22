import { EstadoManifiesto } from '@prisma/client';
import { z } from 'zod';

export const registrarIncidenteSchema = z.object({
  tipoIncidente: z.string().trim().min(1).max(120).optional(),
  tipo: z.string().trim().min(1).max(120).optional(),
  descripcion: z.string().trim().min(1, 'La descripcion es requerida').max(1000),
  latitud: z.number().finite().min(-90).max(90).optional(),
  longitud: z.number().finite().min(-180).max(180).optional(),
}).refine((value) => Boolean(value.tipoIncidente || value.tipo), {
  message: 'El tipo de incidente es requerido',
  path: ['tipoIncidente'],
});

export const confirmarRecepcionSchema = z.object({
  observaciones: z.string().trim().max(1000).optional(),
  pesoReal: z.coerce.number().finite().nonnegative().optional(),
});

export const rechazarCargaSchema = z.object({
  motivo: z.string().trim().min(3, 'El motivo del rechazo es requerido').max(500),
  descripcion: z.string().trim().max(2000).optional(),
  cantidadRechazada: z.coerce.number().finite().positive().optional(),
});

export const registrarTratamientoSchema = z.object({
  metodoTratamiento: z.string().trim().min(1).max(300).optional(),
  metodo: z.string().trim().min(1).max(300).optional(),
  fechaTratamiento: z.string().trim().max(100).optional(),
  observaciones: z.string().trim().max(2000).optional(),
}).refine((value) => Boolean(value.metodoTratamiento || value.metodo), {
  message: 'El metodo de tratamiento es requerido',
  path: ['metodoTratamiento'],
});

export const cancelarManifiestoSchema = z.object({
  motivo: z.string().trim().min(3).max(1000).optional(),
});

const weighingItemSchema = z.object({
  id: z.string().trim().min(1),
  pesoReal: z.coerce.number().finite().nonnegative(),
});

const receivedItemSchema = z.object({
  id: z.string().trim().min(1),
  cantidadRecibida: z.coerce.number().finite().nonnegative(),
});

export const registrarPesajeSchema = z.union([
  z.object({
    residuosPesados: z.array(weighingItemSchema).min(1),
    observaciones: z.string().trim().max(1000).optional(),
  }).transform(({ residuosPesados, observaciones }) => ({ items: residuosPesados, observaciones })),
  z.object({
    residuos: z.array(receivedItemSchema).min(1),
    observaciones: z.string().trim().max(1000).optional(),
  }).transform(({ residuos, observaciones }) => ({
    items: residuos.map(({ id, cantidadRecibida }) => ({ id, pesoReal: cantidadRecibida })),
    observaciones,
  })),
]).superRefine(({ items }, context) => {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    context.addIssue({ code: 'custom', message: 'No se puede pesar dos veces el mismo residuo' });
  }
});

export const revertirManifiestoSchema = z.object({
  estadoNuevo: z.nativeEnum(EstadoManifiesto),
  motivo: z.string().trim().min(3).max(1000).optional(),
});

export const VALID_MANIFEST_REVERSIONS: Partial<Record<EstadoManifiesto, EstadoManifiesto[]>> = {
  APROBADO: ['BORRADOR'],
  EN_TRANSITO: ['APROBADO'],
  ENTREGADO: ['EN_TRANSITO'],
  RECIBIDO: ['ENTREGADO'],
  EN_TRATAMIENTO: ['RECIBIDO'],
  TRATADO: ['EN_TRATAMIENTO', 'RECIBIDO'],
  RECHAZADO: ['ENTREGADO'],
};

export function canRevertManifest(current: EstadoManifiesto, next: EstadoManifiesto): boolean {
  return Boolean(VALID_MANIFEST_REVERSIONS[current]?.includes(next));
}

export function reversionCleanup(next: EstadoManifiesto): Record<string, null> {
  const data: Record<string, null> = {};

  if (next === 'BORRADOR') {
    data.fechaFirma = null;
    data.qrCode = null;
  }
  if (['BORRADOR', 'APROBADO'].includes(next)) data.fechaRetiro = null;
  if (['BORRADOR', 'APROBADO', 'EN_TRANSITO'].includes(next)) data.fechaEntrega = null;
  if (['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO'].includes(next)) data.fechaRecepcion = null;
  if (next !== 'TRATADO') data.fechaCierre = null;
  if (next !== 'EN_TRATAMIENTO' && next !== 'TRATADO') {
    data.tratamientoMetodo = null;
    data.tratamientoAutorizadoId = null;
  }

  return data;
}

export function hasCompleteCoordinates(latitud?: number, longitud?: number): boolean {
  return Number.isFinite(latitud) && Number.isFinite(longitud);
}
