import { expect, it, vi } from 'vitest';
import type { Prisma, Renovacion } from '@prisma/client';
import { notifyRenovacion } from '../../services/renovacion-notification.service';
it.each(['GENERADOR', 'OPERADOR'])('notifies only the relevant %s reviewers on submission, inside the supplied transaction', async tipoActor => {
  const createMany = vi.fn().mockResolvedValue({ count: 2 }), findMany = vi.fn().mockResolvedValue([{ id: 'admin' }, { id: 'sector' }, { id: 'sector' }]);
  const findUnique = vi.fn().mockResolvedValue({ usuarioId: 'owner', razonSocial: 'Empresa de práctica' });
  const tx = { generador: { findUnique }, operador: { findUnique }, usuario: { findMany }, notificacion: { createMany } } as unknown as Prisma.TransactionClient;
  await notifyRenovacion(tx, { id: 'renewal', tipoActor, generadorId: tipoActor === 'GENERADOR' ? 'g' : null, operadorId: tipoActor === 'OPERADOR' ? 'o' : null, anio: 2027 } as Renovacion, 'MODIFICACION_SOLICITADA');
  expect(findMany).toHaveBeenCalledWith({ where: { activo: true, rol: { in: ['ADMIN', 'ADMIN_' + tipoActor] } }, select: { id: true } });
  expect(createMany.mock.calls[0][0].data.map((row: { usuarioId: string }) => row.usuarioId)).toEqual(['admin', 'sector']);
  expect(createMany.mock.calls[0][0].data[0].mensaje).toContain('Empresa de práctica · ' + (tipoActor === 'GENERADOR' ? 'Generador' : 'Operador') + ' · Período 2027. Administración debe revisar');
});
it.each(['GENERADOR', 'OPERADOR'].flatMap(tipoActor => ['MODIFICACION_APROBADA', 'MODIFICACION_RECHAZADA'].map(tipo => ({ tipoActor, tipo }))))('sends $tipo for $tipoActor to the current owner, not the applicant or everyone', async ({ tipoActor, tipo }) => {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const findUnique = vi.fn().mockResolvedValue({ usuarioId: 'owner', razonSocial: 'Empresa de práctica' });
  const tx = { generador: { findUnique }, operador: { findUnique }, notificacion: { createMany } } as unknown as Prisma.TransactionClient;
  await notifyRenovacion(tx, { id: 'renewal', tipoActor, generadorId: tipoActor === 'GENERADOR' ? 'g' : null, operadorId: tipoActor === 'OPERADOR' ? 'o' : null, anio: 2027, motivoRechazo: 'Falta constancia' } as Renovacion, tipo as never);
  expect(createMany.mock.calls[0][0].data).toHaveLength(1);
  const row = createMany.mock.calls[0][0].data[0];
  expect(row).toMatchObject({ usuarioId: 'owner', tipo });
  expect(JSON.parse(row.datos)).toEqual({ tipo: 'renovacion_padron', version: 1, renovacionId: 'renewal', tipoActor, actorNombre: 'Empresa de práctica', anio: 2027 });
  expect(row.mensaje).toContain('Período 2027');
  if (tipo === 'MODIFICACION_RECHAZADA') expect(row.mensaje).toContain('Motivo: Falta constancia');
});
