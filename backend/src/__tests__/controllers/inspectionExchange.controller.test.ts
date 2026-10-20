import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inspection: vi.fn(),
  inspections: vi.fn(),
  exchanges: vi.fn(),
  existingExchange: vi.fn(),
  persist: vi.fn(),
  remove: vi.fn(),
  transaction: vi.fn(),
  lock: vi.fn(),
  lockedInspection: vi.fn(),
  previousExchange: vi.fn(),
  createExchange: vi.fn(),
  createEvidence: vi.fn(),
  updateInspection: vi.fn(),
  createEvent: vi.fn(),
  finalExchange: vi.fn(),
  markViewed: vi.fn(),
  recipients: vi.fn(),
  notices: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: mocks.inspection, findMany: mocks.inspections },
  intercambioInspeccion: { findMany: mocks.exchanges, findFirst: mocks.existingExchange, findUniqueOrThrow: mocks.finalExchange, updateMany: mocks.markViewed },
  $transaction: mocks.transaction,
} }));
vi.mock('../../services/inspectionEvidence.service', () => ({
  persistInspectionEvidence: mocks.persist,
  removeInspectionEvidence: mocks.remove,
  resolveInspectionEvidence: vi.fn(),
}));

import {
  listarParticipacionInspeccionado,
  obtenerIntercambiosInspeccion,
  presentarIntercambioInspeccion,
  decidirIntercambioInspeccion,
} from '../../controllers/inspectionExchange.controller';

const actorInspection = {
  id: 'inspection-1',
  numero: 'I-2026-000001',
  numeroActa: '116-2026',
  estado: 'NOTIFICADA',
  version: 7,
  tipoActor: 'GENERADOR',
  inspectorId: 'inspector-1',
  generadorId: 'generator-1',
  transportistaId: null,
  operadorId: null,
  plazoRespuestaAt: new Date('2026-09-30T18:00:00Z'),
  generador: { id: 'generator-1', razonSocial: 'Generador QA', cuit: '30-00000000-1' },
  transportista: null,
  operador: null,
};

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), sendFile: vi.fn() };
}

function actorUser(actorId = 'generator-1') {
  return { id: 'actor-user-1', rol: 'GENERADOR', generador: { id: actorId }, esInspector: false };
}

