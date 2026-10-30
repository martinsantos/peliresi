import { beforeEach, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../services/api', () => ({ api: { get } }));
import { personalManifestAccess } from '../../services/manifestPersonalAccess';

beforeEach(() => { get.mockReset(); });
it('returns only roles authorized by the manifest API without changing the active context', async () => {
  get.mockImplementation(async (_path, config) => {
    if (config.headers['X-SITREP-Activity'] !== 'OPERADOR') throw { response: { status: 404 } };
    return { data: { data: { manifiesto: { id: 'm', operadorId: 'o' } } } };
  });
  expect(await personalManifestAccess('m', ['GENERADOR', 'OPERADOR', 'OPERADOR'])).toEqual({ accesses: [{ rol: 'OPERADOR', actorId: 'o' }], incomplete: false });
  expect(get).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenCalledWith('/manifiestos/m', expect.objectContaining({ headers: { 'X-SITREP-Activity': 'OPERADOR' } }));
});
it('keeps failed network checks distinct from a denied role', async () => {
  get.mockImplementation(async (_path, config) => {
    if (config.headers['X-SITREP-Activity'] === 'GENERADOR') throw { response: { status: 403 } };
    throw new Error('offline');
  });
  expect(await personalManifestAccess('m', ['GENERADOR', 'OPERADOR'])).toEqual({ accesses: [], incomplete: true });
});
it('never turns a malformed response or ID into an activity choice', async () => {
  get.mockResolvedValue({ data: { data: { manifiesto: { id: 'other', operadorId: 'o' } } } });
  expect(await personalManifestAccess('m', ['OPERADOR'])).toEqual({ accesses: [], incomplete: true });
  await expect(personalManifestAccess('../m', ['OPERADOR'])).rejects.toThrow('Manifiesto inválido');
});
