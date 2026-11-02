import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { schedule } = vi.hoisted(() => ({ schedule: vi.fn() }));
vi.mock('node-cron', () => ({ default: { schedule } }));
vi.mock('../../config/config', () => ({ config: { BLOCKCHAIN_ENABLED: true } }));
vi.mock('../../lib/prisma', () => ({ default: {} }));
vi.mock('../../lib/trainingScope', () => ({ isTrainingSession: vi.fn() }));
vi.mock('../../services/blockchain.service', () => ({ procesarPendientes: vi.fn() }));
vi.mock('../../services/domainEvent.service', () => ({ domainEvents: { emit: vi.fn() } }));
vi.mock('../../services/alertCataloguePolicy.service', () => ({}));
vi.mock('../../services/inspectionExchange.service', () => ({}));
vi.mock('../../services/inspectionDeadlineCompanyNotice.service', () => ({}));
vi.mock('../../services/manifestCompanyRecipients.service', () => ({}));
vi.mock('../../services/committed-manifest-push.service', () => ({}));
vi.mock('../../services/alertFollowupPolicy.service', () => ({}));
vi.mock('../../domain/operationReminder', () => ({}));

import { iniciarAlertCatalogueJob } from '../../jobs/alertCatalogue.job';
import { iniciarBlockchainJob } from '../../jobs/blockchain.job';
import { iniciarRecordatorioFirmaJob } from '../../jobs/manifestSignatureReminder.job';
import { iniciarRecordatorioJob } from '../../jobs/recordatorio.job';
import { iniciarSeguimientoCierreJob } from '../../jobs/seguimientoCierre.job';
import { iniciarVencimientoJob } from '../../jobs/vencimiento.job';
import { createScheduledTaskGate } from '../../config/scheduledTaskGate';

const families = [
  ['vencimiento', iniciarVencimientoJob, '0 8 * * *'],
  ['operación', iniciarRecordatorioJob, '0 */6 * * *'],
  ['firma', iniciarRecordatorioFirmaJob, '15 8 * * *'],
  ['seguimiento', iniciarSeguimientoCierreJob, '0 8 * * *'],
  ['catálogo', iniciarAlertCatalogueJob, '5 8 * * *'],
  ['blockchain', iniciarBlockchainJob, '*/1 * * * *'],
] as const;

beforeEach(() => {
  schedule.mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('registro de todas las familias cron por dueño', () => {
  it.each(families)('%s omite el singleton migrado sin opt-in', (_name, start) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NODE_APP_INSTANCE', 'migration-rehearsal');
    vi.stubEnv('SITREP_SCHEDULER_OWNER_INSTANCE', undefined);
    start();
    expect(schedule).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Cron no registrado'));
  });

  it.each(families)('%s registra exactamente un cron con opt-in', (_name, start, expression) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NODE_APP_INSTANCE', 'migration-rehearsal');
    vi.stubEnv('SITREP_SCHEDULER_OWNER_INSTANCE', 'migration-rehearsal');
    start();
    expect(schedule).toHaveBeenCalledOnce();
    expect(schedule.mock.calls[0][0]).toBe(expression);
    expect(schedule.mock.calls[0][1]).toEqual(expect.any(Function));
  });

  it.each(families)('%s mantiene PM2 0 y deniega el follower', (_name, start) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SITREP_SCHEDULER_OWNER_INSTANCE', undefined);
    vi.stubEnv('NODE_APP_INSTANCE', '1'); start();
    expect(schedule).not.toHaveBeenCalled();
    vi.stubEnv('NODE_APP_INSTANCE', '0'); start();
    expect(schedule).toHaveBeenCalledOnce();
  });

  it.each(families)('%s queda pausado incluso con opt-in', (_name, start) => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NODE_APP_INSTANCE', 'migration-rehearsal');
    vi.stubEnv('SITREP_SCHEDULER_OWNER_INSTANCE', 'migration-rehearsal');
    createScheduledTaskGate('true', vi.fn()).run(start);
    expect(schedule).not.toHaveBeenCalled();
  });
  it('el nombre opt-in no registra cron en test ni dentro de PM2', () => {
    vi.stubEnv('SITREP_SCHEDULER_OWNER_INSTANCE', 'migration-rehearsal');
    vi.stubEnv('NODE_APP_INSTANCE', 'migration-rehearsal');
    vi.stubEnv('NODE_ENV', 'test');
    iniciarVencimientoJob();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('pm_id', '0');
    iniciarVencimientoJob();
    expect(schedule).not.toHaveBeenCalled();
  });

  it('rechaza un propietario configurado ambiguo', () => {
    vi.stubEnv('SITREP_SCHEDULER_OWNER_INSTANCE', '');
    expect(() => iniciarVencimientoJob()).toThrow(/SITREP_SCHEDULER_OWNER_INSTANCE/);
    expect(schedule).not.toHaveBeenCalled();
  });

});
