import { expect, it, vi } from 'vitest';
import type { Prisma, Renovacion } from '@prisma/client';
import { notifyRenovacion } from '../../services/renovacion-notification.service';
it.each(['GENERADOR', 'OPERADOR'])('notifies only the relevant %s reviewers on submission, inside the supplied transaction', async tipoActor => {
  const createMany = vi.fn().mockResolvedValue({ count: 2 }), findMany = vi.fn().mockResolvedValue([{ id: 'admin' }, { id: 'sector' }, { id: 'sector' }]);
  const tx = { usuario: { findMany }, notificacion: { createMany } } as unknown as Prisma.TransactionClient;
  await notifyRenovacion(tx, { id: 'renewal', tipoActor } as Renovacion, 'MODIFICACION_SOLICITADA');
  expect(findMany).toHaveBeenCalledWith({ where: { activo: true, rol: { in: ['ADMIN', 'ADMIN_' + tipoActor] } }, select: { id: true } });
  expect(createMany.mock.calls[0][0].data.map((row: { usuarioId: string }) => row.usuarioId)).toEqual(['admin', 'sector']);
});
it.each(['MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA'] as const)('sends %s to the current owner, not the applicant or everyone', async tipo => {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const tx = { generador: { findUnique: vi.fn().mockResolvedValue({ usuarioId: 'owner' }) }, notificacion: { createMany } } as unknown as Prisma.TransactionClient;
  await notifyRenovacion(tx, { id: 'renewal', tipoActor: 'GENERADOR', generadorId: 'actor', motivoRechazo: 'Falta constancia' } as Renovacion, tipo);
  expect(createMany.mock.calls[0][0].data).toHaveLength(1);
  expect(createMany.mock.calls[0][0].data[0]).toMatchObject({ usuarioId: 'owner', tipo, datos: '{"renovacionId":"renewal","tipoActor":"GENERADOR"}' });
});
