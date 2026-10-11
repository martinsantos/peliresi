import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rows: [] as Array<{ id: string; reglaId: string; manifiestoId: string | null; datos: string }>, notification: vi.fn(), email: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  usuario: { findMany: vi.fn().mockResolvedValue([]) },
  notificacion: { findMany: vi.fn().mockResolvedValue([]) },
  reglaAlerta: { findMany: vi.fn().mockResolvedValue([{ id: 'qa-expiry', nombre: 'QA vencimiento', evento: 'VENCIMIENTO', activa: true, condicion: '{"diasRestantes":{"lte":7}}', destinatarios: '["ADMIN"]' }]) },
  alertaGenerada: {
    findFirst: vi.fn(async ({ where }) => state.rows.find(row => row.reglaId === where.reglaId && row.manifiestoId === where.manifiestoId
      && (where.AND || []).every((condition: { datos: { contains: string } }) => row.datos.includes(condition.datos.contains))) ?? null),
    create: vi.fn(async ({ data }) => { const row = { id: String(state.rows.length + 1), ...data }; state.rows.push(row); return row; }),
  },
} }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendAlertEmail: state.email } }));
vi.mock('../../controllers/notification.controller', () => ({ notificationService: { crearNotificacion: state.notification } }));
import { alertaSubscriber } from '../../subscribers/alerta.subscriber';
import prisma from '../../lib/prisma';
const event = (entidadId: string, date = '2026-10-10T12:00:00Z', entidad: 'VEHICULO' | 'CHOFER' = 'VEHICULO') => ({
  type: 'VENCIMIENTO_PROXIMO' as const, entidad, entidadId, nombre: entidadId, vencimiento: new Date(date), diasRestantes: 6,
});
beforeEach(() => { vi.clearAllMocks(); state.rows.length = 0; });
afterEach(() => vi.unstubAllEnvs());
it('keeps separate expiry cases for distinct subjects instead of collapsing null-manifest cases', async () => {
  for (const id of ['qa-vehicle-1', 'qa-vehicle-2']) await alertaSubscriber(event(id));
  expect(state.rows.map(row => JSON.parse(row.datos).entidadId)).toEqual(['qa-vehicle-1', 'qa-vehicle-2']);
  expect(state.notification).not.toHaveBeenCalled(); expect(state.email).not.toHaveBeenCalled();
});
it('deduplicates a repeated subject/date but preserves a changed date, entity type and escaped ID', async () => {
  const id = 'qa-"escaped"-1';
  await alertaSubscriber(event(id)); await alertaSubscriber(event(id));
  await alertaSubscriber(event(id, '2026-10-11T12:00:00Z'));
  await alertaSubscriber(event(id, '2026-10-10T12:00:00Z', 'CHOFER'));
  expect(state.rows).toHaveLength(3);
  expect(state.email).not.toHaveBeenCalled();
});
it.each(['', 'false', 'true'])('external rule addresses require their separate explicit switch: %s', async enabled => {
  vi.stubEnv('DISABLE_EMAILS', 'false');
  vi.stubEnv('EMAIL_EXTERNAL_ALERTS_ENABLED', enabled);
  vi.stubEnv('EMAIL_EXTERNAL_ALERTS_ALLOWLIST', 'external@qa.invalid');
  vi.mocked(prisma.reglaAlerta.findMany).mockResolvedValueOnce([{ id: 'qa-external', nombre: 'QA', evento: 'VENCIMIENTO', activa: true,
    condicion: '{"diasRestantes":{"lte":7}}', destinatarios: '["email:external@qa.invalid"]' }] as never);
  await alertaSubscriber(event('qa-external'));
  expect(state.rows).toHaveLength(1);
  expect(state.email).toHaveBeenCalledTimes(enabled === 'true' ? 1 : 0);
});
it('a rule cannot authorize an external address merely by naming it', async () => {
  vi.stubEnv('EMAIL_EXTERNAL_ALERTS_ENABLED', 'true');
  vi.stubEnv('EMAIL_EXTERNAL_ALERTS_ALLOWLIST', 'different@qa.invalid');
  vi.mocked(prisma.reglaAlerta.findMany).mockResolvedValueOnce([{ id: 'qa-external', nombre: 'QA', evento: 'VENCIMIENTO', activa: true,
    condicion: '{"diasRestantes":{"lte":7}}', destinatarios: '["email:external@qa.invalid"]' }] as never);
  await alertaSubscriber(event('qa-external'));
  expect(state.rows).toHaveLength(1);
  expect(state.email).not.toHaveBeenCalled();
});
