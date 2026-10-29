import { beforeEach, expect, it, vi } from 'vitest';
const recipients = vi.hoisted(() => vi.fn());
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: recipients }));
import { notifyManifestState } from '../../services/manifestStateNotice.service';

const generator = { empresaId: 'gco', actividadId: 'ga', rol: 'GENERADOR', razonSocial: 'QA Generador', establecimientoId: 'site' };
const operator = { empresaId: 'oco', actividadId: 'oa', rol: 'OPERADOR', razonSocial: 'QA Operador' };
const manifest = { id: 'm', numero: 'QA-M', generador: { usuarioId: 'generator' },
 transportista: { usuarioId: 'carrier' }, operador: { usuarioId: 'operator' } };
let tx: any;
beforeEach(() => {
 recipients.mockReset(); recipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [generator, operator] },
  { usuarioId: 'generator', accesosEmpresa: [generator] }, { usuarioId: 'empty', accesosEmpresa: [] }]);
 tx = { usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'admin' }]) },
  notificacion: { createMany: vi.fn().mockImplementation(async ({ data }) => ({ count: data.length })) } };
});
it.each([
 ['EN_TRANSITO', 'MANIFIESTO_EN_TRANSITO'], ['ENTREGADO', 'MANIFIESTO_ENTREGADO'],
 ['RECIBIDO', 'MANIFIESTO_RECIBIDO'], ['EN_TRATAMIENTO', 'INFO_GENERAL'],
 ['TRATADO', 'MANIFIESTO_TRATADO'], ['CANCELADO', 'INFO_GENERAL'],
] as const)('commits one scoped notice per recipient for %s', async (estado, tipo) => {
 const ids = await notifyManifestState(tx, manifest, estado, 'event', 'carrier');
 const notices = tx.notificacion.createMany.mock.calls[0][0].data;
 expect(notices.map((n: any) => n.usuarioId).sort()).toEqual(['admin', 'generator', 'operator', 'rep'].sort());
 expect(ids).toEqual(notices.map((n: any) => n.id)); expect(new Set(ids).size).toBe(ids.length);
 expect(notices.every((n: any) => n.tipo === tipo)).toBe(true);
 expect(JSON.parse(notices.find((n: any) => n.usuarioId === 'rep').datos)).toMatchObject({
  tipo: 'estado_manifiesto', version: 1, estado, eventoId: 'event', destino: 'representante', accesosEmpresa: [generator, operator],
 });
 expect(JSON.parse(notices.find((n: any) => n.usuarioId === 'generator').datos).destino).toBeUndefined();
 expect(tx.notificacion.createMany).toHaveBeenCalledWith({ data: notices });
});
it('uses a stable id for the event and user, but a distinct id for a later transition', async () => {
 const first = await notifyManifestState(tx, manifest, 'RECIBIDO', 'event', 'operator');
 const same = await notifyManifestState(tx, manifest, 'RECIBIDO', 'event', 'operator');
 const next = await notifyManifestState(tx, manifest, 'TRATADO', 'next-event', 'operator');
 expect(same).toEqual(first); expect(next[0]).not.toBe(first[0]);
});
it('propagates an inbox insertion failure to roll back the transition', async () => {
 tx.notificacion.createMany.mockRejectedValueOnce(new Error('inbox unavailable'));
 await expect(notifyManifestState(tx, manifest, 'EN_TRANSITO', 'event', 'carrier')).rejects.toThrow('inbox unavailable');
});
