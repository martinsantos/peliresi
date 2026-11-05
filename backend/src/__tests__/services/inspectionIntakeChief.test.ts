import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
vi.mock('../../lib/prisma', () => ({ default: { $queryRaw: vi.fn(() => { throw Error('Use transaction client'); }) } }));
import { recordEventualIntakes, recordInspectionIntake } from '../../services/inspectionIntake.service';
const tx = { $queryRaw: vi.fn(), antecedenteFiscalizacion: { createMany: vi.fn() }, usuario: { findMany: vi.fn() }, notificacion: { createMany: vi.fn() } };
const client = tx as unknown as Prisma.TransactionClient;
const input = { origen: 'PARTICIPANTE_EVENTUAL', origenId: 'record', referencia: 'BI-record', tipoActor: 'GENERADOR' as const, actorNombre: 'QA', motivos: ['PARTICIPANTE_SIN_ALTA'], evidencia: { participante: { nombre: 'QA' } }, creadoPorId: 'creator' };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('INSPECTION_FIELD_MODEL_ENABLED', 'true'); tx.$queryRaw.mockResolvedValue([{ usuarioId: 'chief' }]); tx.antecedenteFiscalizacion.createMany.mockResolvedValue({ count: 1 }); tx.usuario.findMany.mockResolvedValue([{ id: 'chief' }, { id: 'admin' }]); });
afterEach(() => vi.unstubAllEnvs());
it('includes explicit active chiefs with sector authorities inside the same transaction', async () => {
  await recordInspectionIntake(client, input);
  expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain("r.\"role\" = 'ADMIN_INSPECCIONES'");
  expect(tx.$queryRaw.mock.calls[0][0].join('')).toContain('u."activo" = true');
  expect(tx.usuario.findMany).toHaveBeenCalledWith({ where: { activo: true, id: { not: 'creator' }, OR: [{ rol: { in: ['ADMIN', 'ADMIN_GENERADOR'] } }, { id: { in: ['chief'] } }] }, select: { id: true } });
  const data = tx.notificacion.createMany.mock.calls[0][0].data;
  expect(data.map((row: { usuarioId: string }) => row.usuarioId)).toEqual(['chief', 'admin']);
  expect(JSON.parse(data[0].datos)).toMatchObject({ tipo: 'antecedente_fiscalizacion', url: '/inspecciones?vista=antecedentes' });
});
it('does not duplicate notices on a replayed source', async () => {
  tx.antecedenteFiscalizacion.createMany.mockResolvedValue({ count: 0 });
  await recordInspectionIntake(client, input);
  expect(tx.$queryRaw).not.toHaveBeenCalled(); expect(tx.notificacion.createMany).not.toHaveBeenCalled();
});
it('does not infer chiefs when the field-model capability is off', async () => {
  vi.stubEnv('INSPECTION_FIELD_MODEL_ENABLED', 'false');
  await recordInspectionIntake(client, input);
  expect(tx.$queryRaw).not.toHaveBeenCalled();
  expect(tx.usuario.findMany.mock.calls[0][0].where.OR[1]).toEqual({ id: { in: [] } });
});
it('queues each unregistered participant and preserves the original declaration', async () => {
  const participant = { nombre: 'QA externo', identificacion: 'QA123', domicilio: 'QA calle' };
  await recordEventualIntakes(client, { id: 'eventual', creadoPorId: 'creator', etapa: 'DECLARADO', datos: { generador: participant, transportista: { padronId: 't1' }, operador: { padronId: 'o1' } } });
  expect(tx.antecedenteFiscalizacion.createMany).toHaveBeenCalledTimes(1);
  expect(tx.antecedenteFiscalizacion.createMany.mock.calls[0][0].data[0]).toMatchObject({ tipoActor: 'GENERADOR', actorNombre: 'QA externo', evidencia: { participante: participant } });
});
