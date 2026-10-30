import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), manifest: vi.fn(), insert: vi.fn(), transaction: vi.fn(), recipients: vi.fn(), lock: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { manifiesto: { findMany: mocks.list }, $transaction: mocks.transaction } }));
vi.mock('../../lib/trainingScope', () => ({ isTrainingSession: () => false }));
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: mocks.recipients }));
import { ejecutarRecordatorioFirma } from '../../jobs/manifestSignatureReminder.job';

const signed = new Date('2026-09-01T12:00:00Z');
const now = new Date(+signed + 23 * 86400000);
const access = { empresaId: 'co', actividadId: 'activity', rol: 'GENERADOR', razonSocial: 'QA Empresa', establecimientoId: 'site', establecimiento: 'Norte' };
const manifest = { id: 'm', numero: 'QA-RECORDATORIO', isDemoData: false, estado: 'EN_TRANSITO', fechaFirma: signed,
  generador: { usuario: { id: 'owner', activo: true } }, transportista: { usuario: { id: 'carrier', activo: true } },
  operador: { usuario: { id: 'operator', activo: true } } };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.list.mockResolvedValue([{ id: manifest.id }]);
  mocks.manifest.mockResolvedValue(manifest);
  mocks.lock.mockResolvedValue([{ id: manifest.id }]);
  mocks.insert.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({
    manifiesto: { findUnique: mocks.manifest }, notificacion: { createMany: mocks.insert }, $queryRaw: mocks.lock,
  }));
  mocks.recipients.mockResolvedValue([{ usuarioId: 'representative', accesosEmpresa: [access] },
    { usuarioId: 'owner', accesosEmpresa: [access] }]);
});

describe('recordatorio de firma a representantes', () => {
  it('bloquea el manifiesto antes de volver a consultar su estado', async () => {
    await ejecutarRecordatorioFirma(now);
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.manifest.mock.invocationCallOrder[0]);
  });
  it('continúa con los demás manifiestos si uno falla e informa que la evaluación quedó incompleta', async () => {
    mocks.list.mockResolvedValue([{ id: 'blocked' }, { id: manifest.id }]);
    mocks.transaction.mockRejectedValueOnce(new Error('QA bloqueo vencido'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(ejecutarRecordatorioFirma(now)).rejects.toThrow(/evaluación.*incompleta/i);
      expect(mocks.transaction).toHaveBeenCalledTimes(2);
      expect(mocks.insert).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
  it('avisa una vez por persona y guarda el alcance del representante, sin duplicar titulares', async () => {
    expect(await ejecutarRecordatorioFirma(now)).toBe(4);
    const { data, skipDuplicates } = mocks.insert.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data.map((n: { usuarioId: string }) => n.usuarioId).sort()).toEqual(['carrier', 'operator', 'owner', 'representative']);
    const rep = data.find((n: { usuarioId: string }) => n.usuarioId === 'representative');
    expect(rep.tipo).toBe('VENCIMIENTO_PROXIMO');
    expect(JSON.parse(rep.datos)).toMatchObject({ tipo: 'recordatorio_firma', version: 1, fase: 'SEMANA', destino: 'representante', accesosEmpresa: [access] });
    expect(JSON.parse(data.find((n: { usuarioId: string }) => n.usuarioId === 'owner').datos).destino).toBeUndefined();
  });

  it('conserva una referencia determinística para cada fase y destinatario', async () => {
    await ejecutarRecordatorioFirma(now);
    const first = mocks.insert.mock.calls[0][0].data;
    await ejecutarRecordatorioFirma(now);
    expect(mocks.insert.mock.calls[1][0].data.map((n: { id: string }) => n.id)).toEqual(first.map((n: { id: string }) => n.id));
    await ejecutarRecordatorioFirma(new Date(+signed + 30 * 86400000));
    expect(mocks.insert.mock.calls[2][0].data.find((n: { usuarioId: string }) => n.usuarioId === 'representative').id)
      .not.toBe(first.find((n: { usuarioId: string }) => n.usuarioId === 'representative').id);
  });

  it.each(['TRATADO', 'CANCELADO', 'RECHAZADO'])('no crea avisos para un manifiesto %s', async estado => {
    mocks.manifest.mockResolvedValue({ ...manifest, estado });
    expect(await ejecutarRecordatorioFirma(now)).toBe(0);
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.recipients).not.toHaveBeenCalled();
  });
});
