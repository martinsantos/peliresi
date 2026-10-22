import { beforeEach, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ registroManifiestoExcepcional: { findMany: vi.fn(), count: vi.fn() }, $transaction: vi.fn(), $queryRaw: vi.fn() }));
vi.mock('../lib/prisma', () => ({ default: db }));
import { listExceptional } from '../controllers/manifiesto-excepcional.controller';
const user = { id: 'actor', rol: 'OPERADOR', activo: true, operador: { id: 'plant' } };
beforeEach(() => { vi.clearAllMocks(); db.registroManifiestoExcepcional.count.mockResolvedValue(43); db.registroManifiestoExcepcional.findMany.mockResolvedValue([]); db.$transaction.mockImplementation(fn => fn(db)); db.$queryRaw.mockImplementation(query => Promise.resolve(query.sql.includes("COUNT(*)") ? [{ total: 43 }] : [])); });
async function invoke(query: Record<string, unknown>, actor = user) {
  const json = vi.fn(), next = vi.fn();
  await listExceptional({ query, user: actor } as never, { json } as never, next);
  return { json, next };
}
it('searches across pages and combines stage with the authorized actor scope', async () => {
  const { json, next } = await invoke({ search: '  QA Cooperativa  ', etapa: 'RECIBIDO', page: '2' });
  expect(next).not.toHaveBeenCalled();
  const where = db.registroManifiestoExcepcional.findMany.mock.calls[0][0].where;
  expect(where.AND).toContainEqual({ OR: [{ creadoPorId: 'actor' }, { operadorId: 'plant' }] });
  const sql = db.$queryRaw.mock.calls[0][0];
  expect(sql.values).toEqual(expect.arrayContaining(['actor', 'plant', 'RECIBIDO', '%QA Cooperativa%']));
  expect(sql.sql).toContain('ILIKE');
  expect(db.$queryRaw.mock.calls[1][0].values.slice(0, -1)).toEqual(sql.values);
  expect(json).toHaveBeenCalledWith({ success: true, data: { registros: [], total: 43, page: 2, pageSize: 20 } });
});
it('clamps a page after another user changes the result set, retaining a deterministic order', async () => {
  await invoke({ page: '999' });
  expect(db.$queryRaw.mock.calls[1][0].values.at(-1)).toBe(40);
  expect(db.registroManifiestoExcepcional.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }));
});
it('accepts the complete BI reference in search without converting it to an official number', async () => {
  await invoke({ search: 'BI-00000000-0000-4000-8000-000000000001' });
  expect(db.$queryRaw.mock.calls[0][0].values).toContain('%BI-00000000-0000-4000-8000-000000000001%');
});
it.each([{ page: ['1'] }, { page: '0' }, { page: '1.5' }, { page: 'NaN' }, { page: '100001' }, { search: ['a'] }, { search: 'a'.repeat(101) }, { etapa: 'APROBADO' }, { etapa: ['RECIBIDO'] }])('rejects malformed filters before reading records: %j', async query => {
  const { next } = await invoke(query); expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  expect(db.registroManifiestoExcepcional.findMany).not.toHaveBeenCalled();
});
it('search never grants a sector administrator eventual access', async () => {
  const { next } = await invoke({ search: 'QA' }, { ...user, rol: 'ADMIN_OPERADOR' });
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(db.registroManifiestoExcepcional.count).not.toHaveBeenCalled();
});

it('escapes SQL wildcards and keeps the search value out of executable SQL', async () => {
  await invoke({ search: "100%_QA'" });
  const query = db.$queryRaw.mock.calls[0][0];
  expect(query.sql).not.toContain("QA'");
  expect(query.values).toContain("%100\\%\\_QA'%");
});
it.each([['GENERADOR', 'generador'], ['TRANSPORTISTA', 'transportista']] as const)('retains %s scope in both paginated SQL and the final authorized read', async (rol, slot) => {
  await invoke({ search: 'QA' }, { id: 'account', rol, activo: true, [slot]: { id: 'linked' } } as never);
  const query = db.$queryRaw.mock.calls[0][0];
  expect(query.values).toEqual(expect.arrayContaining(['account', 'linked']));
  expect(query.sql).toContain("datos->'" + slot + "'->>'padronId'");
});
