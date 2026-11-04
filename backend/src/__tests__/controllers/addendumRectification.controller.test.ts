import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    adendaManifiesto: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    db: {
      manifiesto: { findUnique: vi.fn() },
      adendaManifiesto: { findMany: vi.fn() },
      usuario: { findMany: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});
vi.mock('../../lib/prisma', () => ({ default: mocks.db }));
vi.mock('../../utils/roleFilter', () => ({ canAccessManifiesto: () => true }));
vi.mock('../../domain/addendumAuthority', () => ({ canReviewAsAddendumAuthority: () => true }));
vi.mock('../../services/trainingCertificate.service', () => ({
  hasFinalTrainingCertificate: vi.fn().mockResolvedValue(false),
  lockTrainingDocuments: vi.fn().mockResolvedValue(undefined),
  assertNoFinalTrainingCertificate: vi.fn().mockResolvedValue(undefined),
}));
import { listAddenda, reviewAddendum } from '../../controllers/manifiesto-adenda.controller';

const oldReview = { id: '00000000-0000-4000-8000-000000000001', version: 0, decision: 'OBSERVADA',
  nota: 'Revisar', autorId: 'reviewer', fecha: '2026-10-27T00:00:00Z' };
const original = { id: 'a', manifiestoId: 'm', creadoPorId: 'operator', impersonadoPorId: null,
  declaracion: {}, version: 1, rectificaId: null, revisiones: [oldReview] };
const correction = { id: 'b', manifiestoId: 'm', creadoPorId: 'operator', impersonadoPorId: null,
  declaracion: {}, version: 1, rectificaId: 'a', revisiones: [{ ...oldReview, decision: 'APROBADA' }] };
const req = { params: { id: 'm', adendaId: 'a' }, query: {}, user: { id: 'reviewer', rol: 'ADMIN' } };
const response = () => ({ json: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.manifiesto.findUnique.mockResolvedValue({ id: 'm', numero: 'QA', estado: 'TRATADO', operadorId: 'o', residuos: [] });
  mocks.db.usuario.findMany.mockResolvedValue([]);
  mocks.db.adendaManifiesto.findMany.mockImplementation((args: { select?: unknown }) =>
    Promise.resolve(args.select ? [original, correction] : [original]));
  mocks.tx.adendaManifiesto.findFirst.mockResolvedValue(original);
  mocks.tx.adendaManifiesto.findMany.mockResolvedValue([original, correction]);
  mocks.db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(mocks.tx));
});

describe('approved rectifications in the addendum API', () => {
  it('counts all pages but presents the original as an observed historical record', async () => {
    const res = response(), next = vi.fn();
    await listAddenda({ ...req, query: { adenda: 'a' } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    const data = res.json.mock.calls[0][0].data;
    expect(data.documental).toMatchObject({ total: 2, pendientes: 0, observadas: 0, rechazadas: 0, estado: 'ADENDAS_REVISADAS' });
    expect(data.adendas[0]).toMatchObject({ id: 'a', estadoRevision: 'OBSERVADA', observacionResueltaPorRectificacion: true, puedeResolver: false });
    expect(original.revisiones).toEqual([oldReview]);
  });

  it('rejects a new decision on the preserved observed original after correction approval', async () => {
    const res = response(), next = vi.fn();
    await reviewAddendum({ ...req, body: { id: '00000000-0000-4000-8000-000000000002', version: 1,
      decision: 'APROBADA', nota: 'Nueva decisión' } } as never, res as never, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409 });
    expect(mocks.tx.adendaManifiesto.updateMany).not.toHaveBeenCalled();
  });

  it('still replays an already recorded decision without altering it', async () => {
    const res = response(), next = vi.fn();
    await reviewAddendum({ ...req, body: { id: oldReview.id, version: oldReview.version,
      decision: oldReview.decision, nota: oldReview.nota } } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.json.mock.calls[0][0].data.adenda.estadoRevision).toBe('OBSERVADA');
    expect(mocks.tx.adendaManifiesto.updateMany).not.toHaveBeenCalled();
  });
});
