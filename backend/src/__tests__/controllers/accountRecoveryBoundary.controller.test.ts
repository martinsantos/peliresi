import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), resetEmail: vi.fn(), verifyEmail: vi.fn(), hash: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  usuario: { findFirst: mocks.findFirst, findUnique: mocks.findUnique, update: mocks.update, updateMany: mocks.updateMany, findMany: mocks.findMany },
  auditoria: { create: mocks.audit }, notificacion: { create: vi.fn() },
} }));
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'unit-recovery-only', JWT_EXPIRES_IN: '15m' } }));
vi.mock('bcryptjs', () => ({ default: { genSalt: vi.fn().mockResolvedValue('salt'), hash: mocks.hash } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendPasswordResetEmail: mocks.resetEmail, sendEmailVerification: mocks.verifyEmail } }));
import { claimAccount, forgotPassword, resetPassword } from '../../controllers/auth.controller';

const user = { id: 'qa', email: 'owner@example.invalid', nombre: 'Titular QA', password: 'old-hash', rol: 'GENERADOR',
  activo: true, emailVerified: true, generador: { razonSocial: 'Entidad QA' }, transportista: null, operador: null };
const claim = { cuit: '30711235961', razonSocial: 'Entidad QA', nuevoEmail: 'not-owner@example.invalid', password: 'AttackerChosen9' };
function context(body: unknown) {
  const json = vi.fn(); return { req: { body, headers: {} } as Request, res: { json } as unknown as Response, json, next: vi.fn() };
}
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  mocks.findFirst.mockResolvedValue(user); mocks.update.mockResolvedValue(user); mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.hash.mockResolvedValue('new-hash'); mocks.findMany.mockResolvedValue([]);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('registered mailbox is the recovery authorization boundary', () => {
  it('does not replace credentials from public identity data, even with a legacy proposed email/password', async () => {
    const c = context(claim); await claimAccount(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    const data = mocks.update.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(['passwordResetExpires', 'passwordResetToken']);
    expect(mocks.hash).not.toHaveBeenCalled(); expect(mocks.verifyEmail).not.toHaveBeenCalled();
    expect(mocks.resetEmail).toHaveBeenCalledWith(user.email, user.nombre, expect.any(String));
    const raw = mocks.resetEmail.mock.calls[0][2];
    expect(data.passwordResetToken).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(data.passwordResetExpires).toEqual(new Date('2026-09-26T13:00:00Z'));
    expect(c.json.mock.calls[0][0]).not.toHaveProperty('token');
  });
  it('accepts the new recovery form without collecting a new email or password', async () => {
    const c = context({ cuit: claim.cuit, razonSocial: claim.razonSocial }); await claimAccount(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled(); expect(mocks.resetEmail).toHaveBeenCalledWith(user.email, user.nombre, expect.any(String));
  });
  it.each(['owner@sitrep.local', 'owner@SITREP.LOCAL', 'owner@placeholder.com', 'owner@PLACEHOLDER.COM', 'invalid'])('blocks placeholder/invalid mailbox %s in both public entry points', async email => {
    mocks.findFirst.mockResolvedValue({ ...user, email });
    const c = context(claim); await claimAccount(c.req, c.res, c.next);
    const forgot = context({ cuit: claim.cuit }); await forgotPassword(forgot.req, forgot.res, forgot.next);
    expect(c.next).not.toHaveBeenCalled(); expect(forgot.next).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.resetEmail).not.toHaveBeenCalled(); expect(mocks.verifyEmail).not.toHaveBeenCalled();
  });
  it('does not mutate credentials if mail dispatch fails', async () => {
    const error = new Error('queue unavailable'); mocks.resetEmail.mockRejectedValue(error);
    const c = context(claim); await claimAccount(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalledWith(error);
    expect(Object.keys(mocks.update.mock.calls[0][0].data).sort()).toEqual(['passwordResetExpires', 'passwordResetToken']);
  });
  it.each([false, true])('preserves activation/verification flags and never issues a session, active=%s', async active => {
    mocks.findFirst.mockResolvedValue({ ...user, activo: active, emailVerified: active });
    const c = context(claim); await claimAccount(c.req, c.res, c.next);
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('activo');
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('emailVerified');
    expect(c.json.mock.calls[0][0]).not.toHaveProperty('data');
  });
  it('returns identical public answers for mismatched and matched records without disclosing the stored mailbox', async () => {
    mocks.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
    const missing = context(claim); await claimAccount(missing.req, missing.res, missing.next);
    const matched = context(claim); await claimAccount(matched.req, matched.res, matched.next);
    expect(missing.json.mock.calls[0]).toEqual(matched.json.mock.calls[0]);
    expect(JSON.stringify(matched.json.mock.calls)).not.toContain(user.email);
  });
});

describe('proof token can change the password only once', () => {
  it('atomically consumes matching, unexpired proof before reporting success', async () => {
    const c = context({ token: 'proof', newPassword: 'OwnerChosen9' }); await resetPassword(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: user.id, passwordResetToken: createHash('sha256').update('proof').digest('hex'), passwordResetExpires: { gt: new Date() } },
      data: { password: 'new-hash', passwordResetToken: null, passwordResetExpires: null },
    });
  });
  it('rejects a concurrent replay or token expiration after lookup without reporting success', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const c = context({ token: 'proof', newPassword: 'OwnerChosen9' }); await resetPassword(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(c.json).not.toHaveBeenCalled();
  });
  it.each([{}, { token: ['wrong-type'], newPassword: 'OwnerChosen9' }, { token: 'proof', newPassword: {} }])('rejects malformed reset payload %j without DB access', async body => {
    const c = context(body); await resetPassword(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 })); expect(mocks.findFirst).not.toHaveBeenCalled();
  });
});
