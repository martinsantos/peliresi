import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  tx: { adendaManifiesto: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() } },
  db: { manifiesto: { findUnique: vi.fn() }, usuario: { findMany: vi.fn() }, $transaction: vi.fn() },
  enabled: vi.fn(() => true), evaluate: vi.fn(), canGrant: vi.fn(() => false), grant: vi.fn(), notifyParties: vi.fn(async () => []), newCurrents: vi.fn(),
}));
vi.mock('../../lib/prisma', () => ({ default: m.db }));
vi.mock('../../utils/roleFilter', () => ({ canAccessManifiesto: () => true }));
vi.mock('../../domain/addendumAuthority', () => ({ canReviewAsAddendumAuthority: () => true }));
vi.mock('../../services/trainingCertificate.service', () => ({
  hasFinalTrainingCertificate: vi.fn().mockResolvedValue(false), lockTrainingDocuments: vi.fn(), assertNoFinalTrainingCertificate: vi.fn(),
}));
vi.mock('../../services/manifiestoAddendumNotice.service', () => ({ notifyAddendumParties: m.notifyParties }));
vi.mock('../../services/postFactoNotice.service', () => ({ noticeNewCurrents: m.newCurrents }));
vi.mock('../../services/generatorCurrentException.service', () => ({
  generatorExceptionsEnabled: m.enabled, evaluateGeneratorCurrents: m.evaluate, canGrantGeneratorException: m.canGrant,
  grantGeneratorException: m.grant, noticeAuthorityRequired: vi.fn(), noticeBlockedCurrents: vi.fn(),
}));
import { reviewAddendum } from '../../controllers/manifiesto-adenda.controller';

const addendum = { id: 'a', manifiestoId: 'm', creadoPorId: 'operator', impersonadoPorId: null, declaracion: {}, version: 0, rectificaId: null, revisiones: [],
  residuos: [{ corriente: 'Y8', cantidad: 10, unidad: 'kg' }, { corriente: 'Y34', cantidad: 2, unidad: 'kg' }] };
const approve = { id: '00000000-0000-4000-8000-000000000009', version: 0, nota: 'Conforme con lo recibido', decision: 'APROBADA' };
async function review(body: Record<string, unknown> = approve) {
  const next = vi.fn(), json = vi.fn();
  await reviewAddendum({ params: { id: 'm', adendaId: 'a' }, body, query: {}, user: { id: 'reviewer', rol: 'ADMIN' } } as any, { json } as any, next);
  return { next, json };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.enabled.mockReturnValue(true);
  m.canGrant.mockReturnValue(false);
  m.db.manifiesto.findUnique.mockResolvedValue({ id: 'm', numero: 'QA-1', estado: 'RECIBIDO', generadorId: 'g1', operadorId: 'o', residuos: [] });
  m.db.usuario.findMany.mockResolvedValue([]);
  m.db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(m.tx));
  m.tx.adendaManifiesto.findFirst.mockResolvedValue(addendum);
  m.tx.adendaManifiesto.updateMany.mockResolvedValue({ count: 1 });
  m.tx.adendaManifiesto.findUniqueOrThrow.mockResolvedValue({ ...addendum, version: 1, revisiones: [{ ...approve, autorId: 'reviewer' }] });
});

describe('addendum approval with a Y outside the generator ficha', () => {
  it('a counterpart cannot grant the exception', async () => {
    m.evaluate.mockResolvedValue({ decision: { estado: 'REQUIERE_EXCEPCION', corrientes: ['Y34'] } });
    const { next } = await review();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403, message: expect.stringContaining('Sólo la autoridad de aplicación') }));
    expect(m.tx.adendaManifiesto.updateMany).not.toHaveBeenCalled();
    expect(m.grant).not.toHaveBeenCalled();
  });
  it('the authority approval records the single exception in the same transaction', async () => {
    m.canGrant.mockReturnValue(true);
    m.evaluate.mockResolvedValue({ decision: { estado: 'REQUIERE_EXCEPCION', corrientes: ['Y34'] } });
    const { next } = await review();
    expect(next).not.toHaveBeenCalled();
    expect(m.evaluate).toHaveBeenCalledWith(m.tx, expect.objectContaining({ generadorId: 'g1', corrientes: ['Y8', 'Y34'], lock: true }));
    expect(m.grant).toHaveBeenCalledWith(m.tx, expect.objectContaining({ origen: 'ADENDA', origenId: 'a', corrientes: ['Y34'], motivo: approve.nota,
      detalle: expect.objectContaining({ observado: [{ corriente: 'Y34', cantidad: 2, unidad: 'kg' }] }) }));
  });
  it('with an open exception nobody can approve, not even the authority', async () => {
    m.canGrant.mockReturnValue(true);
    m.evaluate.mockResolvedValue({ decision: { estado: 'BLOQUEADA', corrientes: ['Y12'], excepcionAbierta: { id: 'e0', corrientes: ['Y34'], manifiestoId: 'm0' } } });
    const { next } = await review();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, message: expect.stringContaining('ya tiene una excepción abierta por Y34') }));
    expect(m.tx.adendaManifiesto.updateMany).not.toHaveBeenCalled();
  });
  it('authorized currents (quantity-only differences) are approved as before, without an exception', async () => {
    m.evaluate.mockResolvedValue({ decision: { estado: 'AUTORIZADAS' } });
    const { next } = await review();
    expect(next).not.toHaveBeenCalled();
    expect(m.grant).not.toHaveBeenCalled();
  });
  it('observing or rejecting is never gated', async () => {
    m.evaluate.mockResolvedValue({ decision: { estado: 'BLOQUEADA', corrientes: ['Y12'], excepcionAbierta: { id: 'e0', corrientes: ['Y34'], manifiestoId: 'm0' } } });
    const { next } = await review({ ...approve, decision: 'OBSERVADA' });
    expect(next).not.toHaveBeenCalled();
    expect(m.evaluate).not.toHaveBeenCalled();
  });
  it('with the switch off nothing is evaluated', async () => {
    m.enabled.mockReturnValue(false);
    const { next } = await review();
    expect(next).not.toHaveBeenCalled();
    expect(m.evaluate).not.toHaveBeenCalled();
  });
});
