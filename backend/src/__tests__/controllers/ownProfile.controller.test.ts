import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), audit: vi.fn() }));
vi.mock('../../lib/prisma', () => {
  const db = { usuario: { findUnique: mocks.findUnique, update: mocks.update }, auditoria: { create: mocks.audit } };
  return { default: { ...db, $transaction: (callback: (tx: typeof db) => unknown) => callback(db) } };
});
vi.mock('../../config/config', () => ({ config: { JWT_SECRET: 'unit-profile-only', JWT_EXPIRES_IN: '15m' } }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
import { updateOwnProfile } from '../../controllers/auth.controller';

function context(body: unknown, user: Record<string, unknown> = { id: 'generador-qa', rol: 'GENERADOR' }) {
  const json = vi.fn();
  const next = vi.fn();
  const req = { body, user, ip: '127.0.0.1', headers: { 'user-agent': 'unit' } } as unknown as Request;
  return { req, res: { json } as unknown as Response, json, next };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findUnique.mockResolvedValue({ nombre: 'Nombre anterior', telefono: '261-000' });
  mocks.update.mockImplementation(({ data }) => Promise.resolve({ id: 'generador-qa', email: 'qa@example.invalid', nombre: 'Nombre anterior', telefono: '261-000', ...data }));
});

describe('own profile update', () => {
  it('lets a non-admin person update their own name and phone, with audit before/after', async () => {
    const c = context({ nombre: '  Nombre nuevo  ', telefono: '261-555' });
    await updateOwnProfile(c.req, c.res, c.next);
    expect(c.next).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'generador-qa' }, data: { nombre: 'Nombre nuevo', telefono: '261-555' } }));
    const audit = mocks.audit.mock.calls[0][0].data;
    expect(audit).toMatchObject({ usuarioId: 'generador-qa', accion: 'UPDATE_PERFIL_PROPIO', modulo: 'AUTH' });
    expect(JSON.parse(audit.datosAntes)).toEqual({ nombre: 'Nombre anterior', telefono: '261-000' });
    expect(JSON.parse(audit.datosDespues)).toEqual({ nombre: 'Nombre nuevo', telefono: '261-555' });
    expect(c.json).toHaveBeenCalledWith({ success: true, data: { usuario: expect.objectContaining({ nombre: 'Nombre nuevo' }) } });
  });

  it.each([{ rol: 'ADMIN' }, { email: 'otro@example.invalid' }, { activo: false }, { nombre: 'X', esInspector: true }])('rejects any field other than name and phone: %o', async body => {
    const c = context(body);
    await updateOwnProfile(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'Sólo podés modificar tu nombre y tu teléfono' }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects an empty name and an empty request', async () => {
    const empty = context({ nombre: '   ' });
    await updateOwnProfile(empty.req, empty.res, empty.next);
    expect(empty.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'El nombre es obligatorio' }));
    const nothing = context({});
    await updateOwnProfile(nothing.req, nothing.res, nothing.next);
    expect(nothing.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, message: 'No hay cambios para guardar' }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('allows clearing the phone', async () => {
    const c = context({ telefono: '' });
    await updateOwnProfile(c.req, c.res, c.next);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { telefono: '' } }));
  });

  it('does not let an administrator edit the impersonated person profile', async () => {
    const c = context({ nombre: 'Cambio ajeno' }, { id: 'generador-qa', rol: 'GENERADOR', impersonatedBy: { id: 'admin-qa', nombre: 'Admin' } });
    await updateOwnProfile(c.req, c.res, c.next);
    expect(c.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
