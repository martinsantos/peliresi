import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInspectionExchangeNotices, inspectionParticipantNoticeWhere } from '../../services/inspectionExchangeNotice.service';

const inspection = { id: 'case-1', numero: 'QA-PSIP-1', inspectorId: 'inspector', tipoActor: 'GENERADOR' as const, generadorId: 'generator' };
const exchange = { id: 'exchange-1', secuencia: 3, tipo: 'REQUERIMIENTO' as const, parte: 'AUTORIDAD' as const, autorId: 'author' };
beforeEach(() => vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'false'));
afterEach(() => vi.unstubAllEnvs());
function transaction(recipients = [{ id: 'recipient' }]) {
  return { usuario: { findMany: vi.fn().mockResolvedValue(recipients) }, notificacion: { createMany: vi.fn().mockResolvedValue({ count: recipients.length }) } };
}

describe('PSIP transactional notices without direct delivery', () => {
  it.each([
    ['GENERADOR', 'generador', 'generadorId'], ['TRANSPORTISTA', 'transportista', 'transportistaId'], ['OPERADOR', 'operador', 'operadorId'],
  ])('limits authority messages to the linked active %s, without copying the sender', async (tipoActor, relation, field) => {
    const tx = transaction();
    await createInspectionExchangeNotices(tx as any, { ...inspection, tipoActor, [field]: 'owner' } as any, exchange);
    expect(tx.usuario.findMany).toHaveBeenCalledWith({ where: { AND: [
      { activo: true, id: { not: 'author' } }, { rol: tipoActor, [relation]: { is: { id: 'owner' } } },
    ] }, select: { id: true } });
  });
  it.each(['RESPUESTA', 'DESCARGO', 'SUBSANACION'] as const)('routes actor %s to the assigned inspector and competent admins only', async tipo => {
    const tx = transaction([{ id: 'inspector' }, { id: 'admin' }, { id: 'admin' }]);
    await createInspectionExchangeNotices(tx as any, inspection, { ...exchange, tipo, parte: 'INSPECCIONADO' });
    expect(tx.usuario.findMany).toHaveBeenCalledWith({ where: { AND: [
      { activo: true, id: { not: 'author' } },
      { OR: [{ rol: { in: ['ADMIN', 'ADMIN_GENERADOR'] } }, { id: 'inspector', esInspector: true }] },
    ] }, select: { id: true } });
    expect(tx.notificacion.createMany.mock.calls[0][0].data.map((row: any) => row.usuarioId)).toEqual(['inspector', 'admin']);
  });
  it.each(['REQUERIMIENTO', 'RESPUESTA', 'DESCARGO', 'SUBSANACION', 'PRONUNCIAMIENTO', 'CIERRE_CONFORME', 'DERIVACION_LEGALES'] as const)('persists a safe actionable %s without free text, email or push', async tipo => {
    const tx = transaction();
    await createInspectionExchangeNotices(tx as any, inspection, { ...exchange, tipo });
    const row = tx.notificacion.createMany.mock.calls[0][0].data[0];
    expect(row).toMatchObject({ tipo: 'INFO_GENERAL', prioridad: 'NORMAL', titulo: expect.stringMatching(/^PSIP · /), mensaje: expect.stringContaining('QA-PSIP-1 · Actuación #3.') });
    expect(JSON.parse(row.datos)).toEqual({ tipo: 'intercambio_inspeccion', version: 1, inspeccionId: 'case-1', numero: 'QA-PSIP-1', intercambioId: 'exchange-1', secuencia: 3, evento: tipo, parte: 'AUTORIDAD', destino: 'participacion', correoVersion: 1, tipoActor: 'GENERADOR' });
    // The transaction exposes only user lookup and notice insertion. No external dispatcher.
    expect(Object.keys(tx)).toEqual(['usuario', 'notificacion']);
  });
  it('does not infer recipients from an unlinked spontaneous contact or notify inactive accounts', async () => {
    const tx = transaction();
    await createInspectionExchangeNotices(tx as any, { ...inspection, tipoActor: null, generadorId: null }, exchange);
    expect(tx.usuario.findMany).not.toHaveBeenCalled();
    tx.usuario.findMany.mockResolvedValue([]);
    await createInspectionExchangeNotices(tx as any, inspection, exchange);
    expect(tx.notificacion.createMany).not.toHaveBeenCalled();
  });
  it('propagates persistence failures to abort the surrounding business transaction', async () => {
    const tx = transaction(); tx.notificacion.createMany.mockRejectedValue(new Error('notice transaction failed'));
    await expect(createInspectionExchangeNotices(tx as any, inspection, exchange)).rejects.toThrow('notice transaction failed');
  });
});

it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] as const)('requires the exact approved secondary %s activity for a multirol recipient', role => {
  vi.stubEnv('ACTOR_MULTIROLE_ENABLED', 'true');
  try {
    const relation = role.toLowerCase(), field = relation + 'Id';
    const where = inspectionParticipantNoticeWhere({ ...inspection, tipoActor: role, [field]: 'actor-own' });
    expect(where).toEqual({ [relation]: { is: { id: 'actor-own' } }, OR: [
      { rol: role },
      { rol: { in: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] }, [relation]: { is: { id: 'actor-own', activo: true } },
        solicitudes: { some: { estado: 'APROBADA', tipoActor: role, [field]: 'actor-own' } } },
    ] });
  } finally { vi.unstubAllEnvs(); }
});

it('preserves the committed requirement deadline in the bell metadata', async () => {
  const tx = transaction(); const deadline = new Date('2026-10-25T15:00:00Z');
  await createInspectionExchangeNotices(tx as any, inspection, { ...exchange, plazoRespuestaAt: deadline });
  const row = tx.notificacion.createMany.mock.calls[0][0].data[0];
  expect(JSON.parse(row.datos).plazoRespuestaAt).toBe(deadline.toISOString());
  expect(row.mensaje).toContain('25/10/2026');
});
