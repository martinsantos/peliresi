import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn(), findReceipt: vi.fn(), createReceipt: vi.fn(),
  findManifest: vi.fn(), updateManifest: vi.fn(), createEvent: vi.fn(), findEvent: vi.fn(), closeLegs: vi.fn(), hash: vi.fn(), emit: vi.fn(), invalidate: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: mock.transaction } }));
vi.mock('../../services/manifestIntegrity.service', () => ({ updateRollingHash: mock.hash }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: mock.emit } }));
vi.mock('../../controllers/manifiesto-gps.controller', () => ({ invalidateGpsCache: mock.invalidate }));
import { confirmarEntregaIdempotente } from '../../controllers/manifiesto-delivery.controller';

const referencia = 'c8256c28-2e6a-4fd0-9127-777a7db7af3e';
const payload = { referencia, latitud: -32.88, longitud: -68.84, observaciones: 'Entrega artificial' };
const initial = { id: 'qa-delivery', numero: 'QA-DELIVERY', estado: 'EN_TRANSITO', modalidad: 'FIJO', fechaEntrega: null as Date | null,
  generadorId: 'g', transportistaId: 't', operadorId: 'o', contextoEmpresa: null, isDemoData: true, observaciones: null };
let manifest: typeof initial;
const req = (body: unknown = payload, user: Record<string, unknown> = {}) => ({ params: { id: initial.id }, body,
  user: { id: 'carrier-user', rol: 'TRANSPORTISTA', transportista: { id: 't' }, ...user } }) as any;
const res = () => ({ json: vi.fn() }) as any;

describe('delivery receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks(); manifest = { ...initial };
    const receipts = new Map<string, any>();
    mock.query.mockImplementation(async () => [{ ...manifest }]);
    mock.findReceipt.mockImplementation(async ({ where }: any) => receipts.get(where.id) ?? null);
    mock.createReceipt.mockImplementation(async ({ data }: any) => { receipts.set(data.id, data); return data; });
    mock.updateManifest.mockImplementation(async ({ data }: any) => { manifest = { ...manifest, ...data }; return { ...manifest }; });
    mock.findManifest.mockImplementation(async () => ({ ...manifest }));
    mock.createEvent.mockResolvedValue({ id: 'event-1' });
    mock.findEvent.mockResolvedValue({manifiestoId:'qa-delivery',tipo:'ENTREGA',usuarioId:'carrier-user',descripcion:'Entrega artificial',latitud:-32.88,longitud:-68.84});
    mock.closeLegs.mockResolvedValue({ count: 0 });
    mock.hash.mockResolvedValue(undefined);
    mock.transaction.mockImplementation(async fn => fn({ $queryRaw: mock.query, auditoria: { findUnique: mock.findReceipt, create: mock.createReceipt },
      manifiesto: { update: mock.updateManifest, findUnique: mock.findManifest }, eventoManifiesto: { create: mock.createEvent, findUnique: mock.findEvent }, tramoTransporte: { updateMany: mock.closeLegs } }));
  });

  it('acknowledges a retry after a lost response without delivering or emitting twice', async () => {
    const first = res(), retry = res(), next = vi.fn();
    await confirmarEntregaIdempotente(req(), first, next); await confirmarEntregaIdempotente(req(), retry, next);
    expect(next).not.toHaveBeenCalled(); expect(mock.updateManifest).toHaveBeenCalledTimes(1);
    expect(mock.createEvent).toHaveBeenCalledTimes(1); expect(mock.createReceipt).toHaveBeenCalledTimes(1);
    expect(mock.hash).toHaveBeenCalledTimes(1); expect(mock.closeLegs).toHaveBeenCalledTimes(1); expect(mock.emit).toHaveBeenCalledTimes(1);
    expect(first.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, referencia, repetido: false });
    expect(retry.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, referencia, repetido: true });
  });

  it('acknowledges the original delivery after later authorized processing', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn()); manifest.estado = 'RECIBIDO';
    const retry = res(), next = vi.fn(); await confirmarEntregaIdempotente(req(), retry, next);
    expect(next).not.toHaveBeenCalled(); expect(retry.json.mock.calls[0][0].data.manifiesto.estado).toBe('RECIBIDO');
    expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('does not use an old receipt to deliver a trip after a reversal', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn()); manifest.estado = 'EN_TRANSITO'; manifest.fechaEntrega = null;
    const next = vi.fn(); await confirmarEntregaIdempotente(req(), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(mock.updateManifest).toHaveBeenCalledTimes(1);
  });

  it('does not acknowledge a stale receipt if transit retains an inconsistent delivery timestamp', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn()); manifest.estado = 'EN_TRANSITO';
    const next = vi.fn(); await confirmarEntregaIdempotente(req(), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(mock.updateManifest).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed payload for the same reference', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn());
    const next = vi.fn(); await confirmarEntregaIdempotente(req({ ...payload, latitud: -33 }), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('fails closed if the saved receipt is damaged', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn());
    mock.findReceipt.mockResolvedValueOnce({usuarioId:'carrier-user',manifiestoId:'qa-delivery',modulo:'MANIFIESTOS',accion:'CONFIRMAR_ENTREGA_V1',datosDespues:'not-json'});
    const next=vi.fn();await confirmarEntregaIdempotente(req(),res(),next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('does not confirm a receipt whose underlying delivery event is missing', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn());mock.findEvent.mockResolvedValueOnce(null);
    const next=vi.fn();await confirmarEntregaIdempotente(req(),res(),next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409}));expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('checks access again before consulting an earlier receipt', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn()); mock.findReceipt.mockClear(); manifest.transportistaId = 'other';
    const next = vi.fn(); await confirmarEntregaIdempotente(req(), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 })); expect(mock.findReceipt).not.toHaveBeenCalled();
  });

  it('does not treat another account with the same reference as the original command', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn());
    const next = vi.fn(); await confirmarEntregaIdempotente(req(payload, { id: 'other-user' }), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('does not authorize a different enterprise context to replay the same reference', async () => {
    await confirmarEntregaIdempotente(req(), res(), vi.fn());
    const next = vi.fn(); await confirmarEntregaIdempotente(req(payload, { empresaContexto: { empresaId: 'other', actividadId: 'a', todasSedes: true } }), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects in-situ delivery, missing references and partial coordinates', async () => {
    for (const bad of [{ ...payload, referencia: 'invalid' }, { ...payload, longitud: undefined }]) {
      const next = vi.fn(); await confirmarEntregaIdempotente(req(bad), res(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    }
    manifest.modalidad = 'IN_SITU'; const next = vi.fn(); await confirmarEntregaIdempotente(req(), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mock.createEvent).not.toHaveBeenCalled();
  });
});
