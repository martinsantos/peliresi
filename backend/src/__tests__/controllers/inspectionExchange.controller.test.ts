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
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: mocks.inspection, findMany: mocks.inspections },
  intercambioInspeccion: { findMany: mocks.exchanges, findFirst: mocks.existingExchange, findUniqueOrThrow: mocks.finalExchange },
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

  it('shows the formal timeline to the inspected actor linked to the case', async () => {
    const res = response();
    const next = vi.fn();
    await obtenerIntercambiosInspeccion({ params: { id: 'inspection-1' }, user: actorUser() } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.exchanges).toHaveBeenCalledWith(expect.objectContaining({ where: { inspeccionId: 'inspection-1' } }));
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
  });
});
