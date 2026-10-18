import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';

const assignmentSchema = z.object({
  version: z.literal(1), transportistaId: z.string().min(1),
  vehiculo: z.object({ id: z.string().min(1), patente: z.string(), marca: z.string(), modelo: z.string() }).nullable(),
  chofer: z.object({ id: z.string().min(1), nombre: z.string(), apellido: z.string(), dni: z.string() }).nullable(),
});
type Selection = { modalidad: 'FIJO' | 'IN_SITU'; transportistaId?: string; vehiculoId?: string; choferId?: string };

/** Creation transaction only. The server snapshots explicit choices, never fleet
 * order. Active ownership is not a certification of legal fitness for the load. */
export async function prepareTransportAssignment(db: Pick<Prisma.TransactionClient, 'vehiculo' | 'chofer'>, input: Selection) {
  if (!input.vehiculoId && !input.choferId) return undefined;
  if (input.modalidad === 'IN_SITU') throw new AppError('La modalidad in situ no admite vehículo ni chofer.', 400);
  if (!input.transportistaId) throw new AppError('Elegí primero el transportista.', 400);
  const vehiculo = input.vehiculoId ? await db.vehiculo.findFirst({
    where: { id: input.vehiculoId, transportistaId: input.transportistaId, activo: true },
    select: { id: true, patente: true, marca: true, modelo: true },
  }) : null;
  if (input.vehiculoId && !vehiculo) throw new AppError('El vehículo no está disponible para este transportista. Revisá la selección.', 400);
  const chofer = input.choferId ? await db.chofer.findFirst({
    where: { id: input.choferId, transportistaId: input.transportistaId, activo: true },
    select: { id: true, nombre: true, apellido: true, dni: true },
  }) : null;
  if (input.choferId && !chofer) throw new AppError('El chofer no está disponible para este transportista. Revisá la selección.', 400);
  return assignmentSchema.parse({ version: 1, transportistaId: input.transportistaId, vehiculo, chofer });
}

export function readTransportAssignment(value: unknown, transportistaId: string | null) {
  const parsed = assignmentSchema.safeParse(value);
  return parsed.success && parsed.data.transportistaId === transportistaId ? parsed.data : null;
}
