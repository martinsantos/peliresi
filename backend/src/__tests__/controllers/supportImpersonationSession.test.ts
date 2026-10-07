import { beforeEach, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
const db = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { usuario: { findUnique: db.find } } }));
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'unit-only-signed-impersonation-secret', JWT_EXPIRES_IN: '1h' } }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
import { generateTokens, refreshToken } from '../../controllers/auth.controller';
import { isAuthenticated } from '../../middlewares/auth.middleware';
const secret = 'unit-only-signed-impersonation-secret';
const subject = { id: 'actor', nombre: 'Generador QA', activo: true, rol: 'GENERADOR' };
const operator = { id: 'admin', nombre: 'Administradora QA', activo: true, rol: 'ADMIN' };
beforeEach(() => { db.find.mockReset(); db.find.mockImplementation(({ where }) => Promise.resolve(where.id === 'actor' ? subject : operator)); });
it('issues signed operator claims in access and renewal tokens without changing the effective subject', () => {
  const tokens = generateTokens('actor', false, undefined, 'admin');
  for (const value of [tokens.accessToken, tokens.refreshToken]) expect(jwt.verify(value, secret)).toMatchObject({ id: 'actor', impersonatedBy: 'admin' });
});
it('preserves signed operator identity through refresh and enforces it on the actual middleware', async () => {
  const tokens = generateTokens('actor', false, undefined, 'admin'); const json = vi.fn(), next = vi.fn();
  await refreshToken({ body: { refreshToken: tokens.refreshToken } } as never, { json } as never, next);
  expect(next).not.toHaveBeenCalled(); const renewed = json.mock.calls[0][0].data.accessToken;
  expect(jwt.verify(renewed, secret)).toMatchObject({ id: 'actor', impersonatedBy: 'admin' });
  const request = { headers: { authorization: 'Bearer ' + renewed }, user: undefined };
  await isAuthenticated(request as never, {} as never, next);
  expect(request.user).toMatchObject({ id: 'actor', rol: 'GENERADOR', impersonatedBy: { id: 'admin', nombre: 'Administradora QA' } });
});
it('refuses refresh and API access if the original administrator is disabled', async () => {
  db.find.mockImplementation(({ where }) => Promise.resolve(where.id === 'actor' ? subject : { ...operator, activo: false }));
  const tokens = generateTokens('actor', false, undefined, 'admin'); const json = vi.fn(), next = vi.fn();
  await refreshToken({ body: { refreshToken: tokens.refreshToken } } as never, { json } as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 })); expect(json).not.toHaveBeenCalled();
  const middlewareNext = vi.fn(); await isAuthenticated({ headers: { authorization: 'Bearer ' + tokens.accessToken } } as never, {} as never, middlewareNext);
  expect(middlewareNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
});
it('rejects a tampered administrator claim before any database lookup', async () => {
  const parts = generateTokens('actor').accessToken.split('.'); parts[1] = Buffer.from(JSON.stringify({ id: 'actor', impersonatedBy: 'admin' })).toString('base64url');
  const next = vi.fn(); await isAuthenticated({ headers: { authorization: 'Bearer ' + parts.join('.') } } as never, {} as never, next);
  expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 })); expect(db.find).not.toHaveBeenCalled();
});
