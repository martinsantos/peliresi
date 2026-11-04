import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), full: vi.fn(), update: vi.fn(), transaction: vi.fn(), recipients: vi.fn(), notices: vi.fn(), event: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: mocks.find, findUniqueOrThrow: mocks.full, updateMany: mocks.update }, $transaction: mocks.transaction,
} }));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({ buildDeclaredInspectionSnapshot: vi.fn(), ensureInspectionDeclaredComparisons: vi.fn() }));
vi.mock('../../services/inspectionEvidence.service', () => ({ persistInspectionEvidence: vi.fn(), removeInspectionEvidence: vi.fn(), resolveInspectionEvidence: vi.fn() }));
vi.mock('../../services/inspectionActPdf.service', () => ({ streamInspectionTechnicalReportPdf: vi.fn() }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: vi.fn() }));
import { actualizarInspeccion, guardarBorradorInspeccion, cambiarEstadoInspeccion } from '../../controllers/inspeccion.controller';

const record = { id: 'case', numero: 'QA-AGENDA-1', tipoActor: 'GENERADOR', inspectorId: 'inspector', estado: 'PLANIFICADA', version: 1,
  fechaProgramada: new Date('2030-01-01T12:00:00Z'), items: [], comparaciones: [], evidencias: [] };
const user = { id: 'inspector', rol: 'GENERADOR', esInspector: true };
let stored: any, staged: any;
beforeEach(() => {
  vi.resetAllMocks(); stored = { record: structuredClone(record), notices: [], events: [] }; staged = stored;
  mocks.find.mockImplementation(async () => structuredClone(stored.record)); mocks.full.mockImplementation(async () => structuredClone(stored.record));
  mocks.update.mockImplementation(async ({ where, data }) => {
    if (where.version !== staged.record.version) return { count: 0 };
    Object.assign(staged.record, { ...data, version: staged.record.version + (data.version?.increment || 0) }); return { count: 1 };
  });
  mocks.event.mockImplementation(async ({ data }) => { const row = { ...data, id: 'event-' + (staged.events.length + 1) }; staged.events.push(row); return row; });
  mocks.recipients.mockResolvedValue([{ id: 'admin' }, { id: 'sector' }]);
  mocks.notices.mockImplementation(async ({ data }) => { staged.notices.push(...data); return { count: data.length }; });
  mocks.transaction.mockImplementation(async callback => {
    staged = structuredClone(stored);
    const result = await callback({
      inspeccion: { updateMany: mocks.update, update: vi.fn(async ({ data }) => Object.assign(staged.record, data)), findUniqueOrThrow: vi.fn(async () => structuredClone(staged.record)) },
      eventoInspeccion: { create: mocks.event }, usuario: { findMany: mocks.recipients }, notificacion: { createMany: mocks.notices },
    });
    stored = staged; return result;
  });
});
async function request(handler: typeof actualizarInspeccion, body: unknown) {
  const res = { json: vi.fn() }, next = vi.fn();
  await handler({ params: { id: 'case' }, user, body } as any, res as any, next);
  return { res, next };
}

describe('inspection agenda changes are atomic and actionable', () => {
  it.each([actualizarInspeccion, guardarBorradorInspeccion])('notifies competent staff on date change through %s', async handler => {
    const result = await request(handler, { version: 1, fechaProgramada: '2030-01-03T12:00:00Z', ...(handler === guardarBorradorInspeccion ? { items: [], comparaciones: [] } : {}) });
    expect(result.next).not.toHaveBeenCalled(); expect(stored.notices).toHaveLength(2);
    expect(stored.notices.map((n: any) => n.usuarioId)).toEqual(['admin', 'sector']);
    expect(JSON.parse(stored.notices[0].datos)).toMatchObject({ tipo: 'agenda_inspeccion', evento: 'REPROGRAMADA', inspeccionId: 'case' });
    expect(stored.events.some((event: any) => event.metadata?.fechaAnterior === '2030-01-01T12:00:00.000Z' && event.metadata?.fechaNueva === '2030-01-03T12:00:00.000Z')).toBe(true);
  });
  it.each([undefined, '2030-01-01T12:00:00Z'])('does not announce an unchanged schedule %s', async fechaProgramada => {
    const result = await request(actualizarInspeccion, { version: 1, observaciones: 'QA guardado sin cambio de agenda', ...(fechaProgramada ? { fechaProgramada } : {}) });
    expect(result.next).not.toHaveBeenCalled(); expect(stored.notices).toEqual([]);
  });
  it('records removing the date without inventing a cancellation', async () => {
    const result = await request(actualizarInspeccion, { version: 1, fechaProgramada: null });
    expect(result.next).not.toHaveBeenCalled(); expect(stored.record.estado).toBe('PLANIFICADA');
    expect(stored.notices).toHaveLength(2);
    expect(JSON.parse(stored.notices[0].datos).evento).toBe('AGENDA_RETIRADA');
  });
  it('rolls back a reschedule if notice persistence fails', async () => {
    mocks.notices.mockRejectedValue(new Error('notice failed'));
    const result = await request(actualizarInspeccion, { version: 1, fechaProgramada: '2030-01-03T12:00:00Z' });
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ message: 'notice failed' }));
    expect(stored.record).toEqual(record); expect(stored.events).toEqual([]);
  });
  it('does not announce a stale edit', async () => {
    const result = await request(actualizarInspeccion, { version: 2, fechaProgramada: '2030-01-03T12:00:00Z' });
    expect(result.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 })); expect(stored.notices).toEqual([]);
  });
  it('announces cancellation once and preserves its event history', async () => {
    const first = await request(cambiarEstadoInspeccion, { version: 1, estado: 'CANCELADA', detalle: 'QA cancelación' });
    expect(first.next).not.toHaveBeenCalled(); expect(stored.notices).toHaveLength(2);
    expect(JSON.parse(stored.notices[0].datos).evento).toBe('CANCELADA');
    const second = await request(cambiarEstadoInspeccion, { version: 1, estado: 'CANCELADA', detalle: 'QA cancelación' });
    expect(second.next).not.toHaveBeenCalled(); expect(stored.notices).toHaveLength(2);
  });
});
