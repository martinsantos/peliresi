import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn() }));
vi.mock('../lib/prisma', () => ({ default: {
  manifiesto: mock, $transaction: async (fn: any) => typeof fn === 'function' ? fn({ manifiesto: mock }) : Promise.all(fn),
} }));
import { getTrainingTasks } from '../controllers/manifest-proposal.controller';
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('MANIFEST_PROPOSALS_ENABLED', 'true'); vi.stubEnv('MANIFEST_CERTIFICATES_ENABLED', 'true');
  mock.count.mockResolvedValue(121); mock.findMany.mockResolvedValue([]);
});
async function query(params = {}, rol = 'OPERADOR') {
  const json = vi.fn(), next = vi.fn();
  await getTrainingTasks({ query: params, user: { id: 'owner', rol, operador: { id: 'o' }, generador: { id: 'g' }, transportista: { id: 't' } } } as any, { json } as any, next);
  return { json, next };
}
it('paginates beyond the first hundred and counts the complete scoped result', async () => {
  const { json, next } = await query({ page: '21', limit: '6' });
  expect(next).not.toHaveBeenCalled();
  expect(mock.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 120, take: 6 }));
  expect(json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total: 121, page: 21 }) }));
});
it.each(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'])('searches all pages without removing %s ownership', async rol => {
  await query({ search: 'OLDER-121', filter: 'certificates' }, rol);
  const where = JSON.stringify(mock.findMany.mock.calls[0]?.[0].where);
  expect(where).toContain('OLDER-121'); expect(where).toContain(rol.toLowerCase() + 'Id');
  expect(where).toContain('TRATADO'); expect(where).toContain('certificados'); expect(where).toContain('FINAL'); expect(where).toContain('CERTIFICACION_OPERADOR_V1');
});
it('rejects malformed pagination rather than silently losing tasks', async () => {
  const { next } = await query({ page: '0' });
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mock.findMany).not.toHaveBeenCalled();
});
it.each(['GENERADOR', 'OPERADOR'])('keeps an in-situ draft visible and explains the missing signature to %s', async rol => {
  mock.findMany.mockResolvedValue([{
    id: 'draft', numero: 'QA-IN-SITU', estado: 'BORRADOR', modalidad: 'IN_SITU',
    generador: { razonSocial: 'Generador artificial' }, transportista: null,
    operador: { razonSocial: 'Operador artificial' }, eventos: [], residuos: [],
  }]);
  const { json, next } = await query({ filter: 'drafts' }, rol);
  expect(next).not.toHaveBeenCalled();
  const args = mock.findMany.mock.calls[0][0];
  expect(JSON.stringify(args.where)).toContain(rol.toLowerCase() + 'Id');
  expect(JSON.stringify(args.where)).toContain('BORRADOR');
  expect(json.mock.calls[0][0].data.items[0]).toMatchObject({
    estado: 'BORRADOR', partes: null, requiereMiAprobacion: false,
    action: 'Firma del generador pendiente',
    detail: expect.stringContaining('sin transporte'),
    actores: { generador: 'Generador artificial', transportista: null, operador: 'Operador artificial' },
  });
});
it('lets administration review pending parties without impersonating a missing approval', async () => {
  const { next } = await query({ filter: 'waiting' }, 'ADMIN');
  expect(next).not.toHaveBeenCalled();
  const where = mock.findMany.mock.calls[0][0].where;
  expect(where.AND[1]).toEqual({ estado: 'PENDIENTE_APROBACION', NOT: { id: { in: [] } } });
});
it('keeps Mendoza day boundaries and deterministic order in the server query', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T01:30:00Z'));
  try { await query({ period: 'today' });
    const args = mock.findMany.mock.calls[0][0];
    expect(JSON.stringify(args.where)).toContain('2026-10-19T03:00:00.000Z');
    expect(JSON.stringify(args.where)).toContain('2026-10-20T03:00:00.000Z');
    expect(args.orderBy).toContainEqual({ id: 'desc' });
  } finally { vi.useRealTimers(); }
});
