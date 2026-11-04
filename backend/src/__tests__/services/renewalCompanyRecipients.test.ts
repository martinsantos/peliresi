import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Prisma, Renovacion } from '@prisma/client';
const training = vi.hoisted(() => vi.fn());
vi.mock('../../lib/trainingScope', () => ({ isTrainingSession: training }));
import { renewalCompanyRecipients } from '../../services/renewalCompanyRecipients.service';
const renewal = { tipoActor: 'GENERADOR', generadorId: 'g', operadorId: null } as Renovacion;
const activity = vi.fn(), company = vi.fn(), actor = vi.fn(), grants = vi.fn(), sites = vi.fn(), users = vi.fn();
const db = { empresaActividad: { findFirst: activity }, empresa: { findFirst: company }, generador: { findUnique: actor }, operador: { findUnique: actor }, autorizacionEmpresa: { findMany: grants }, establecimientoEmpresa: { findMany: sites }, usuario: { findMany: users } } as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('ENTERPRISE_ENABLED', 'true'); training.mockReturnValue(false);
  activity.mockResolvedValue({ id: 'a', empresaId: 'co' }); company.mockResolvedValue({ id: 'co', cuit: '30123456789' }); actor.mockResolvedValue({ activo: true, cuit: '30-12345678-9' });
  grants.mockResolvedValue([{ usuarioId: 'owner', todosEstablecimientos: true, establecimientoIds: [] }, { usuarioId: 'member', todosEstablecimientos: false, establecimientoIds: ['site'] }, { usuarioId: 'other', todosEstablecimientos: false, establecimientoIds: ['foreign'] }]);
  sites.mockResolvedValue([{ id: 'site' }]); users.mockResolvedValue([{ id: 'owner' }, { id: 'member' }]);
});
afterEach(() => vi.unstubAllEnvs());
it.each(['GENERADOR', 'OPERADOR'])('selects only authorized, active and verified people for %s', async tipoActor => {
  const r = { ...renewal, tipoActor, operadorId: 'o' } as Renovacion;
  expect(await renewalCompanyRecipients(db, r)).toEqual(['owner', 'member']);
  expect(activity).toHaveBeenCalledWith({ where: { rol: tipoActor, actorId: tipoActor === 'GENERADOR' ? 'g' : 'o', activa: true } });
  expect(grants).toHaveBeenCalledWith({ where: { empresaId: 'co', actividadId: 'a', activa: true } });
  expect(users).toHaveBeenCalledWith({ where: { id: { in: ['owner', 'member'] }, activo: true, emailVerified: true, rol: { in: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] } }, select: { id: true } });
});
it.each(['disabled', 'training'])('does not read company grants for %s', async mode => {
  if (mode === 'disabled') vi.stubEnv('ENTERPRISE_ENABLED', 'false'); else training.mockReturnValue(true);
  expect(await renewalCompanyRecipients(db, renewal)).toEqual([]); expect(activity).not.toHaveBeenCalled();
});
it.each(['activity', 'company', 'actor', 'cuit', 'sites', 'grants', 'users'])('rejects invalid or revoked %s', async missing => {
  if (missing === 'activity') activity.mockResolvedValue(null);
  if (missing === 'company') company.mockResolvedValue(null);
  if (missing === 'actor') actor.mockResolvedValue({ activo: false, cuit: '30123456789' });
  if (missing === 'cuit') actor.mockResolvedValue({ activo: true, cuit: 'foreign' });
  if (missing === 'sites') sites.mockResolvedValue([]);
  if (missing === 'grants') grants.mockResolvedValue([]);
  if (missing === 'users') users.mockResolvedValue([]);
  expect(await renewalCompanyRecipients(db, renewal)).toEqual([]);
});
