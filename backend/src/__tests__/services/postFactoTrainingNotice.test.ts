import { afterEach, expect, it, vi } from 'vitest';
import { inTrainingSession } from '../../lib/trainingScope';
import { noticeNewCurrents } from '../../services/postFactoNotice.service';
afterEach(() => vi.unstubAllEnvs());
it('routes a new-current classroom notice to that synthetic team only, retaining fail-closed real configuration', async () => {
  vi.stubEnv('MANIFEST_PARTY_REVIEW_ENABLED','false'); vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS','real-authority');
  const tx = { usuario: { findMany: vi.fn().mockResolvedValue([{id:'cap-20261012-admin-5'}]) }, notificacion: { createMany: vi.fn() } };
  await noticeNewCurrents(tx as never, [{corriente:'Y1'}], [{corriente:'Y2'}], '/manifiestos/test/adendas', 'review', 'cap-20261012-generador-5');
  expect(tx.usuario.findMany).not.toHaveBeenCalled();
  await inTrainingSession(() => noticeNewCurrents(tx as never, [{corriente:'Y1'}], [{corriente:'Y2'}], '/manifiestos/test/adendas', 'review', 'cap-20261012-generador-5'));
  expect(tx.usuario.findMany).toHaveBeenCalledWith({where:{id:{in:['cap-20261012-admin-5']},rol:'ADMIN',activo:true},select:{id:true}});
  expect(tx.notificacion.createMany.mock.calls[0][0].data).toHaveLength(1);
  expect(tx.notificacion.createMany.mock.calls[0][0].data[0].usuarioId).toBe('cap-20261012-admin-5');
});
it('never silently approves a new current without a configured operational authority', async () => {
  vi.stubEnv('MANIFEST_PARTY_REVIEW_ENABLED','true'); vi.stubEnv('MANIFEST_EXCEPTIONAL_REVIEWERS','');
  const tx = { usuario:{findMany:vi.fn().mockResolvedValue([])},notificacion:{createMany:vi.fn()} };
  await expect(noticeNewCurrents(tx as never,[],[{corriente:'Y1'}],'/test','review')).rejects.toThrow('No hay autoridad designada');
  expect(tx.notificacion.createMany).not.toHaveBeenCalled();
});
