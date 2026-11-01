import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ post: vi.fn(), session: vi.fn(), current: vi.fn(), uuid: vi.fn() }));
vi.mock('../../services/api', () => ({ api: { post: mock.post } }));
vi.mock('../../services/gpsQueue', () => ({ newGpsPointId: mock.uuid }));
vi.mock('../../utils/supportSession', () => ({ supportRequestContext: mock.current, supportSessionMatches: mock.session }));
import { incidentCommandKey, readIncidentCommand, retryIncidentCommand, submitIncidentCommand } from '../../services/incidentCommand';

const context = { userId: 'u', owner: 'transport', requestContext: 'session' };
const body = { tipo: 'averia', descripcion: 'Rueda dañada', latitud: -32, longitud: -68 };
const reference = 'c8256c28-2e6a-4fd0-9127-777a7db7af3e';
const answer = (repetido: boolean) => ({ data: { success: true, data: { idempotencia: { version: 1, referencia: reference, repetido },
  evento: { id: 'event', manifiestoId: 'm', tipo: 'INCIDENTE', usuarioId: 'u', descripcion: 'INCIDENTE: averia. Rueda dañada', latitud: -32, longitud: -68 } } } });

describe('incident command recovery', () => {
  let locked: boolean;
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); locked = false;
    mock.session.mockReturnValue(true); mock.current.mockReturnValue('session'); mock.uuid.mockReturnValue(reference);
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (_: string, __: unknown, task: (lock: object | null) => Promise<unknown>) => {
      if (locked) return task(null);
      locked = true;
      try { return await task({ name: 'incident' }); } finally { locked = false; }
    } } });
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('persists the exact request before dispatch and retries with the same reference', async () => {
    mock.post.mockImplementationOnce(async () => { expect(readIncidentCommand('m', context)?.referencia).toBe(reference); throw new Error('response lost'); });
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('Comprobar envío');
    expect(readIncidentCommand('m', context)?.body).toEqual(body);
    mock.post.mockResolvedValueOnce(answer(true));
    const result = await retryIncidentCommand('m', context);
    expect(result).toEqual({ body, cleaned: true, repeated: true });
    expect(mock.post).toHaveBeenCalledTimes(2);
    expect(mock.post.mock.calls[0]).toEqual(mock.post.mock.calls[1]);
    expect(readIncidentCommand('m', context)).toBeNull();
  });

  it('refuses a different action while a previous command is uncertain', async () => {
    mock.post.mockRejectedValueOnce(new Error('offline'));
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('Comprobar envío');
    await expect(submitIncidentCommand('m', context, { tipo: 'PAUSA', descripcion: 'Pausa' })).rejects.toThrow('Hay un envío sin confirmar');
    expect(mock.post).toHaveBeenCalledTimes(1); expect(readIncidentCommand('m', context)?.body).toEqual(body);
  });

  it('keeps the command when the server confirmation is not verifiable', async () => {
    mock.post.mockResolvedValueOnce({ data: { success: true, data: { evento: { id: 'event' } } } });
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('confirmación verificable');
    expect(readIncidentCommand('m', context)?.referencia).toBe(reference);
  });

  it('does not send if storage is corrupt, unwritable or the browser cannot coordinate windows', async () => {
    const key = incidentCommandKey('m', context);
    localStorage.setItem(key, '');
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('no se puede leer');
    localStorage.removeItem(key);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('No se pudo guardar');
    set.mockRestore();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('no puede proteger');
    expect(mock.post).not.toHaveBeenCalled();
  });

  it('retains the original command if the account changes before a response', async () => {
    mock.post.mockImplementationOnce(async () => { mock.current.mockReturnValue('other'); return answer(false); });
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('cuenta o actividad cambió');
    expect(readIncidentCommand('m', context)?.referencia).toBe(reference);
    await expect(retryIncidentCommand('m', context)).rejects.toThrow('cuenta o actividad cambió');
    expect(mock.post).toHaveBeenCalledTimes(1);
  });

  it('prevents concurrent submissions in two windows', async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    mock.post.mockImplementationOnce(async () => { await wait; return answer(false); });
    const first = submitIncidentCommand('m', context, body);
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow('Otra ventana');
    release(); await expect(first).resolves.toMatchObject({ cleaned: true });
    expect(mock.post).toHaveBeenCalledTimes(1);
  });

  it('retains a confirmed receipt if local cleanup fails and can verify it again', async () => {
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage'); });
    mock.post.mockResolvedValueOnce(answer(false));
    await expect(submitIncidentCommand('m', context, body)).resolves.toMatchObject({ cleaned: false });
    expect(readIncidentCommand('m', context)?.referencia).toBe(reference);
    remove.mockRestore(); mock.post.mockResolvedValueOnce(answer(true));
    await expect(retryIncidentCommand('m', context)).resolves.toMatchObject({ cleaned: true, repeated: true });
  });

  it('isolates stored commands by account, activity and manifest', async () => {
    mock.post.mockRejectedValueOnce(new Error('offline'));
    await expect(submitIncidentCommand('m', context, body)).rejects.toThrow();
    expect(readIncidentCommand('other-manifest', context)).toBeNull();
    expect(readIncidentCommand('m', { ...context, owner: 'other-activity' })).toBeNull();
    expect(readIncidentCommand('m', { ...context, userId: 'another' })).toBeNull();
  });
});
