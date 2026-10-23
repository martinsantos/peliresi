import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, setTokens, getAccessToken } from '../../services/api';
import { toast } from '../../components/ui/Toast';
import { getApiErrorMessage } from '../../utils/api-error';
import { rateLimitMessage } from '../../utils/rateLimitMessage';
vi.mock('../../services/sessionCheckpoint', () => ({ readSessionCheckpoint: vi.fn(), writeSessionCheckpoint: vi.fn().mockResolvedValue(undefined) }));

beforeEach(() => { localStorage.clear(); setTokens('qa-user', 'qa-refresh'); });
afterEach(() => vi.restoreAllMocks());

it('explains Retry-After without replaying a write or clearing its session', async () => {
  const notify = vi.spyOn(toast, 'warning').mockReturnValue('qa-notice');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    throw new AxiosError('Rate limited', 'ERR_BAD_REQUEST', config, undefined,
      { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '12' }, data: { message: 'Demasiadas solicitudes' }, config });
  });
  const draft = { motivo: 'La cantidad observada difiere', cantidad: 25 };
  const error = await api.post('/manifiestos/qa/adendas', draft, { adapter }).catch(e => e);
  expect(adapter).toHaveBeenCalledOnce();
  expect(getAccessToken()).toBe('qa-user');
  expect(draft).toEqual({ motivo: 'La cantidad observada difiere', cantidad: 25 });
  expect(notify).toHaveBeenCalledWith('Esperá un momento', 'Podés reintentar en 12 segundos. No hace falta recargar la página.');
  expect(getApiErrorMessage(error, 'Error')).toBe('Demasiadas solicitudes. Podés reintentar en 12 segundos. No hace falta recargar la página.');
});

it('allows an explicit retry to complete once after a temporary rejection', async () => {
  vi.spyOn(toast, 'warning').mockReturnValue('qa-notice');
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
    if (adapter.mock.calls.length === 1) throw new AxiosError('Rate limited', 'ERR_BAD_REQUEST', config, undefined,
      { status: 429, statusText: '', headers: { 'retry-after': '1' }, data: {}, config });
    return { status: 200, statusText: 'OK', headers: {}, data: { saved: true }, config };
  });
  await expect(api.post('/qa', { nota: 'Conservar' }, { adapter })).rejects.toHaveProperty('response.status', 429);
  expect((await api.post('/qa', { nota: 'Conservar' }, { adapter })).data.saved).toBe(true);
  expect(adapter).toHaveBeenCalledTimes(2);
  expect(adapter.mock.calls[0][0].data).toBe(adapter.mock.calls[1][0].data);
});

it('accepts Retry-After as an HTTP date', () => {
  expect(rateLimitMessage({ 'retry-after': 'Fri, 23 Oct 2026 18:00:30 GMT' }, Date.parse('2026-10-23T18:00:00Z')))
    .toContain('en 30 segundos');
});

it.each([undefined, '', '-3', 'invalid', '999999999999999999999', []])('uses an actionable fallback for malformed Retry-After %s', value => {
  expect(rateLimitMessage({ 'retry-after': value })).toBe('Podés reintentar en un momento. No hace falta recargar la página.');
});

it.each(['0', '1', 1])('does not tell the user to wait zero seconds', value => {
  expect(rateLimitMessage({ 'retry-after': value })).toContain('en 1 segundo.');
});