describe('inspection participant exchange controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspection.mockResolvedValue(actorInspection);
    mocks.exchanges.mockResolvedValue([]);
    mocks.markViewed.mockResolvedValue({ count: 1 });
    mocks.recipients.mockResolvedValue([{ id: 'recipient' }]);
    mocks.notices.mockReset().mockResolvedValue({ count: 1 });
    mocks.inspections.mockResolvedValue([{ ...actorInspection, _count: { intercambios: 2 } }]);
    mocks.existingExchange.mockResolvedValue(null);
    mocks.persist.mockResolvedValue({
      storageKey: 'inspecciones/inspection-1/decision.pdf', mimeType: 'application/pdf', bytes: 120, sha256: 'd'.repeat(64),
    });
    mocks.lockedInspection.mockResolvedValue({ version: 7, estado: 'EN_DESCARGO' });
    mocks.previousExchange.mockResolvedValue({ secuencia: 2, hashCadena: 'c'.repeat(64) });
    mocks.createExchange.mockResolvedValue({ id: 'exchange-decision' });
    mocks.finalExchange.mockResolvedValue({ id: 'exchange-decision', adjuntos: [{ id: 'evidence-decision' }] });
    mocks.transaction.mockImplementation(async (callback) => callback({
      $queryRaw: mocks.lock,
      inspeccion: { findUniqueOrThrow: mocks.lockedInspection, update: mocks.updateInspection },
      intercambioInspeccion: { findFirst: mocks.previousExchange, create: mocks.createExchange },
      evidenciaInspeccion: { create: mocks.createEvidence },
      eventoInspeccion: { create: mocks.createEvent },
      usuario: { findMany: mocks.recipients },
      notificacion: { createMany: mocks.notices },
    }));
  });

  it('returns only inspections constrained by the authenticated actor relation', async () => {
    const res = response();
    const next = vi.fn();
    await listarParticipacionInspeccionado({ user: actorUser() } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.inspections).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ generadorId: 'generator-1' }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ id: 'inspection-1', cantidadPresentaciones: 2 })],
    }));
  });

  it.each([['TRANSPORTISTA', 'transportista', 'transportistaId'], ['OPERADOR', 'operador', 'operadorId'], ['GENERADOR', 'generador', 'generadorId']])('scopes %s independently of requested filters and hides internal drafts', async (rol, relation, field) => {
    const next = vi.fn();
    await listarParticipacionInspeccionado({ user: { id: 'owner', rol, [relation]: { id: 'own' } },
      query: { actorId: 'other', estado: 'BORRADOR' } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    const where = mocks.inspections.mock.calls[0][0].where;
    expect(where[field]).toBe('own');
    expect(where.estado.in).toContain('NOTIFICADA');
    expect(where.estado.in).not.toContain('BORRADOR');
    for (const state of ['BORRADOR', 'EN_CAMPO', 'EN_REVISION']) {
      mocks.inspection.mockResolvedValue({ ...actorInspection, tipoActor: rol, [field]: 'own', estado: state });
      await obtenerIntercambiosInspeccion({ params: { id: 'inspection-1' }, user: { rol, [relation]: { id: 'own' } } } as any, response() as any, next);
      expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ statusCode: 403 }));
    }
    expect(mocks.markViewed).not.toHaveBeenCalled();
    expect(mocks.exchanges).not.toHaveBeenCalled();
  });

  it('shows the formal timeline to the inspected actor linked to the case', async () => {
    const res = response();
    const next = vi.fn();
    await obtenerIntercambiosInspeccion({ params: { id: 'inspection-1' }, user: actorUser() } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.exchanges).toHaveBeenCalledWith(expect.objectContaining({ where: { inspeccionId: 'inspection-1' } }));
    expect(mocks.markViewed).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ destinatario: 'INSPECCIONADO', vistaPorDestinatarioAt: null }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ parteActual: 'INSPECCIONADO', comunicacionExterna: false }),
    }));
  });

  it('blocks another actor from reading the case', async () => {
    const next = vi.fn();
    await obtenerIntercambiosInspeccion(
      { params: { id: 'inspection-1' }, user: actorUser('generator-2') } as any,
      response() as any,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.exchanges).not.toHaveBeenCalled();
  });

  it('rejects an unlinked actor before persisting any attachment', async () => {
    const next = vi.fn();
    await presentarIntercambioInspeccion({
      params: { id: 'inspection-1' },
      user: actorUser('generator-2'),
      body: {
        version: '7',
        clienteId: 'response_12345678',
        tipo: 'DESCARGO',
        asunto: 'Descargo documentado',
        cuerpo: 'Se acompaña la documentación solicitada por la autoridad.',
        respondeAId: 'exchange-authority-1',
      },
      files: [{ size: 120, originalname: 'constancia.pdf', buffer: Buffer.from('%PDF') }],
    } as any, response() as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('preserves a decision attachment in the same hashed legal-closing presentation', async () => {
    const res = response();
    const next = vi.fn();
    await decidirIntercambioInspeccion({
      params: { id: 'inspection-1' },
      user: { id: 'admin-generator-1', rol: 'ADMIN_GENERADOR', esInspector: false },
      body: {
        version: '7',
        clienteId: 'decision_12345678',
        decision: 'DERIVADA_LEGALES',
        fundamento: 'Persisten incumplimientos documentados que requieren dictamen jurídico.',
        expedienteLegal: 'EX-2026-000099',
      },
      files: [{ size: 120, originalname: 'dictamen.pdf', buffer: Buffer.from('%PDF-1.4') }],
    } as any, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.persist).toHaveBeenCalledTimes(1);
    expect(mocks.createExchange).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        clienteId: 'decision_12345678', tipo: 'DERIVACION_LEGALES', hashCadena: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    }));
    expect(mocks.createEvidence).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ intercambioId: 'exchange-decision', nombreOriginal: 'dictamen.pdf', sha256: 'd'.repeat(64) }),
    }));
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metadata: expect.objectContaining({ adjuntosSha256: ['d'.repeat(64)], correoEnviado: false }) }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('No se envió correo') }));
    expect(mocks.notices).toHaveBeenCalledTimes(1);
    expect(JSON.parse(mocks.notices.mock.calls[0][0].data[0].datos)).toMatchObject({ intercambioId: 'exchange-decision', evento: 'DERIVACION_LEGALES', destino: 'participacion', soloCampana: true });
  });

  it.each(['presentation', 'decision'])('does not duplicate bell notices on an idempotent %s retry', async operation => {
    mocks.existingExchange.mockResolvedValue({ id: 'already-committed' });
    const res = response(), next = vi.fn();
    const handler = operation === 'decision' ? decidirIntercambioInspeccion : presentarIntercambioInspeccion;
    await handler({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: 'retry_12345678', tipo: 'REQUERIMIENTO', asunto: 'Pedido documentado', cuerpo: 'Constancia artificial solicitada para revisión.',
      decision: 'CERRADA_CONFORME', fundamento: 'Se revisó toda la documentación y se dispone el cierre conforme.',
    } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 'already-committed' } }));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.notices).not.toHaveBeenCalled();
  });
  it('does not acknowledge a decision if its internal notice cannot be persisted', async () => {
    mocks.notices.mockRejectedValue(new Error('notification persistence unavailable'));
    const res = response(), next = vi.fn();
    await decidirIntercambioInspeccion({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, decision: 'CERRADA_CONFORME', fundamento: 'Se revisó toda la documentación y se dispone el cierre conforme.',
    } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'notification persistence unavailable' }));
    expect(res.json).not.toHaveBeenCalled();
    expect(mocks.finalExchange).not.toHaveBeenCalled();
  });
  it('still rejects a new request with a past deadline before storing any evidence', async () => {
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: 'new_expired_1234', tipo: 'REQUERIMIENTO', asunto: 'Pedido nuevo con fecha pasada',
      cuerpo: 'Una nueva presentación no puede registrar ahora un plazo ya vencido.', plazoRespuestaAt: '2020-01-01T12:00:00Z',
    } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks.persist).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([-1, 0, 1])('marks the response late only after the exact timestamp (%s ms)', async offset => {
    const due = new Date('2026-10-20T15:00:00Z');
    vi.useFakeTimers(); vi.setSystemTime(new Date(due.getTime() + offset));
    try {
      mocks.lockedInspection.mockResolvedValue({ version: 7, estado: 'EN_DESCARGO', plazoRespuestaAt: null });
      mocks.previousExchange.mockResolvedValueOnce({ secuencia: 2, hashCadena: 'c'.repeat(64) }).mockResolvedValueOnce({
        id: 'exact-request', parte: 'AUTORIDAD', tipo: 'REQUERIMIENTO', secuencia: 1, respondeAId: null, plazoRespuestaAt: due,
      });
      const next = vi.fn();
      await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: actorUser(), body: {
        version: 7, tipo: 'RESPUESTA', respondeAId: 'exact-request', asunto: 'Respuesta en el límite temporal', cuerpo: 'Constancia artificial para verificar el instante exacto de presentación.',
      } } as any, response() as any, next);
      expect(next).not.toHaveBeenCalled();
      expect(mocks.createExchange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ presentadoFueraDePlazo: offset > 0 }) }));
    } finally { vi.useRealTimers(); }
  });

  it('recognizes an already committed request on retry after its deadline', async () => {
    mocks.existingExchange.mockResolvedValue({ id: 'expired-committed-request' });
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: 'retry_expired_1234', tipo: 'REQUERIMIENTO', asunto: 'Pedido ya registrado',
      cuerpo: 'Reintento artificial del mismo pedido ya guardado, sin alterar el plazo.', plazoRespuestaAt: '2020-01-01T12:00:00Z',
    } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 'expired-committed-request' } }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('follows the same reply thread to its original request, without using another thread deadline', async () => {
    mocks.lockedInspection.mockResolvedValue({ version: 7, estado: 'EN_DESCARGO', plazoRespuestaAt: new Date('2030-01-01T12:00:00Z') });
    mocks.previousExchange.mockResolvedValueOnce({ secuencia: 4, hashCadena: 'c'.repeat(64) })
      .mockResolvedValueOnce({ id: 'authority-answer', parte: 'AUTORIDAD', tipo: 'RESPUESTA', secuencia: 3, respondeAId: 'actor-answer', plazoRespuestaAt: null })
      .mockResolvedValueOnce({ id: 'actor-answer', parte: 'INSPECCIONADO', tipo: 'RESPUESTA', secuencia: 2, respondeAId: 'original', plazoRespuestaAt: null })
      .mockResolvedValueOnce({ id: 'original', parte: 'AUTORIDAD', tipo: 'REQUERIMIENTO', secuencia: 1, respondeAId: null, plazoRespuestaAt: new Date('2020-01-01T12:00:00Z') });
    const next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: actorUser(), body: {
      version: 7, tipo: 'SUBSANACION', respondeAId: 'authority-answer', asunto: 'Subsanación del mismo pedido', cuerpo: 'Constancias artificiales de la misma cadena de intercambio.',
    } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.createExchange).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ presentadoFueraDePlazo: true }) }));
    expect(mocks.previousExchange).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'original', inspeccionId: 'inspection-1', secuencia: { lt: 2 } } }));
  });

  it.each([
    ['older request expired, newer deadline future', '2030-01-01T12:00:00Z', '2020-01-01T12:00:00Z', true],
    ['older request still open, newer deadline expired', '2020-01-01T12:00:00Z', '2030-01-01T12:00:00Z', false],
    ['request without a registered deadline', '2020-01-01T12:00:00Z', null, false],
  ] as const)('uses the answered request deadline: %s', async (_label, active, own, late) => {
    mocks.lockedInspection.mockResolvedValue({ version: 7, estado: 'EN_DESCARGO', plazoRespuestaAt: new Date(active) });
    mocks.previousExchange.mockResolvedValueOnce({ secuencia: 3, hashCadena: 'c'.repeat(64) }).mockResolvedValueOnce({
      id: 'request-older', parte: 'AUTORIDAD', tipo: 'REQUERIMIENTO', secuencia: 1, respondeAId: null,
      plazoRespuestaAt: own ? new Date(own) : null,
    });
    const next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: actorUser(), body: {
      version: 7, tipo: 'RESPUESTA', respondeAId: 'request-older', asunto: 'Constancia del pedido anterior',
      cuerpo: 'Respuesta artificial vinculada al requerimiento concreto, sin alterar otras fechas.',
    } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.createExchange).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ presentadoFueraDePlazo: late, respondeAId: 'request-older' }),
    }));
  });

});
