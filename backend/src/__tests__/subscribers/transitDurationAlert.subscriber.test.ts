import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '../../services/domainEvent.service';

const mocks = vi.hoisted(() => ({ rules: vi.fn(), users: vi.fn(), manifest: vi.fn(), transaction: vi.fn(),
  query: vi.fn(), find: vi.fn(), create: vi.fn(), notice: vi.fn(), email: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { reglaAlerta: { findMany: mocks.rules }, usuario: { findMany: mocks.users },
  manifiesto: { findUnique: mocks.manifest }, $transaction: mocks.transaction } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../controllers/notification.controller', () => ({ notificationService: { crearNotificacion: mocks.notice } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendAlertEmail: mocks.email } }));
import { alertaSubscriber } from '../../subscribers/alerta.subscriber';

const observed = (hours: number, type: 'DURACION_TRANSITO_OBSERVADA' | 'TIEMPO_EXCESIVO' = 'DURACION_TRANSITO_OBSERVADA'): DomainEvent => ({
  type, manifiestoId: 'synthetic-trip', horasTransito: hours, numero: 'QA-1', userId: 'carrier-a',
});
const rule = (condition: unknown) => ({ id: 'rule-a', nombre: 'Avisar desde 24 horas', evento: 'TIEMPO_EXCESIVO',
  condicion: JSON.stringify(condition), destinatarios: '["ADMIN"]', activa: true });
const now = new Date('2026-10-28T12:00:00.000Z');
const rows: Array<{ reglaId: string; manifiestoId: string; createdAt: Date }> = [];

beforeEach(() => {
  vi.resetAllMocks(); rows.length = 0;
  mocks.rules.mockResolvedValue([]);
  mocks.users.mockResolvedValue([{ id: 'admin-a' }]);
  mocks.query.mockImplementation(async (sql: TemplateStringsArray) => sql.join('').includes('clock_timestamp') ? [{ now }] : []);
  mocks.find.mockImplementation(async ({ where }) => rows.find(row => row.reglaId === where.reglaId && row.manifiestoId === where.manifiestoId && row.createdAt >= where.createdAt.gte) ?? null);
  mocks.create.mockImplementation(async ({ data }) => { rows.push(data); return data; });
  mocks.transaction.mockImplementation(async work => work({ $queryRaw: mocks.query, alertaGenerada: { findFirst: mocks.find, create: mocks.create } }));
  mocks.notice.mockResolvedValue({});
});

describe('transit duration is informational unless Ambiente configures a threshold', () => {
  it.each(['DURACION_TRANSITO_OBSERVADA', 'TIEMPO_EXCESIVO'] as const)('does not create a default notice or incident for %s', async type => {
    await alertaSubscriber(observed(25, type));
    expect(mocks.rules).toHaveBeenCalledWith({ where: { evento: 'TIEMPO_EXCESIVO', activa: true } });
    expect(mocks.notice).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([{}, { any: [{ horasTransito: { gte: 24 } }, { numero: 'QA-1' }] }])('does not turn a rule without a required lower bound into a duration alert', async condition => {
    mocks.rules.mockResolvedValue([rule(condition)]);
    await alertaSubscriber(observed(25));
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.notice).not.toHaveBeenCalled();
  });

  it('alerts only after the configured threshold and does not repeat it in the same window', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    await alertaSubscriber(observed(23));
    expect(mocks.transaction).not.toHaveBeenCalled();
    await alertaSubscriber(observed(25));
    await alertaSubscriber(observed(26));
    expect(rows).toHaveLength(1); expect(mocks.notice).toHaveBeenCalledTimes(1);
    expect(mocks.notice).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: 'admin-a', titulo: 'Avisar desde 24 horas', manifiestoId: 'synthetic-trip',
      mensaje: expect.stringContaining('El manifiesto QA-1 lleva aproximadamente 25 horas en tránsito') }));
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 10_000 });
    expect(mocks.query.mock.calls[0][0].join('')).toContain('pg_advisory_xact_lock');
  });
});
