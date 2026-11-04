import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { AppError } from '../../middlewares/errorHandler';

const mocks = vi.hoisted(() => ({
  inspection: vi.fn(),
  inspections: vi.fn(),
  exchanges: vi.fn(),
  existingExchange: vi.fn(),
  lockedReplay: vi.fn(),
  persistedEvidence: vi.fn(),
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
  publicResult: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: mocks.inspection, findMany: mocks.inspections },
  intercambioInspeccion: { findMany: mocks.exchanges, findFirst: mocks.existingExchange, findUniqueOrThrow: mocks.finalExchange, updateMany: mocks.markViewed },
  eventoInspeccion: { findFirst: mocks.publicResult },
  evidenciaInspeccion: { findMany: mocks.persistedEvidence },
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

const retryBody = { version: 7, clienteId: 'retry_12345678', tipo: 'REQUERIMIENTO', asunto: 'Pedido documentado', cuerpo: 'Constancia artificial solicitada para revisión.' };
function committed(body = retryBody, extra: Record<string, unknown> = {}) {
  return { id: 'already-committed', ...body, autorId: 'admin', parte: 'AUTORIDAD', versionExpediente: 8,
    respondeAId: null, plazoRespuestaAt: null, adjuntos: [], ...extra };
}

describe('inspection participant exchange controller', () => {
  it.each(['presentation', 'decision'])('confirms a rejected attachment was not applied only after replay lookup (%s)', async operation => {
    mocks.persist.mockRejectedValueOnce(new AppError('Formato no permitido', 400));
    const res = response(), next = vi.fn();
    await (operation === 'presentation' ? presentarIntercambioInspeccion : decidirIntercambioInspeccion)({
      params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' },
      body: { ...retryBody, decision: 'CERRADA_CONFORME', fundamento: 'Se revisó la constancia para una decisión artificial.' },
      files: [{ originalname: 'invalid.pdf', size: 4, buffer: Buffer.from('fake') }],
    } as any, res as any, next);
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.lockedReplay).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSPECTION_COMMAND_NOT_APPLIED', statusCode: 400 }));
    expect(mocks.createExchange).not.toHaveBeenCalled();
    expect(mocks.notices).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspection.mockResolvedValue(actorInspection);
    mocks.exchanges.mockResolvedValue([]);
    mocks.publicResult.mockResolvedValue(null);
    mocks.markViewed.mockResolvedValue({ count: 1 });
    mocks.recipients.mockResolvedValue([{ id: 'recipient' }]);
    mocks.notices.mockReset().mockResolvedValue({ count: 1 });
    mocks.inspections.mockResolvedValue([{ ...actorInspection, _count: { intercambios: 2 } }]);
    mocks.existingExchange.mockResolvedValue(null);
    mocks.lockedReplay.mockResolvedValue(null);
    mocks.persistedEvidence.mockResolvedValue([]);
    mocks.persist.mockResolvedValue({
      storageKey: 'inspecciones/inspection-1/decision.pdf', mimeType: 'application/pdf', bytes: 120, sha256: 'd'.repeat(64),
    });
    mocks.lockedInspection.mockResolvedValue({ ...actorInspection, estado: 'EN_DESCARGO' });
    mocks.previousExchange.mockResolvedValue({ secuencia: 2, hashCadena: 'c'.repeat(64) });
    mocks.createExchange.mockResolvedValue({ id: 'exchange-decision' });
    mocks.finalExchange.mockResolvedValue({ id: 'exchange-decision', adjuntos: [{ id: 'evidence-decision' }] });
    mocks.transaction.mockImplementation(async (callback) => callback({
      $queryRaw: mocks.lock,
      inspeccion: { findUniqueOrThrow: mocks.lockedInspection, update: mocks.updateInspection },
      intercambioInspeccion: { findFirst: (args: any) => args.where.clienteId ? mocks.lockedReplay(args) : mocks.previousExchange(args), create: mocks.createExchange, findUniqueOrThrow: mocks.finalExchange },
      evidenciaInspeccion: { create: mocks.createEvidence },
      eventoInspeccion: { create: mocks.createEvent, findFirst: mocks.publicResult },
      usuario: { findMany: mocks.recipients },
      notificacion: { createMany: mocks.notices },
    }));
  });

  it.each(['CERRADA_CONFORME', 'DERIVADA_LEGALES', 'FINALIZADA'])('recovers the identical presentation after %s without reopening the case', async estado => {
    mocks.inspection.mockResolvedValue({ ...actorInspection, estado, version: 20 });
    mocks.existingExchange.mockResolvedValue(committed());
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'already-committed' }) }));
    expect(mocks.createExchange).not.toHaveBeenCalled(); expect(mocks.notices).not.toHaveBeenCalled();
  });

  it.each([
    { cuerpo: 'Contenido cambiado después del primer envío.' }, { asunto: 'Otro asunto' }, { versionExpediente: 9 },
    { autorId: 'another-admin' }, { tipo: 'PRONUNCIAMIENTO' }, { respondeAId: 'other-thread' },
    { plazoRespuestaAt: new Date('2030-01-01T12:00:00Z') }, { parte: 'INSPECCIONADO' },
  ])('rejects reuse of a command identifier with different immutable data: %j', async changed => {
    mocks.existingExchange.mockResolvedValue(committed(retryBody, changed));
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(res.json).not.toHaveBeenCalled(); expect(mocks.persist).not.toHaveBeenCalled();
  });

  it.each(['changed-bytes', 'changed-name', 'missing-file', 'extra-file'])('rejects a replay with %s', async change => {
    const file = { size: 8, originalname: 'original.pdf', buffer: Buffer.from('%PDF-old') };
    mocks.existingExchange.mockResolvedValue(committed(retryBody, { adjuntos: [{ nombreOriginal: file.originalname, bytes: 8,
      sha256: createHash('sha256').update(file.buffer).digest('hex'), anuladaAt: null }] }));
    const files = change === 'missing-file' ? [] : [{ ...file, ...(change === 'changed-name' ? { originalname: 'another.pdf' } : {}), ...(change === 'changed-bytes' ? { buffer: Buffer.from('%PDF-new') } : {}) }];
    if (change === 'extra-file') files.push(file);
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody, files } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(res.json).not.toHaveBeenCalled();
  });

  it('recognizes a concurrent commit under the row lock and removes only its unused temporary files', async () => {
    const file = { size: 8, originalname: 'original.pdf', buffer: Buffer.from('%PDF-old') };
    mocks.lockedInspection.mockResolvedValue({ ...actorInspection, version: 8 });
    mocks.lockedReplay.mockResolvedValue(committed(retryBody, { adjuntos: [{ nombreOriginal: file.originalname, bytes: 8,
      sha256: createHash('sha256').update(file.buffer).digest('hex'), anuladaAt: null }] }));
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody, files: [file] } as any, res as any, next);
    expect(next).not.toHaveBeenCalled(); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'already-committed' }) }));
    expect(mocks.createExchange).not.toHaveBeenCalled(); expect(mocks.notices).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith('inspecciones/inspection-1/decision.pdf');
  });

  it('does not expose a replay after the participant assignment changes while waiting for the lock', async () => {
    mocks.lockedInspection.mockResolvedValue({ ...actorInspection, generadorId: 'other-generator' });
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: actorUser(), body: { ...retryBody, tipo: 'DESCARGO', respondeAId: 'request-1' } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.createExchange).not.toHaveBeenCalled(); expect(mocks.lockedReplay).not.toHaveBeenCalled();
  });

  it('preserves attachments if a transaction failure leaves commit outcome unknown', async () => {
    mocks.transaction.mockRejectedValue(new Error('connection lost after COMMIT'));
    mocks.persistedEvidence.mockResolvedValue([{ storageKey: 'inspecciones/inspection-1/decision.pdf' }]);
    const next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody,
      files: [{ size: 8, originalname: 'original.pdf', buffer: Buffer.from('%PDF-old') }] } as any, response() as any, next);
    expect(next).toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('does not expose an inspection directory to the inspected actor', async () => {
    const res = response(), next = vi.fn();
    await listarParticipacionInspeccionado({user:actorUser()} as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));
    expect(mocks.inspections).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('keeps an annulled original attachment in replay comparison without returning it as downloadable', async () => {
    const file = { size: 8, originalname: 'original.pdf', buffer: Buffer.from('%PDF-old') };
    mocks.existingExchange.mockResolvedValue(committed(retryBody, { adjuntos: [{ nombreOriginal: file.originalname, bytes: 8,
      sha256: createHash('sha256').update(file.buffer).digest('hex'), anuladaAt: new Date() }] }));
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody, files: [file] } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ adjuntos: [] }) }));
    expect(mocks.existingExchange.mock.calls[0][0].include.adjuntos.where).toBeUndefined();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it.each(['CERRADA_CONFORME', 'DERIVADA_LEGALES'])('recovers a concurrently committed %s decision before checking the old version', async decision => {
    const fundamento = 'Fundamento artificial de una decisión que ya quedó guardada.';
    const legal = decision === 'DERIVADA_LEGALES';
    mocks.lockedInspection.mockResolvedValue({ ...actorInspection, estado: decision, version: 8 });
    mocks.lockedReplay.mockResolvedValue(committed(retryBody, { tipo: legal ? 'DERIVACION_LEGALES' : 'CIERRE_CONFORME',
      asunto: legal ? 'Derivación del expediente a Legales' : 'Cierre conforme del intercambio', cuerpo: fundamento }));
    // Transactional event lookup must verify the original structured decision as well.
    mocks.createEvent.mockClear();
    mocks.publicResult.mockResolvedValue({ detalle: fundamento, metadata: { expedienteLegal: null } });
    const res = response(), next = vi.fn();
    await decidirIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: retryBody.clienteId, decision, fundamento,
    } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled(); expect(res.json).toHaveBeenCalled();
    expect(mocks.createExchange).not.toHaveBeenCalled(); expect(mocks.createEvent).not.toHaveBeenCalled(); expect(mocks.notices).not.toHaveBeenCalled();
  });

  it('does not treat the same rendered decision text as the same structured legal reference', async () => {
    const fundamento = 'Fundamento artificial suficiente para cerrar el intercambio.';
    mocks.existingExchange.mockResolvedValue(committed(retryBody, { tipo: 'DERIVACION_LEGALES', asunto: 'Derivación del expediente a Legales', cuerpo: fundamento + '\n\nExpediente legal: QA-123' }));
    mocks.publicResult.mockResolvedValue({ detalle: fundamento, metadata: { expedienteLegal: 'QA-123' } });
    const res = response(), next = vi.fn();
    await decidirIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: retryBody.clienteId, decision: 'DERIVADA_LEGALES', fundamento: fundamento + '\n\nExpediente legal: QA-123',
    } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(res.json).not.toHaveBeenCalled();
  });

  it('does not run evidence cleanup after handing a complete transaction to COMMIT', async () => {
    const runTransaction = mocks.transaction.getMockImplementation()!;
    mocks.transaction.mockImplementationOnce(async callback => { await runTransaction(callback); throw new Error('COMMIT reply lost'); });
    const next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: actorInspection.id }, user: { id: 'admin', rol: 'ADMIN' }, body: retryBody,
      files: [{ size: 8, originalname: 'original.pdf', buffer: Buffer.from('%PDF-old') }] } as any, response() as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'COMMIT reply lost' }));
    expect(mocks.persistedEvidence).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each([['TRANSPORTISTA', 'transportista', 'transportistaId'], ['OPERADOR', 'operador', 'operadorId'], ['GENERADOR', 'generador', 'generadorId']])('scopes %s independently of requested filters and hides internal drafts', async (rol, relation, field) => {
    const next = vi.fn();
    await listarParticipacionInspeccionado({ user: { id: 'owner', rol, [relation]: { id: 'own' } },
      query: { actorId: 'other', estado: 'BORRADOR' } } as any, response() as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403}));
    expect(mocks.inspections).not.toHaveBeenCalled();
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
    expect(JSON.parse(mocks.notices.mock.calls[0][0].data[0].datos)).toMatchObject({ intercambioId: 'exchange-decision', evento: 'DERIVACION_LEGALES', destino: 'participacion', correoVersion: 1 });
  });

  it.each(['presentation', 'decision'])('does not duplicate bell notices on an idempotent %s retry', async operation => {
    const fundamento = 'Se revisó toda la documentación y se dispone el cierre conforme.';
    mocks.existingExchange.mockResolvedValue(committed(retryBody, operation === 'decision' ? { tipo: 'CIERRE_CONFORME', asunto: 'Cierre conforme del intercambio', cuerpo: fundamento } : {}));
    mocks.publicResult.mockResolvedValue({ detalle: fundamento, metadata: { expedienteLegal: null } });
    const res = response(), next = vi.fn();
    const handler = operation === 'decision' ? decidirIntercambioInspeccion : presentarIntercambioInspeccion;
    await handler({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: 'retry_12345678', tipo: 'REQUERIMIENTO', asunto: 'Pedido documentado', cuerpo: 'Constancia artificial solicitada para revisión.',
      decision: 'CERRADA_CONFORME', fundamento: 'Se revisó toda la documentación y se dispone el cierre conforme.',
    } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'already-committed' }) }));
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
  it('confirms a new past-deadline request was not applied under the row lock', async () => {
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: 'new_expired_1234', tipo: 'REQUERIMIENTO', asunto: 'Pedido nuevo con fecha pasada',
      cuerpo: 'Una nueva presentación no puede registrar ahora un plazo ya vencido.', plazoRespuestaAt: '2020-01-01T12:00:00Z',
    } } as any, res as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks.persist).not.toHaveBeenCalled(); expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'INSPECTION_COMMAND_NOT_APPLIED' }));
  });

  it.each([-1, 0, 1])('marks the response late only after the exact timestamp (%s ms)', async offset => {
    const due = new Date('2026-10-20T15:00:00Z');
    vi.useFakeTimers(); vi.setSystemTime(new Date(due.getTime() + offset));
    try {
      mocks.lockedInspection.mockResolvedValue({ ...actorInspection, estado: 'EN_DESCARGO', plazoRespuestaAt: null });
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
    mocks.existingExchange.mockResolvedValue(committed(retryBody, { id: 'expired-committed-request', asunto: 'Pedido ya registrado',
      cuerpo: 'Reintento artificial del mismo pedido ya guardado, sin alterar el plazo.', plazoRespuestaAt: new Date('2020-01-01T12:00:00Z') }));
    const res = response(), next = vi.fn();
    await presentarIntercambioInspeccion({ params: { id: 'inspection-1' }, user: { id: 'admin', rol: 'ADMIN' }, body: {
      version: 7, clienteId: 'retry_expired_1234', tipo: 'REQUERIMIENTO', asunto: 'Pedido ya registrado',
      cuerpo: 'Reintento artificial del mismo pedido ya guardado, sin alterar el plazo.', plazoRespuestaAt: '2020-01-01T12:00:00Z',
    } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'expired-committed-request' }) }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('follows the same reply thread to its original request, without using another thread deadline', async () => {
    mocks.lockedInspection.mockResolvedValue({ ...actorInspection, estado: 'EN_DESCARGO', plazoRespuestaAt: new Date('2030-01-01T12:00:00Z') });
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
    mocks.lockedInspection.mockResolvedValue({ ...actorInspection, estado: 'EN_DESCARGO', plazoRespuestaAt: new Date(active) });
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

  it('returns only the explicitly public final-state summary of the authorized inspection', async () => {
    mocks.inspection.mockResolvedValue({ ...actorInspection, estado: 'FINALIZADA' });
    const result = { id: 'public-final', detalle: 'Resultado público QA, sin afirmar firmeza.', createdAt: new Date() };
    mocks.publicResult.mockResolvedValue(result);
    const res = response(), next = vi.fn();
    await obtenerIntercambiosInspeccion({ params: { id: actorInspection.id }, user: actorUser() } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.publicResult).toHaveBeenCalledWith({
      where: { inspeccionId: actorInspection.id, tipo: 'CAMBIO_ESTADO', estadoHasta: 'FINALIZADA', visibleActor: true },
      select: { id: true, detalle: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(res.json.mock.calls[0][0].data.resultadoAdministrativo).toEqual(result);
  });

  it.each(['DERIVADA_LEGALES', 'EN_TRAMITE_LEGAL', 'DERIVADA_ATM'])('does not retrieve or disclose internal progress for %s', async estado => {
    mocks.inspection.mockResolvedValue({ ...actorInspection, estado });
    mocks.publicResult.mockResolvedValue({ detalle: 'PRIVATE QA NOTE' });
    const res = response(), next = vi.fn();
    await obtenerIntercambiosInspeccion({ params: { id: actorInspection.id }, user: actorUser() } as any, res as any, next);
    expect(next).not.toHaveBeenCalled(); expect(mocks.publicResult).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.resultadoAdministrativo).toBeNull();
  });

  it('checks entity access before reading a public finalization summary', async () => {
    mocks.inspection.mockResolvedValue({ ...actorInspection, estado: 'FINALIZADA' });
    const next = vi.fn(), res = response();
    await obtenerIntercambiosInspeccion({ params: { id: actorInspection.id }, user: actorUser('another-generator') } as any, res as any, next);
    expect(next).toHaveBeenCalledOnce(); expect(res.json).not.toHaveBeenCalled();
    expect(mocks.publicResult).not.toHaveBeenCalled(); expect(mocks.markViewed).not.toHaveBeenCalled();
  });

});
