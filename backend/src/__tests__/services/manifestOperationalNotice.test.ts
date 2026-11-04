import { beforeEach, expect, it, vi } from 'vitest';
const recipients = vi.hoisted(() => vi.fn());
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: recipients }));
import { notifyManifestOperationalEvent } from '../../services/manifestOperationalNotice.service';

const generator = { empresaId: 'gco', actividadId: 'ga', rol: 'GENERADOR', razonSocial: 'QA Generador', establecimientoId: 'site' };
const operator = { empresaId: 'oco', actividadId: 'oa', rol: 'OPERADOR', razonSocial: 'QA Operador' };
let tx: any;
beforeEach(() => {
 recipients.mockReset(); recipients.mockResolvedValue([{ usuarioId: 'rep', accesosEmpresa: [generator, operator] },
  { usuarioId: 'primary-generator', accesosEmpresa: [generator] }]);
 tx = { manifiesto: { findUnique: vi.fn().mockResolvedValue({ numero: 'QA-M', generador: { usuario: { id: 'primary-generator' } },
  operador: { usuario: { id: 'primary-operator' } } }) },
  usuario: { findMany: vi.fn().mockResolvedValue([{ id: 'admin' }, { id: 'author' }]) },
  notificacion: { createMany: vi.fn().mockImplementation(async ({ data }) => ({ count: data.length })) } };
});
it.each([
 { tipo: 'INCIDENTE', descripcion: 'QA', target: 'primary-operator', role: 'OPERADOR', notice: 'INCIDENTE_REPORTADO' },
 { tipo: 'RECHAZO', target: 'primary-generator', role: 'GENERADOR', notice: 'MANIFIESTO_RECHAZADO' },
 { tipo: 'DIFERENCIA_PESO', delta: '20.00%', target: 'primary-generator', role: 'GENERADOR', notice: 'ALERTA_SISTEMA' },
])('notifies the existing target role and its scoped representative for $tipo', async ({ target, role, notice, ...event }) => {
 const result = await notifyManifestOperationalEvent(tx, { ...event, manifiestoId: 'm', eventoId: 'e', authorId: 'author' } as any);
 expect(result.map(n => n.usuarioId).sort()).toEqual(['admin', 'rep', target].sort());
 const representative = result.find(n => n.usuarioId === 'rep')!;
 expect(representative.tipo).toBe(notice); expect(JSON.parse(representative.datos)).toMatchObject({
  tipo: 'alerta_evento_manifiesto', evento: event.tipo, eventoId: 'e', destino: 'representante', accesosEmpresa: [{ rol: role }],
 });
 expect(JSON.parse(result.find(n => n.usuarioId === target)!.datos).destino).toBeUndefined();
 expect(tx.notificacion.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
});
it('uses stable event/person ids and does not dispatch duplicates on replay', async () => {
 const event = { tipo: 'RECHAZO', manifiestoId: 'm', eventoId: 'e', authorId: 'author' } as const;
 const first = await notifyManifestOperationalEvent(tx, event);
 tx.notificacion.createMany.mockResolvedValueOnce({ count: 0 });
 expect(await notifyManifestOperationalEvent(tx, event)).toEqual([]);
 expect(tx.notificacion.createMany.mock.calls[0][0].data).toEqual(tx.notificacion.createMany.mock.calls[1][0].data);
 expect(new Set(first.map(n => n.id)).size).toBe(first.length);
});
it('propagates an insertion failure so the caller can roll back the business event', async () => {
 tx.notificacion.createMany.mockRejectedValueOnce(new Error('notice insertion failed'));
 await expect(notifyManifestOperationalEvent(tx, { tipo: 'RECHAZO', manifiestoId: 'm', eventoId: 'e', authorId: 'author' }))
  .rejects.toThrow('notice insertion failed');
});
