import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findInspection: vi.fn(),
  findFullInspection: vi.fn(),
  updateInspectionMany: vi.fn(),
  updateItemMany: vi.fn(),
  updateComparisonMany: vi.fn(),
  createEvidence: vi.fn(),
  createEvent: vi.fn(),
  findItem: vi.fn(),
  findDuplicate: vi.fn(),
  countComparison: vi.fn(),
  countEvent: vi.fn(),
  transaction: vi.fn(),
  persist: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: {
    findUnique: mocks.findInspection,
    findUniqueOrThrow: mocks.findFullInspection,
  },
  itemInspeccion: { findFirst: mocks.findItem },
  comparacionInspeccion: { count: mocks.countComparison },
  eventoInspeccion: { count: mocks.countEvent },
  evidenciaInspeccion: { findFirst: mocks.findDuplicate },
  $transaction: mocks.transaction,
} }));
vi.mock('../../services/inspectionEvidence.service', () => ({
  persistInspectionEvidence: mocks.persist,
  removeInspectionEvidence: mocks.remove,
  resolveInspectionEvidence: vi.fn(),
}));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({
  buildDeclaredInspectionSnapshot: vi.fn(),
  ensureInspectionDeclaredComparisons: vi.fn(),
}));
vi.mock('../../services/inspectionActPdf.service', () => ({ streamInspectionTechnicalReportPdf: vi.fn() }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: vi.fn() }));

import {
  actualizarComparaciones,
  actualizarItems,
  cambiarEstadoInspeccion,
  subirEvidencia,
} from '../../controllers/inspeccion.controller';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

function fieldInspection() {
  return {
    id: 'inspection-1',
    inspectorId: 'inspector-1',
    tipoActor: 'GENERADOR',
    estado: 'EN_CAMPO',
    version: 7,
    items: [],
    comparaciones: [],
    evidencias: [],
  };
}

function txWithReservation(count: number) {
  return {
    inspeccion: { updateMany: vi.fn().mockResolvedValue({ count }) },
    itemInspeccion: { updateMany: mocks.updateItemMany },
    comparacionInspeccion: { updateMany: mocks.updateComparisonMany },
    evidenciaInspeccion: { create: mocks.createEvidence, update: vi.fn() },
    eventoInspeccion: { create: mocks.createEvent },
  };
}

describe('inspection authorization and atomic field closure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findInspection.mockResolvedValue(fieldInspection());
    mocks.findFullInspection.mockResolvedValue(fieldInspection());
    mocks.findItem.mockResolvedValue({ codigo: 'SEG-01', etiqueta: 'EPP disponible' });
    mocks.findDuplicate.mockResolvedValue(null);
    mocks.persist.mockResolvedValue({
      storageKey: 'inspecciones/inspection-1/evidence.png',
      mimeType: 'image/png',
      bytes: 10,
      sha256: 'a'.repeat(64),
    });
    mocks.remove.mockResolvedValue(undefined);
  });

  it('authorizes before returning an idempotent same-state response', async () => {
    const next = vi.fn();
    await cambiarEstadoInspeccion({
      params: { id: 'inspection-1' },
      body: { estado: 'EN_CAMPO', version: 7 },
      user: { id: 'inspector-2', rol: 'GENERADOR', esInspector: true },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.findFullInspection).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('does not let a different sector administrator use same-state idempotency as an IDOR', async () => {
    const next = vi.fn();
    await cambiarEstadoInspeccion({
      params: { id: 'inspection-1' },
      body: { estado: 'EN_CAMPO', version: 7 },
      user: { id: 'admin-t', rol: 'ADMIN_TRANSPORTISTA', esInspector: false },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.findFullInspection).not.toHaveBeenCalled();
  });

  it('refuses notification while the act and technical dossier are structurally incomplete', async () => {
    mocks.findInspection.mockResolvedValueOnce({
      ...fieldInspection(),
      estado: 'EN_REVISION',
      numeroActa: 'ACTA-1',
      cerradaCampoAt: new Date('2026-09-22T12:00:00Z'),
      observaciones: 'Hallazgos documentados.',
      datosActa: { area: 'DGFA', motivoInspeccion: 'Control', lugarAfectacion: 'Planta' },
      informeTecnico: { objetivo: 'Verificar' },
      items: [{ id: 'item-1', obligatorio: true, resultado: 'CUMPLE' }],
      comparaciones: [{ id: 'comparison-1', resultado: 'COINCIDE' }],
    });
    const next = vi.fn();

    await cambiarEstadoInspeccion({
      params: { id: 'inspection-1' },
      body: { estado: 'NOTIFICADA', version: 7, plazoRespuestaAt: '2026-10-01T12:00:00.000Z' },
      user: { id: 'admin-g', rol: 'ADMIN_GENERADOR', esInspector: false },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 400,
      message: expect.stringContaining('Complete el expediente antes de notificar'),
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('records a canonical field-act snapshot and hash when the inspector closes field work', async () => {
    mocks.findInspection.mockResolvedValueOnce({
      ...fieldInspection(),
      numero: 'I-2026-000001',
      numeroActa: 'ACTA-1',
      ubicacion: 'Mendoza',
      observaciones: 'Hallazgo constatado.',
      datosActa: { motivoInspeccion: 'Control programado' },
      items: [{ id: 'item-1', codigo: 'SEG-01', obligatorio: true, resultado: 'CUMPLE' }],
      comparaciones: [{ id: 'comparison-1', codigo: 'ID-CUIT', resultado: 'COINCIDE' }],
    });
    const tx = txWithReservation(1);
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
    const next = vi.fn();

    await cambiarEstadoInspeccion({
      params: { id: 'inspection-1' },
      body: { estado: 'EN_REVISION', version: 7 },
      user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
    } as any, response() as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: 'CAMBIO_ESTADO',
        metadata: expect.objectContaining({
          versionBase: 7,
          versionNueva: 8,
          actaSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          actaSnapshot: expect.objectContaining({ numeroActa: 'ACTA-1' }),
        }),
      }),
    }));
  });

  it('rolls back checklist changes when closure wins the parent version reservation', async () => {
    const tx = txWithReservation(0);
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
    const next = vi.fn();

    await actualizarItems({
      params: { id: 'inspection-1' },
      body: { version: 7, items: [{ id: 'item-1', resultado: 'CUMPLE', observacion: 'Verificado' }] },
      user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
    } as any, response() as any, next);

    expect(tx.inspeccion.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'inspection-1', version: 7, estado: expect.any(Object) }),
    }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(mocks.updateItemMany).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it('rolls back declared comparisons when closure wins the parent version reservation', async () => {
    const tx = txWithReservation(0);
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
    const next = vi.fn();

    await actualizarComparaciones({
      params: { id: 'inspection-1' },
      body: { version: 7, comparaciones: [{ id: 'comparison-1', resultado: 'COINCIDE', valorObservado: 'Coincide' }] },
      user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(mocks.updateComparisonMany).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
  });

  it('removes the staged file and creates no evidence when the act closes during upload', async () => {
    const tx = txWithReservation(0);
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx));
    const next = vi.fn();

    await subirEvidencia({
      params: { id: 'inspection-1' },
      body: { itemId: 'item-1' },
      user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
      file: { buffer: Buffer.from('png'), originalname: 'hallazgo.png', mimetype: 'image/png' },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(mocks.createEvidence).not.toHaveBeenCalled();
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith('inspecciones/inspection-1/evidence.png');
  });
});
