import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), notify: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  renovacion: { findUnique: mocks.findUnique },
  $transaction: async (callback: any) => callback({ renovacion: { updateMany: mocks.updateMany, findUniqueOrThrow: mocks.findUniqueOrThrow } }),
} }));
vi.mock('../../services/renovacion-notification.service', () => ({ notifyRenovacion: mocks.notify }));
import { aprobarRenovacion, rechazarRenovacion } from '../../controllers/renovacion.controller';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue({ id: 'r', estado: 'PENDIENTE', modalidad: 'SIN_CAMBIOS', tipoActor: 'GENERADOR', observaciones: 'Datos originales del solicitante' });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.findUniqueOrThrow.mockResolvedValue({ id: 'r' });
});
it.each([aprobarRenovacion, rechazarRenovacion])('preserves original observations when the reviewer omits an override (%#)', async handler => {
  const next = vi.fn(), json = vi.fn();
  await handler({ params: { id: 'r' }, user: { id: 'admin', rol: 'ADMIN' }, body: { motivoRechazo: 'Constancia ilegible' } } as any, { json } as any, next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.updateMany.mock.calls[0][0].data.observaciones).toBeUndefined();
  expect(mocks.updateMany.mock.calls[0][0].where).toEqual({ id: 'r', estado: 'PENDIENTE' });
  expect(mocks.notify).toHaveBeenCalledOnce();
});
it.each([aprobarRenovacion, rechazarRenovacion])('retains an explicitly supplied reviewer observation (%#)', async handler => {
  const next = vi.fn();
  await handler({ params: { id: 'r' }, user: { id: 'admin', rol: 'ADMIN' }, body: { motivoRechazo: 'Constancia ilegible', observaciones: 'Observación administrativa expresa' } } as any, { json: vi.fn() } as any, next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.updateMany.mock.calls[0][0].data.observaciones).toBe('Observación administrativa expresa');
});
