import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
const training = vi.hoisted(() => vi.fn());
vi.mock('../../lib/trainingScope', () => ({ isTrainingSession: training }));
import { fiscalCompanyRecipients, maskFiscalCompanyNotice, withFiscalCompanyNoticeContext } from '../../services/fiscalCompanyNotice.service';

const activity = vi.fn(), company = vi.fn(), generator = vi.fn(), grants = vi.fn(), users = vi.fn();
const db = { empresaActividad: { findMany: activity }, empresa: { findMany: company }, generador: { findMany: generator },
  autorizacionEmpresa: { findMany: grants }, usuario: { findMany: users } } as unknown as Prisma.TransactionClient;
const notice = { id: 'notice', usuarioId: 'member', titulo: 'Aviso para tu empresa', mensaje: 'Abrí el aviso.', datos: JSON.stringify({
  tipo: 'recordatorio_fiscal', version: 1, destino: 'representante', generadorId: 'g', fiscalYear: 2026,
  empresaId: 'co', actividadId: 'a', motivo: 'Revisá la documentación fiscal del ejercicio.', campaignId: 'campaign',
}) };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('ENTERPRISE_ENABLED', 'true'); training.mockReturnValue(false);
  activity.mockResolvedValue([{ id: 'a', empresaId: 'co', actorId: 'g' }]);
  company.mockResolvedValue([{ id: 'co', cuit: '30123456789', razonSocial: 'Empresa QA' }]);
  generator.mockResolvedValue([{ id: 'g', cuit: '30-12345678-9' }]);
  grants.mockResolvedValue([{ empresaId: 'co', actividadId: 'a', usuarioId: 'member' }]);
  users.mockResolvedValue([{ id: 'member' }]);
});
afterEach(() => vi.unstubAllEnvs());

it('selects only verified active people with complete establishment access in batches', async () => {
  expect(await fiscalCompanyRecipients(db, ['g', 'g'])).toEqual([{ generadorId: 'g', usuarioId: 'member', acceso: {
    empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'Empresa QA',
  } }]);
  expect(activity).toHaveBeenCalledWith(expect.objectContaining({ where: { activa: true, rol: 'GENERADOR', actorId: { in: ['g'] } } }));
  expect(grants).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ activa: true, todosEstablecimientos: true }) }));
  expect(users).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ activo: true, emailVerified: true }) }));
});
it.each(['disabled', 'training'])('does not expose company recipients when %s', async reason => {
  if (reason === 'disabled') vi.stubEnv('ENTERPRISE_ENABLED', 'false'); else training.mockReturnValue(true);
  expect(await fiscalCompanyRecipients(db, ['g'])).toEqual([]); expect(activity).not.toHaveBeenCalled();
});
it.each(['activity', 'company', 'generator', 'cuit', 'grant', 'user', 'other-company'])('excludes missing or mismatched %s', async reason => {
  if (reason === 'activity') activity.mockResolvedValue([]);
  if (reason === 'company') company.mockResolvedValue([]);
  if (reason === 'generator') generator.mockResolvedValue([]);
  if (reason === 'cuit') generator.mockResolvedValue([{ id: 'g', cuit: 'another' }]);
  if (reason === 'grant') grants.mockResolvedValue([]);
  if (reason === 'user') users.mockResolvedValue([]);
  if (reason === 'other-company') grants.mockResolvedValue([{ empresaId: 'foreign', actividadId: 'a', usuarioId: 'member' }]);
  expect(await fiscalCompanyRecipients(db, ['g'])).toEqual([]);
});
it('projects the reason and exact company only while its current authorization matches', async () => {
  const [visible] = await withFiscalCompanyNoticeContext(db, [notice]);
  expect(visible.titulo).toBe('Recordatorio fiscal 2026');
  expect(visible.mensaje).toContain('documentación fiscal');
  expect(JSON.parse(visible.datos!).accesosEmpresa).toEqual([{ empresaId: 'co', actividadId: 'a', rol: 'GENERADOR', razonSocial: 'Empresa QA' }]);
  expect(notice.titulo).toBe('Aviso para tu empresa');
  grants.mockResolvedValue([]);
  const [revoked] = await withFiscalCompanyNoticeContext(db, [notice]);
  expect(revoked.titulo).toBe('Aviso no disponible');
  expect(JSON.stringify(revoked)).not.toMatch(/2026|documentación fiscal|campaign|Empresa QA|"generadorId"/);
});
it('does not borrow another user or another company authorization', async () => {
  const otherUser = { ...notice, usuarioId: 'someone-else' };
  const otherCompany = { ...notice, datos: JSON.stringify({ ...JSON.parse(notice.datos), empresaId: 'foreign' }) };
  const rows = await withFiscalCompanyNoticeContext(db, [otherUser, otherCompany]);
  expect(rows.every(r => r.titulo === 'Aviso no disponible')).toBe(true);
});
it('redacts malformed fiscal metadata and masks read mutations without touching unrelated notices', async () => {
  const malformed = { ...notice, datos: JSON.stringify({ ...JSON.parse(notice.datos), fiscalYear: '2026' }) };
  expect((await withFiscalCompanyNoticeContext(db, [malformed]))[0].titulo).toBe('Aviso no disponible');
  expect(JSON.stringify(maskFiscalCompanyNotice(notice))).not.toMatch(/2026|documentación fiscal|campaign|"generadorId"/);
  const personal = { ...notice, datos: '{"tipo":"recordatorio_fiscal"}' };
  expect(maskFiscalCompanyNotice(personal)).toBe(personal);
  expect((await withFiscalCompanyNoticeContext(db, [personal]))[0]).toBe(personal);
});
