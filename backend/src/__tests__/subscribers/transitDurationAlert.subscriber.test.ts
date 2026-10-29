import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '../../services/domainEvent.service';

const mocks = vi.hoisted(() => ({ rules: vi.fn(), users: vi.fn(), manifest: vi.fn(), transaction: vi.fn(),
  query: vi.fn(), find: vi.fn(), create: vi.fn(), notice: vi.fn(), insertNotices: vi.fn(), channels: vi.fn(), email: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { reglaAlerta: { findMany: mocks.rules }, usuario: { findMany: mocks.users },
  manifiesto: { findUnique: mocks.manifest }, $transaction: mocks.transaction } }));
vi.mock('../../utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../controllers/notification.controller', () => ({ notificationService: { crearNotificacion: mocks.notice, programarCanalesDeNotificacion: mocks.channels } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendAlertEmail: mocks.email } }));
import { alertaSubscriber } from '../../subscribers/alerta.subscriber';

const observed = (hours: number, type: 'DURACION_TRANSITO_OBSERVADA' | 'TIEMPO_EXCESIVO' = 'DURACION_TRANSITO_OBSERVADA'): DomainEvent => ({
  type, manifiestoId: 'synthetic-trip', horasTransito: hours, numero: 'QA-1', userId: 'carrier-a',
});
const rule = (condition: unknown) => ({ id: 'rule-a', nombre: 'Avisar desde 24 horas', evento: 'TIEMPO_EXCESIVO',
  condicion: JSON.stringify(condition), destinatarios: '["ADMIN"]', activa: true });
const now = new Date('2026-10-28T12:00:00.000Z');
const rows: Array<{ reglaId: string; manifiestoId: string; createdAt: Date }> = [];
let currentManifest: { estado: string; numero: string; fechaRetiro: Date | null };
let currentRule: { activa: boolean; evento: string; nombre: string; condicion: string; destinatarios: string };

beforeEach(() => {
  vi.resetAllMocks(); rows.length = 0;
  currentManifest = { estado: 'EN_TRANSITO', numero: 'QA-1', fechaRetiro: new Date(now.getTime() - 25 * 3600000) };
  currentRule = rule({ horasTransito: { gte: 24 } });
  mocks.rules.mockResolvedValue([]);
  mocks.users.mockResolvedValue([{ id: 'admin-a' }]);
  mocks.query.mockImplementation(async (sql: TemplateStringsArray) => {
    const query = sql.join('');
    if (query.includes('clock_timestamp')) return [{ now }];
    if (query.includes('FROM manifiestos')) return [currentManifest];
    if (query.includes('FROM reglas_alertas')) return [currentRule];
    return [];
  });
  mocks.find.mockImplementation(async ({ where }) => rows.find(row => row.reglaId === where.reglaId && row.manifiestoId === where.manifiestoId && row.createdAt >= where.createdAt.gte) ?? null);
  mocks.create.mockImplementation(async ({ data }) => { rows.push(data); return data; });
  mocks.manifest.mockResolvedValue({ generador: null, transportista: { usuario: { id: 'carrier-a' } }, operador: null });
  mocks.insertNotices.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async work => work({ $queryRaw: mocks.query, alertaGenerada: { findFirst: mocks.find, create: mocks.create },
    manifiesto: { findUnique: mocks.manifest }, usuario: { findMany: mocks.users }, notificacion: { createMany: mocks.insertNotices } }));
  mocks.notice.mockResolvedValue({});
});
afterEach(() => vi.unstubAllEnvs());

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
    expect(rows).toHaveLength(1); expect(mocks.insertNotices).toHaveBeenCalledTimes(1); expect(mocks.channels).toHaveBeenCalledTimes(1);
    const written = mocks.insertNotices.mock.calls[0][0].data[0];
    expect(written).toMatchObject({ usuarioId: 'admin-a', titulo: 'Avisar desde 24 horas', manifiestoId: 'synthetic-trip',
      mensaje: expect.stringContaining('el manifiesto QA-1 llevaba aproximadamente 25 horas en tránsito') });
    expect(JSON.parse(written.datos)).toMatchObject({ tipo: 'duracion_transito_configurada', version: 1 });
    expect(mocks.channels).toHaveBeenCalledWith(written);
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted', maxWait: 10_000, timeout: 10_000 });
    expect(mocks.query.mock.calls.some(([sql]) => sql.join('').includes('pg_advisory_xact_lock'))).toBe(true);
  });

  it('does not alert after the trip has been delivered or the rule was disabled', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    currentManifest.estado = 'ENTREGADO';
    await alertaSubscriber(observed(25));
    currentManifest.estado = 'EN_TRANSITO'; currentRule.activa = false;
    await alertaSubscriber(observed(25));
    expect(rows).toHaveLength(0); expect(mocks.insertNotices).not.toHaveBeenCalled(); expect(mocks.channels).not.toHaveBeenCalled();
  });

  it('includes the configured carrier even when that carrier sent the GPS point', async () => {
    const selected = { ...rule({ horasTransito: { gte: 24 } }), destinatarios: '["TRANSPORTISTA"]' };
    currentRule = selected; mocks.rules.mockResolvedValue([selected]);
    await alertaSubscriber(observed(25));
    expect(mocks.insertNotices.mock.calls[0][0].data.map((notice: any) => notice.usuarioId)).toEqual(['carrier-a']);
    expect(mocks.channels).toHaveBeenCalledOnce();
  });

  it('does not schedule channels if saving notices inside the transaction fails', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    mocks.insertNotices.mockRejectedValueOnce(new Error('recipient removed'));
    await expect(alertaSubscriber(observed(25))).rejects.toThrow('recipient removed');
    expect(mocks.channels).not.toHaveBeenCalled(); expect(mocks.email).not.toHaveBeenCalled();
  });

  it('schedules channels only after the transaction commits', async () => {
    mocks.rules.mockResolvedValue([rule({ horasTransito: { gte: 24 } })]);
    const transaction = mocks.transaction.getMockImplementation()!;
    let committed = false;
    mocks.transaction.mockImplementation(async (...args: any[]) => {
      const result = await transaction(...args);
      expect(mocks.channels).not.toHaveBeenCalled();
      committed = true;
      return result;
    });
    mocks.channels.mockImplementation(() => expect(committed).toBe(true));
    await alertaSubscriber(observed(25));
    expect(mocks.channels).toHaveBeenCalledOnce();
  });

  it('keeps explicitly allowed legacy email recipients behind the existing policy', async () => {
    vi.stubEnv('EMAIL_EXTERNAL_ALERTS_ENABLED', 'true');
    vi.stubEnv('EMAIL_EXTERNAL_ALERTS_ALLOWLIST', 'external@night-qa.invalid');
    const selected = { ...rule({ horasTransito: { gte: 24 } }), destinatarios: '["ADMIN","email:external@night-qa.invalid","email:other@night-qa.invalid"]' };
    currentRule = selected; mocks.rules.mockResolvedValue([selected]);
    await alertaSubscriber(observed(25));
    expect(mocks.email).toHaveBeenCalledWith(['external@night-qa.invalid'], selected, 'synthetic-trip', expect.objectContaining({ horasTransito: 25 }));
  });
});
