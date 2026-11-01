import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ transaction: vi.fn(), query: vi.fn(), findReceipt: vi.fn(), createReceipt: vi.fn(),
  updateManifest: vi.fn(), createEvent: vi.fn(), findEvent: vi.fn(), hash: vi.fn(), emit: vi.fn(), notices: vi.fn(), schedule: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: mock.transaction } }));
vi.mock('../../services/manifestIntegrity.service', () => ({ updateRollingHash: mock.hash }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: mock.emit } }));
vi.mock('../../services/manifestOperationalNotice.service', () => ({ notifyManifestOperationalEvent: mock.notices }));
vi.mock('../../services/notification-dispatcher.service', () => ({ notificationService: { programarCanalesDeNotificacion: mock.schedule } }));
import { registrarIncidenteIdempotente } from '../../controllers/manifiesto-incident-command.controller';

const referencia = 'c8256c28-2e6a-4fd0-9127-777a7db7af3e';
const payload = { referencia, tipo: 'averia', descripcion: 'Avería artificial', latitud: -32.88, longitud: -68.84 };
const initial = { id: 'qa-incident', estado: 'EN_TRANSITO', generadorId: 'g', transportistaId: 't', operadorId: 'o',
  contextoEmpresa: null, isDemoData: true, observaciones: null as string | null };
let manifest: typeof initial;
const req = (body: unknown = payload, user: Record<string, unknown> = {}) => ({ params: { id: initial.id }, body,
  user: { id: 'carrier-user', rol: 'TRANSPORTISTA', transportista: { id: 't' }, ...user } }) as any;
const res = () => ({ json: vi.fn() }) as any;

describe('incident command receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks(); manifest = { ...initial };
    const receipts = new Map<string, any>(), events = new Map<string, any>();
    mock.query.mockImplementation(async () => [{ ...manifest }]);
    mock.findReceipt.mockImplementation(async ({ where }: any) => receipts.get(where.id) ?? null);
    mock.createReceipt.mockImplementation(async ({ data }: any) => { receipts.set(data.id, data); return data; });
    mock.createEvent.mockImplementation(async ({ data }: any) => { const event = { ...data, id: `event-${events.size + 1}` }; events.set(event.id, event); return event; });
    mock.findEvent.mockImplementation(async ({ where }: any) => events.get(where.id) ?? null);
    mock.updateManifest.mockImplementation(async ({ data }: any) => { manifest = { ...manifest, ...data }; return manifest; });
    mock.hash.mockResolvedValue(undefined);
    mock.notices.mockResolvedValue([{ id: 'notice-1', usuarioId: 'operator' }]);
    mock.transaction.mockImplementation(async fn => fn({ $queryRaw: mock.query,
      auditoria: { findUnique: mock.findReceipt, create: mock.createReceipt },
      manifiesto: { update: mock.updateManifest }, eventoManifiesto: { create: mock.createEvent, findUnique: mock.findEvent } }));
  });

  it('returns the same receipt after a lost response, even after the trip advances', async () => {
    const first = res(), retry = res(), next = vi.fn();
    await registrarIncidenteIdempotente(req(), first, next);
    manifest.estado = 'ENTREGADO';
    await registrarIncidenteIdempotente(req(), retry, next);
    expect(next).not.toHaveBeenCalled();
    expect(mock.createEvent).toHaveBeenCalledTimes(1); expect(mock.createReceipt).toHaveBeenCalledTimes(1);
    expect(mock.updateManifest).toHaveBeenCalledTimes(1); expect(mock.hash).toHaveBeenCalledTimes(1);
    expect(mock.notices).toHaveBeenCalledTimes(1); expect(mock.schedule).toHaveBeenCalledTimes(1); expect(mock.emit).toHaveBeenCalledTimes(1);
    expect(first.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, referencia, repetido: false });
    expect(retry.json.mock.calls[0][0].data.idempotencia).toEqual({ version: 1, referencia, repetido: true });
    expect(retry.json.mock.calls[0][0].data.evento.id).toBe(first.json.mock.calls[0][0].data.evento.id);
    expect(mock.createEvent.mock.calls[0][0].data.isDemoData).toBe(true);
  });

  it('rejects a changed payload or another account reusing the reference', async () => {
    await registrarIncidenteIdempotente(req(), res(), vi.fn());
    for (const request of [req({ ...payload, descripcion: 'Otra avería' }), req(payload, { id: 'another-user' })]) {
      const next = vi.fn(); await registrarIncidenteIdempotente(request, res(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    }
    expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('allows a genuinely distinct incident with a different reference', async () => {
    await registrarIncidenteIdempotente(req(), res(), vi.fn());
    const next = vi.fn(); await registrarIncidenteIdempotente(req({ ...payload, referencia: 'a8256c28-2e6a-4fd0-9127-777a7db7af3e' }), res(), next);
    expect(next).not.toHaveBeenCalled(); expect(mock.createEvent).toHaveBeenCalledTimes(2);
  });

  it('rechecks access before looking at a receipt', async () => {
    await registrarIncidenteIdempotente(req(), res(), vi.fn()); mock.findReceipt.mockClear(); manifest.transportistaId = 'other';
    const next = vi.fn(); await registrarIncidenteIdempotente(req(), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 })); expect(mock.findReceipt).not.toHaveBeenCalled();
  });

  it('fails closed if the saved event or receipt cannot be verified', async () => {
    await registrarIncidenteIdempotente(req(), res(), vi.fn());
    mock.findEvent.mockResolvedValueOnce(null);
    const missing = vi.fn(); await registrarIncidenteIdempotente(req(), res(), missing);
    expect(missing).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    mock.findReceipt.mockResolvedValueOnce({ usuarioId: 'carrier-user', manifiestoId: initial.id, modulo: 'MANIFIESTOS',
      accion: 'REGISTRAR_INCIDENTE_V1', datosDespues: 'invalid' });
    const corrupt = vi.fn(); await registrarIncidenteIdempotente(req(), res(), corrupt);
    expect(corrupt).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(mock.createEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed references, incomplete coordinates and new incidents after delivery', async () => {
    for (const body of [{ ...payload, referencia: 'bad' }, { ...payload, longitud: undefined }]) {
      const next = vi.fn(); await registrarIncidenteIdempotente(req(body), res(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    }
    manifest.estado = 'ENTREGADO'; const next = vi.fn(); await registrarIncidenteIdempotente(req(), res(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mock.createEvent).not.toHaveBeenCalled();
  });

  it('does not acknowledge or dispatch when the transactional notice fails', async () => {
    mock.notices.mockRejectedValueOnce(new Error('notice insert failed'));
    const response = res(), next = vi.fn(); await registrarIncidenteIdempotente(req(), response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'notice insert failed' }));
    expect(response.json).not.toHaveBeenCalled(); expect(mock.createReceipt).not.toHaveBeenCalled();
    expect(mock.emit).not.toHaveBeenCalled(); expect(mock.schedule).not.toHaveBeenCalled();
  });
});
