import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findInspection: vi.fn(),
  transaction: vi.fn(),
  reserve: vi.fn(),
  updateMetadata: vi.fn(),
  countItems: vi.fn(),
  findComparisons: vi.fn(),
  updateItem: vi.fn(),
  updateComparison: vi.fn(),
  createEvent: vi.fn(),
  readSaved: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: mocks.findInspection },
  $transaction: mocks.transaction,
} }));
vi.mock('../../services/inspectionEvidence.service', () => ({
  persistInspectionEvidence: vi.fn(), removeInspectionEvidence: vi.fn(), resolveInspectionEvidence: vi.fn(),
}));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({
  buildDeclaredInspectionSnapshot: vi.fn(), ensureInspectionDeclaredComparisons: vi.fn(),
}));
vi.mock('../../services/inspectionActPdf.service', () => ({ streamInspectionTechnicalReportPdf: vi.fn() }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: vi.fn() }));

import { guardarBorradorInspeccion } from '../../controllers/inspeccion.controller';

type Row = Record<string, any>;
type StoredDraft = { inspection: Row; items: Row[]; comparaciones: Row[]; eventos: Row[] };
let stored: StoredDraft;
let staged: StoredDraft;

const inspector = { id: 'inspector-1', rol: 'GENERADOR', esInspector: true };
const payload = () => ({
  version: 7,
  numeroActa: 'ACTA-22',
  ubicacion: 'Mendoza',
  observaciones: 'Relevamiento completo',
  datosActa: { motivoInspeccion: 'Control programado' },
  fechaProgramada: '2026-09-22T12:00:00.000Z',
  items: [{ id: 'item-1', resultado: 'CUMPLE', observacion: 'Verificado' }],
  comparaciones: [{ id: 'comparison-1', resultado: 'COINCIDE', valorObservado: 'Correcto', observacion: '' }],
});

async function save(body: unknown = payload(), user: Row = inspector) {
  const res = { json: vi.fn() };
  const next = vi.fn();
  await guardarBorradorInspeccion({ params: { id: 'inspection-1' }, body, user } as any, res as any, next);
  return { res, next };
}

function countOwned(rows: Row[], where: Row) {
  return rows.filter((row) => row.inspeccionId === where.inspeccionId && where.id.in.includes(row.id)).length;
}

function updateOwned(rows: Row[], { where, data }: Row) {
  const target = rows.find((row) => row.id === where.id && row.inspeccionId === where.inspeccionId);
  if (!target) return { count: 0 };
  Object.assign(target, data);
  return { count: 1 };
}

