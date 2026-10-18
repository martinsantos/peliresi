import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { inTrainingSession, isTrainingSession } from '../../lib/trainingScope';

const db = vi.hoisted(() => ({
  usuario: { findUnique: vi.fn(), upsert: vi.fn() },
  auditoria: { create: vi.fn() },
}));
const tokens = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: tokens }));
vi.mock('../../controllers/admin.controller', () => ({ getUsuarios: list }));
import { getTrainingUsers, impersonateTrainingUser } from '../../controllers/training.controller';

const request = (user = { id: 'real-admin', rol: 'ADMIN' }) => ({ user, params: { userId: 'cap-person' }, ip: '127.0.0.1' });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('TRAINING_DATABASE_URL', 'postgresql://training@localhost/qa?schema=sitrep_training');
  db.usuario.findUnique.mockImplementation(async () => {
    expect(isTrainingSession()).toBe(true);
    return { id: 'cap-person', email: 'cap-person@capacitacion.invalid', activo: true, rol: 'GENERADOR', nombre: 'CAP Persona' };
  });
  db.usuario.upsert.mockImplementation(async () => { expect(isTrainingSession()).toBe(true); return { id: 'real-admin', activo: false, email: 'supervisor-real-admin@capacitacion.invalid' }; });
  db.auditoria.create.mockImplementation(async () => { expect(isTrainingSession()).toBe(false); return {}; });
  tokens.mockImplementation(() => { expect(isTrainingSession()).toBe(true); return { accessToken: 'signed-school', refreshToken: 'signed-school-refresh' }; });
});
afterEach(() => vi.unstubAllEnvs());

it('signs the school identity, records the real supervisor and copies no real profile or password', async () => {
  const json = vi.fn(), next = vi.fn();
  await impersonateTrainingUser(request() as never, { json } as never, next);
  expect(next).not.toHaveBeenCalled();
  expect(tokens).toHaveBeenCalledWith('cap-person', false, undefined, 'real-admin');
  expect(db.usuario.upsert.mock.calls[0][0]).toMatchObject({
    update: {}, create: { activo: false, emailVerified: false, nombre: 'Supervisor de capacitación', notifEmail: false },
  });
  expect(db.auditoria.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ usuarioId: 'real-admin', accion: 'CAPACITACION_INICIO' }) }));
  expect(json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ user: expect.objectContaining({ training: true }) }) }));
});
it.each(['GENERADOR', 'ADMIN_GENERADOR', 'TRANSPORTISTA'])('rejects entry from %s before reading either store', async rol => {
  const next = vi.fn();
  await impersonateTrainingUser(request({ id: 'other', rol }) as never, { json: vi.fn() } as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(db.usuario.findUnique).not.toHaveBeenCalled();
});
it('rejects a nested training session', async () => {
  const next = vi.fn();
  await inTrainingSession(() => impersonateTrainingUser(request() as never, { json: vi.fn() } as never, next));
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  expect(tokens).not.toHaveBeenCalled();
});
it('does not return tokens when the operational audit fails', async () => {
  const json = vi.fn(), next = vi.fn(), failure = new Error('audit unavailable');
  db.auditoria.create.mockRejectedValue(failure);
  await impersonateTrainingUser(request() as never, { json } as never, next);
  expect(json).not.toHaveBeenCalled(); expect(next).toHaveBeenCalledWith(failure);
});
it('rejects an inactive target without generating tokens', async () => {
  db.usuario.findUnique.mockResolvedValue({ id: 'cap-person', activo: false });
  const next = vi.fn();
  await impersonateTrainingUser(request() as never, { json: vi.fn() } as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  expect(tokens).not.toHaveBeenCalled();
});
it('does not overwrite or sign through a conflicting supervisor identity', async () => {
  db.usuario.upsert.mockResolvedValue({ id: 'real-admin', activo: true, email: 'someone@capacitacion.invalid' });
  const next = vi.fn();
  await impersonateTrainingUser(request() as never, { json: vi.fn() } as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
  expect(tokens).not.toHaveBeenCalled();
});
it('lists only within training and adds UI namespaces without changing the underlying identifiers', async () => {
  list.mockImplementation(async (_req, res) => {
    expect(isTrainingSession()).toBe(true);
    res.json({ success: true, data: { usuarios: [{ id: 'cap-person' }], pagination: { total: 1 } } });
  });
  const json = vi.fn(), next = vi.fn();
  await getTrainingUsers(request() as never, { json } as never, next);
  expect(next).not.toHaveBeenCalled();
  expect(json).toHaveBeenCalledWith({ success: true, data: { usuarios: [{ id: 'training:cap-person' }], pagination: { total: 1 } } });
  expect(isTrainingSession()).toBe(false);
});
