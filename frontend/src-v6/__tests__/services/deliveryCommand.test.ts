import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ enqueue: vi.fn(), queue: vi.fn(), process: vi.fn(), session: 'context-a', matches: true }));
vi.mock('../../services/indexeddb', () => ({ enqueueDeliveryOnce: mock.enqueue, getSyncQueue: mock.queue,
  processSyncQueue: mock.process, OFFLINE_QUEUE_WAKE_EVENT: 'sitrep:offline-queue-wake' }));
vi.mock('../../services/gpsQueue', () => ({ newGpsPointId: () => 'c8256c28-2e6a-4fd0-9127-777a7db7af3e', GPS_DELIVERY_CONFIRMED_EVENT: 'sitrep:gps-delivery-confirmed' }));
vi.mock('../../utils/supportSession', () => ({ supportRequestContext: () => mock.session, supportSessionMatches: () => mock.matches }));
import { submitDelivery } from '../../services/deliveryCommand';

const context = { userId: 'account-a', owner: 'transport-context', role: 'TRANSPORTISTA', companyScoped: false };
const action = { id: 12, type: 'POST', endpoint: '/manifiestos/trip/confirmar-entrega-idempotente',
  data: { referencia: 'c8256c28-2e6a-4fd0-9127-777a7db7af3e' }, userId: 'account-a', contextOwner: 'transport-context', createdAt: '2026-10-29' };
beforeEach(() => { mock.session = 'context-a'; mock.matches = true; mock.enqueue.mockReset().mockResolvedValue({ action, legacy: false });
  mock.queue.mockReset().mockResolvedValue([]); mock.process.mockReset().mockResolvedValue({}); vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true); });
afterEach(() => vi.restoreAllMocks());

it('stores the reference before processing and returns confirmation only after the queue is cleared', async () => {
  expect(await submitDelivery('trip', { observaciones: 'QA' }, context)).toEqual({ status: 'confirmed' });
  expect(mock.enqueue).toHaveBeenCalledWith(expect.objectContaining({ endpoint: action.endpoint,
    data: { referencia: action.data.referencia, observaciones: 'QA' }, contextOwner: context.owner }));
  expect(mock.enqueue.mock.invocationCallOrder[0]).toBeLessThan(mock.process.mock.invocationCallOrder[0]);
  expect(mock.process).toHaveBeenCalledWith('account-a', expect.objectContaining({ owner: context.owner }), true, expect.any(Function), 12);
});

it('retries an uncertain transport error once with the same saved queue entry', async () => {
  mock.queue.mockResolvedValueOnce([{ ...action, lastFailureUncertain: true }]).mockResolvedValueOnce([]);
  expect(await submitDelivery('trip', {}, context)).toEqual({ status: 'confirmed' });
  expect(mock.enqueue).toHaveBeenCalledOnce(); expect(mock.process).toHaveBeenCalledTimes(2);
  expect(mock.process.mock.calls.map(call => call[4])).toEqual([12, 12]);
});

it('keeps the operation pending if its response remains uncertain', async () => {
  mock.queue.mockResolvedValue([{ ...action, lastFailureUncertain: true, lastError: 'No recibimos confirmación.' }]);
  expect(await submitDelivery('trip', {}, context)).toEqual({ status: 'pending', message: 'No recibimos confirmación.' });
  expect(mock.process).toHaveBeenCalledTimes(2);
});

it('stores an offline delivery without sending it', async () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  expect(await submitDelivery('trip', {}, context)).toMatchObject({ status: 'pending', message: expect.stringMatching(/guardada.*reconectar.*misma cuenta y actividad/i) });
  expect(mock.enqueue).toHaveBeenCalledOnce(); expect(mock.process).not.toHaveBeenCalled();
});

it('does not send if durable storage fails or the session changes while saving', async () => {
  mock.enqueue.mockRejectedValueOnce(new Error('No se pudo guardar'));
  await expect(submitDelivery('trip', {}, context)).rejects.toThrow('No se pudo guardar'); expect(mock.process).not.toHaveBeenCalled();
  mock.enqueue.mockImplementationOnce(async () => { mock.session = 'context-b'; return { action, legacy: false }; });
  expect(await submitDelivery('trip', {}, context)).toMatchObject({ status: 'pending', message: expect.stringMatching(/actividad original/i) });
  expect(mock.process).not.toHaveBeenCalled();
});

it('does not silently replay an older unscoped delivery as a new referenced command', async () => {
  mock.enqueue.mockResolvedValueOnce({ action: { ...action, endpoint: '/manifiestos/trip/confirmar-entrega' }, legacy: true });
  expect(await submitDelivery('trip', {}, context)).toMatchObject({ status: 'pending', message: expect.stringMatching(/entrega anterior/i) });
  expect(mock.process).not.toHaveBeenCalled();
});

it('does not substitute a saved delivery when a later action has different data', async () => {
  mock.enqueue.mockResolvedValueOnce({ action: {...action,data:{...action.data,observaciones:'Anterior'}}, legacy:false,reused:true });
  expect(await submitDelivery('trip',{observaciones:'Nueva'},context)).toMatchObject({status:'pending',message:expect.stringMatching(/datos anteriores/i)});
  expect(mock.process).not.toHaveBeenCalled();
});