describe('atomic inspection draft save', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    stored = {
      inspection: { id: 'inspection-1', inspectorId: 'inspector-1', tipoActor: 'GENERADOR', estado: 'EN_CAMPO', version: 7, observaciones: 'Anterior' },
      items: [
        { id: 'item-1', inspeccionId: 'inspection-1', resultado: 'PENDIENTE' },
        { id: 'foreign-item', inspeccionId: 'inspection-2', resultado: 'PENDIENTE' },
      ],
      comparaciones: [
        { id: 'comparison-1', inspeccionId: 'inspection-1', resultado: 'PENDIENTE' },
        { id: 'foreign-comparison', inspeccionId: 'inspection-2', resultado: 'PENDIENTE' },
      ],
      eventos: [],
    };
    mocks.findInspection.mockImplementation(async () => ({ ...stored.inspection }));
    mocks.reserve.mockImplementation(async ({ where, data }) => {
      if (staged.inspection.id !== where.id || staged.inspection.version !== where.version || !where.estado.in.includes(staged.inspection.estado)) return { count: 0 };
      staged.inspection.version += data.version.increment;
      return { count: 1 };
    });
    mocks.updateMetadata.mockImplementation(async ({ data }) => Object.assign(staged.inspection, data));
    mocks.countItems.mockImplementation(async ({ where }) => countOwned(staged.items, where));
    mocks.findComparisons.mockImplementation(async ({ where }) => structuredClone(staged.comparaciones.filter((row) => row.inspeccionId === where.inspeccionId && where.id.in.includes(row.id))));
    mocks.updateItem.mockImplementation(async (args) => updateOwned(staged.items, args));
    mocks.updateComparison.mockImplementation(async (args) => updateOwned(staged.comparaciones, args));
    mocks.createEvent.mockImplementation(async ({ data }) => {
      staged.eventos.push(data);
      return data;
    });
    mocks.readSaved.mockImplementation(async () => structuredClone({ ...staged.inspection, items: staged.items.filter((row) => row.inspeccionId === 'inspection-1'), comparaciones: staged.comparaciones.filter((row) => row.inspeccionId === 'inspection-1'), eventos: staged.eventos }));
    mocks.transaction.mockImplementation(async (callback) => {
      // Commit only a successful callback, as Prisma does. Failed callbacks
      // discard the staged writes, including version reservation and audit.
      staged = structuredClone(stored);
      const result = await callback({
        inspeccion: { updateMany: mocks.reserve, update: mocks.updateMetadata, findUniqueOrThrow: mocks.readSaved },
        itemInspeccion: { count: mocks.countItems, updateMany: mocks.updateItem },
        comparacionInspeccion: { findMany: mocks.findComparisons, updateMany: mocks.updateComparison },
        eventoInspeccion: { create: mocks.createEvent },
      });
      stored = staged;
      return result;
    });
  });

  it('commits metadata, checklist and comparisons with one version and one audit event', async () => {
    const { res, next } = await save();

    expect(next).not.toHaveBeenCalled();
    expect(stored.inspection).toMatchObject({ version: 8, numeroActa: 'ACTA-22', observaciones: 'Relevamiento completo', datosActa: { motivoInspeccion: 'Control programado' }, fechaProgramada: new Date('2026-09-22T12:00:00.000Z') });
    expect(stored.items[0]).toMatchObject({ resultado: 'CUMPLE', observacion: 'Verificado' });
    expect(stored.comparaciones[0]).toMatchObject({ resultado: 'COINCIDE', valorObservado: 'Correcto', observacion: null, verificadoPorId: 'inspector-1', verificadoAt: expect.any(Date) });
    expect(stored.items[1].resultado).toBe('PENDIENTE');
    expect(stored.comparaciones[1].resultado).toBe('PENDIENTE');
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
    expect(stored.eventos).toHaveLength(1);
    expect(stored.eventos[0]).toMatchObject({ tipo: 'BORRADOR_ACTUALIZADO', usuarioId: 'inspector-1', metadata: { versionBase: 7, versionNueva: 8 } });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ version: 8, items: [expect.objectContaining({ resultado: 'CUMPLE' })] }) });
  });

  it.each(['ADMIN', 'ADMIN_GENERADOR'])('permits the competent administrator %s', async (rol) => {
    const { next } = await save(payload(), { id: 'admin-1', rol, esInspector: false });
    expect(next).not.toHaveBeenCalled();
    expect(stored.inspection.version).toBe(8);
  });

  it.each([inspector, { id: 'admin-1', rol: 'ADMIN_GENERADOR', esInspector: false }])('preserves the original verification when $id saves unchanged comparison content', async (user) => {
    Object.assign(stored.comparaciones[0], payload().comparaciones[0], {
      observacion: null,
      verificadoPorId: 'inspector-1',
      verificadoAt: new Date('2026-09-20T12:00:00.000Z'),
      updatedAt: new Date('2026-09-20T12:00:00.000Z'),
    });
    const comparisonBefore = structuredClone(stored.comparaciones[0]);

    const { next } = await save(payload(), user);

    expect(next).not.toHaveBeenCalled();
    expect(stored.inspection.version).toBe(8);
    expect(stored.comparaciones[0]).toEqual(comparisonBefore);
    expect(mocks.updateComparison).not.toHaveBeenCalled();
  });

  it.each([
    { resultado: 'DIFIERE' },
    { valorObservado: 'Valor corregido' },
    { observacion: 'Observacion agregada' },
  ])('attributes a changed comparison to the actual editor: %j', async (change) => {
    const previousVerification = new Date('2026-09-20T12:00:00.000Z');
    Object.assign(stored.comparaciones[0], payload().comparaciones[0], {
      observacion: null,
      verificadoPorId: 'inspector-1',
      verificadoAt: previousVerification,
    });
    const body = payload();
    Object.assign(body.comparaciones[0], change);

    const { next } = await save(body, { id: 'admin-1', rol: 'ADMIN_GENERADOR', esInspector: false });

    expect(next).not.toHaveBeenCalled();
    expect(stored.comparaciones[0]).toMatchObject({ ...change, verificadoPorId: 'admin-1', verificadoAt: expect.any(Date) });
    expect(stored.comparaciones[0].verificadoAt.getTime()).toBeGreaterThan(previousVerification.getTime());
    expect(mocks.updateComparison).toHaveBeenCalledTimes(1);
  });

  it('clears the prior verification when a comparison is changed back to pending', async () => {
    Object.assign(stored.comparaciones[0], payload().comparaciones[0], {
      verificadoPorId: 'inspector-1',
      verificadoAt: new Date('2026-09-20T12:00:00.000Z'),
    });
    const body = payload();
    body.comparaciones[0].resultado = 'PENDIENTE';

    const { next } = await save(body, { id: 'admin-1', rol: 'ADMIN_GENERADOR', esInspector: false });

    expect(next).not.toHaveBeenCalled();
    expect(stored.comparaciones[0]).toMatchObject({ resultado: 'PENDIENTE', verificadoPorId: null, verificadoAt: null });
  });

  it.each([
    { id: 'inspector-1', rol: 'GENERADOR', esInspector: false },
    { id: 'inspector-1', rol: 'TRANSPORTISTA', esInspector: false },
    { id: 'inspector-1', rol: 'OPERADOR', esInspector: false },
    { id: 'inspector-other', rol: 'GENERADOR', esInspector: true },
    { id: 'admin-1', rol: 'ADMIN_TRANSPORTISTA', esInspector: true },
    { id: 'admin-1', rol: 'ADMIN_OPERADOR', esInspector: false },
  ])('rejects an actor, unassigned inspector or administrator from another sector: $rol/$id', async (user) => {
    const { next } = await save(payload(), user);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(['EN_REVISION', 'NOTIFICADA', 'CANCELADA'])('rejects changes after field closure: %s', async (estado) => {
    stored.inspection.estado = estado;
    const { next } = await save();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects replay of a successfully saved old version without overwriting newer data', async () => {
    await save();
    const committed = structuredClone(stored);
    const { next } = await save({ ...payload(), observaciones: 'Sobrescritura' });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(stored).toEqual(committed);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects a concurrent version or field-state change before any content writes', async () => {
    mocks.reserve.mockResolvedValueOnce({ count: 0 });
    const before = structuredClone(stored);
    const { next } = await save();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(stored).toEqual(before);
    expect(mocks.updateMetadata).not.toHaveBeenCalled();
    expect(mocks.updateItem).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it.each(['items', 'comparaciones'] as const)('rejects a foreign %s target and preserves metadata, rows and version', async (key) => {
    const before = structuredClone(stored);
    const body = payload();
    body[key][0].id = key === 'items' ? 'foreign-item' : 'foreign-comparison';
    const { next } = await save(body);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(stored).toEqual(before);
    expect(mocks.updateMetadata).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it.each(['updateComparison', 'createEvent', 'readSaved'] as const)('rolls back all writes when %s fails inside the transaction', async (operation) => {
    const failure = new Error('Simulated transaction failure');
    mocks[operation].mockRejectedValueOnce(failure);
    const before = structuredClone(stored);
    const { res, next } = await save();
    expect(mocks.updateMetadata).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(failure);
    expect(res.json).not.toHaveBeenCalled();
    expect(stored).toEqual(before);
  });

  it('rolls back if a target disappears after ownership validation', async () => {
    mocks.updateComparison.mockResolvedValueOnce({ count: 0 });
    const before = structuredClone(stored);
    const { next } = await save();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(stored).toEqual(before);
  });

  it('accepts empty row arrays for metadata-only drafts', async () => {
    const { next } = await save({ ...payload(), items: [], comparaciones: [] });
    expect(next).not.toHaveBeenCalled();
    expect(stored.inspection.version).toBe(8);
    expect(mocks.updateItem).not.toHaveBeenCalled();
    expect(mocks.updateComparison).not.toHaveBeenCalled();
  });

  it.each([
    () => ({ ...payload(), items: [...payload().items, ...payload().items] }),
    () => ({ ...payload(), comparaciones: [...payload().comparaciones, ...payload().comparaciones] }),
    () => ({ ...payload(), items: Array.from({ length: 101 }, (_, i) => ({ id: `item-${i}`, resultado: 'CUMPLE' })) }),
    () => ({ ...payload(), comparaciones: Array.from({ length: 101 }, (_, i) => ({ id: `comparison-${i}`, resultado: 'COINCIDE' })) }),
    () => ({ ...payload(), version: 0 }),
    () => ({ ...payload(), datosActa: { infraestructura: 'INVALIDO' } }),
    () => ({ ...payload(), items: [{ id: 'item-1', resultado: 'INVALIDO' }] }),
  ])('validates the entire payload before entering a transaction (%#)', async (invalidBody) => {
    const { next } = await save(invalidBody());
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ name: 'ZodError' }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
