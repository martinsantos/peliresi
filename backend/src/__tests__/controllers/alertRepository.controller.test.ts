import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ update: vi.fn(), create: vi.fn(), ruleUpdate: vi.fn(), ruleFind: vi.fn(), rules: vi.fn(), simulate: vi.fn(), evaluate: vi.fn(), list: vi.fn(), count: vi.fn(), notices: vi.fn(), noticeCount: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { alertaGenerada: { update: mocks.update, findMany: mocks.list, count: mocks.count }, reglaAlerta: { create: mocks.create, update: mocks.ruleUpdate, findUnique: mocks.ruleFind, findMany: mocks.rules }, notificacion: { findMany: mocks.notices, count: mocks.noticeCount } } }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: {} }));
vi.mock('../../services/notification-dispatcher.service', () => ({ notificationService: {} }));
vi.mock('../../jobs/seguimientoCierre.job', () => ({ simularSeguimientoCierre: mocks.simulate, ejecutarSeguimientoCierre: mocks.evaluate }));
import { resolverAlerta, crearReglaAlerta, actualizarReglaAlerta, getReglasAlerta, getAlertasGeneradas, getNotificaciones } from '../../controllers/notification.controller';
const response = () => ({ json: vi.fn(), status: vi.fn().mockReturnThis(), setHeader: vi.fn() });
beforeEach(() => vi.clearAllMocks());
it('rejects the old read-only request instead of silently timestamping a pending case as resolved', async () => {
  const next = vi.fn();
  await resolverAlerta({ params: { id: 'case' }, body: { notas: 'Marcada como leída' }, user: { id: 'admin' } } as never, response() as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mocks.update).not.toHaveBeenCalled();
});
it('persists an explicit state and reason and does not mark any user notice as read', async () => {
  const next = vi.fn(); mocks.update.mockResolvedValue({ id: 'case', estado: 'RESUELTA' });
  await resolverAlerta({ params: { id: 'case' }, body: { estado: 'RESUELTA', notas: 'Evidencia revisada' }, user: { id: 'admin' } } as never, response() as never, next);
  expect(next).not.toHaveBeenCalled(); expect(mocks.update.mock.calls[0][0].data).toMatchObject({ estado: 'RESUELTA', notas: 'Evidencia revisada', resueltaPor: 'admin' });
});
it('honors an inactive new rule instead of enabling it silently', async () => {
  const next = vi.fn();
  await crearReglaAlerta({ body: { nombre: 'QA', evento: 'TIEMPO_EXCESIVO', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":3}}', destinatarios: '["OPERADOR"]', activa: false }, user: { id: 'admin' } } as never, response() as never, next);
  expect(next).not.toHaveBeenCalled(); expect(mocks.create.mock.calls[0][0].data.activa).toBe(false);
});
it('requires an explicit transit threshold to activate a duration rule while allowing a draft', async () => {
  const body = { nombre: 'QA duración', evento: 'TIEMPO_EXCESIVO', condicion: '{}', destinatarios: '["ADMIN"]' };
  const next = vi.fn();
  await crearReglaAlerta({ body, user: { id: 'admin' } } as never, response() as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: expect.stringContaining('umbral') }));
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.create.mockResolvedValue({ id: 'draft' });
  const draftNext = vi.fn();
  await crearReglaAlerta({ body: { ...body, activa: false }, user: { id: 'admin' } } as never, response() as never, draftNext);
  expect(draftNext).not.toHaveBeenCalled(); expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activa: false }) }));
});
it('shows historical duration rules that need a threshold and permits deactivating them', async () => {
  const historical = { id: 'legacy', evento: 'TIEMPO_EXCESIVO', condicion: '{}', destinatarios: '["ADMIN"]', activa: true };
  mocks.rules.mockResolvedValue([historical, { ...historical, id: 'followup', condicion: '{"tipo":"seguimiento_cierre","diasRecepcion":{"gte":7}}' }]);
  const res = response(); await getReglasAlerta({} as never, res as never, vi.fn());
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ requiereUmbralTransito: true }), expect.objectContaining({ requiereUmbralTransito: false })] }));
  mocks.ruleFind.mockResolvedValue(historical); mocks.ruleUpdate.mockResolvedValue({ ...historical, activa: false });
  const next = vi.fn(); await actualizarReglaAlerta({ params: { id: 'legacy' }, body: { activa: false } } as never, response() as never, next);
  expect(next).not.toHaveBeenCalled(); expect(mocks.ruleUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activa: false }) }));
});
it('paginates and filters in the database, not an invisible fifty-row browser subset', async () => {
  mocks.list.mockResolvedValue([]); mocks.count.mockResolvedValue(110); const res = response(); const next = vi.fn();
  await getAlertasGeneradas({ query: { page: '11', limit: '10', estado: 'PENDIENTE,EN_REVISION', evento: 'TIEMPO_EXCESIVO', fechaDesde: '2026-10-01T00:00:00Z' } } as never, res as never, next);
  expect(next).not.toHaveBeenCalled(); expect(mocks.list.mock.calls[0][0]).toMatchObject({ skip: 100, take: 10, where: { estado: { in: ['PENDIENTE', 'EN_REVISION'] }, regla: { evento: 'TIEMPO_EXCESIVO' }, createdAt: { gte: new Date('2026-10-01T00:00:00Z') } } });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total: 110, pagina: 11, totalPaginas: 11, limit: 10 }) }));
});
it('reconciles only case references on the authenticated user notice page', async () => {
  mocks.notices.mockResolvedValue([{ id: 'notice', manifiestoId: 'own', datos: '{"tipo":"seguimiento_cierre","version":1,"casoId":"case"}' }]);
  mocks.noticeCount.mockResolvedValue(1); mocks.list.mockResolvedValue([{ id: 'case', estado: 'RESUELTA' }]);
  const res = response(); const next = vi.fn();
  await getNotificaciones({ query: {}, user: { id: 'operator' } } as never, res as never, next);
  expect(next).not.toHaveBeenCalled();
  expect(mocks.notices.mock.calls[0][0].where).toEqual({ usuarioId: 'operator' });
  expect(mocks.list.mock.calls[0][0]).toEqual({ where: { OR: [{ id: 'case', manifiestoId: 'own' }] }, select: { id: true, estado: true } });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ notificaciones: [expect.objectContaining({ seguimientoEstado: 'RESUELTA' })] }) }));
});
it('unlinked or malformed notices do not cause a global case query', async () => {
  mocks.notices.mockResolvedValue([{ id: 'notice', manifiestoId: 'own', datos: 'not JSON' }]); mocks.noticeCount.mockResolvedValue(1);
  await getNotificaciones({ query: {}, user: { id: 'operator' } } as never, response() as never, vi.fn());
  expect(mocks.list).not.toHaveBeenCalled();
});
