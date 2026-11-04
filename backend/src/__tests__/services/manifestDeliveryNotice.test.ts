import { beforeEach, expect, it, vi } from 'vitest';
const companyRecipients = vi.hoisted(() => vi.fn());
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: companyRecipients }));
import { notifyManifestDelivery } from '../../services/manifestDeliveryNotice.service';

const generator = { empresaId: 'gco', actividadId: 'ga', rol: 'GENERADOR', razonSocial: 'QA Generador', establecimientoId: 'site' };
const operator = { empresaId: 'oco', actividadId: 'oa', rol: 'OPERADOR', razonSocial: 'QA Operador' };
const manifest = { id: 'm', numero: 'QA-M', generador: { usuarioId: 'generator' }, transportista: { usuarioId: 'carrier' }, operador: { usuarioId: 'operator' } };
let tx: any;
beforeEach(() => {
 companyRecipients.mockReset(); companyRecipients.mockResolvedValue([
  { usuarioId: 'rep', accesosEmpresa: [generator, operator] },
  { usuarioId: 'generator', accesosEmpresa: [generator] },
  { usuarioId: 'carrier', accesosEmpresa: [operator] },
  { usuarioId: 'empty', accesosEmpresa: [] },
 ]);
 tx = { usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'admin' }]) },
  notificacion: { createMany: vi.fn().mockImplementation(async ({ data }) => ({ count: data.length })) } };
});
it('saves one delivery notice per party, authorized representative and administrator', async () => {
 const notices = await notifyManifestDelivery(tx, manifest, 'event', 'carrier');
 expect(notices.map(n => n.usuarioId).sort()).toEqual(['generator', 'operator', 'rep', 'admin'].sort());
 expect(new Set(notices.map(n => n.id)).size).toBe(notices.length);
 expect(JSON.parse(notices.find(n => n.usuarioId === 'generator')!.datos)).toEqual({ tipo: 'estado_manifiesto', version: 1, estado: 'ENTREGADO' });
 expect(JSON.parse(notices.find(n => n.usuarioId === 'rep')!.datos)).toMatchObject({ tipo: 'alerta_evento_manifiesto', version: 1,
  evento: 'ENTREGA', eventoId: 'event', destino: 'representante', accesosEmpresa: [generator, operator] });
 expect(tx.notificacion.createMany).toHaveBeenCalledWith({ data: notices });
});
it('retains the existing administrator audience even when an administrator confirms delivery', async () => {
 const notices = await notifyManifestDelivery(tx, manifest, 'event', 'admin');
 expect(notices.filter(n => n.usuarioId === 'admin')).toHaveLength(1);
 expect(notices.filter(n => n.usuarioId === 'carrier')).toHaveLength(1);
});
it('uses distinct deterministic ids for each event and person', async () => {
 const first = await notifyManifestDelivery(tx, manifest, 'event', 'carrier');
 const again = await notifyManifestDelivery(tx, manifest, 'event', 'carrier');
 const next = await notifyManifestDelivery(tx, manifest, 'other-event', 'carrier');
 expect(first).toEqual(again); expect(next[0].id).not.toBe(first[0].id);
});
it('propagates insertion failures so that the delivery can roll back', async () => {
 tx.notificacion.createMany.mockRejectedValueOnce(new Error('inbox unavailable'));
 await expect(notifyManifestDelivery(tx, manifest, 'event', 'carrier')).rejects.toThrow('inbox unavailable');
});
