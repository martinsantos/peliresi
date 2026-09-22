import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  inspection: vi.fn(),
  item: vi.fn(),
  comparisonCount: vi.fn(),
  eventCount: vi.fn(),
  duplicate: vi.fn(),
  createEvidence: vi.fn(),
  createEvent: vi.fn(),
  updateInspection: vi.fn(),
  updateInspectionMany: vi.fn(),
  updateEvidenceMany: vi.fn(),
  evidenceById: vi.fn(),
  transaction: vi.fn(),
  persist: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findUnique: mocks.inspection },
  itemInspeccion: { findFirst: mocks.item },
  comparacionInspeccion: { count: mocks.comparisonCount },
  eventoInspeccion: { count: mocks.eventCount },
  evidenciaInspeccion: { findFirst: mocks.duplicate, findUniqueOrThrow: mocks.evidenceById },
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

import { anularEvidencia, subirEvidencia } from '../../controllers/inspeccion.controller';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() };
}

function request(body: Record<string, unknown>) {
  return {
    params: { id: 'inspection-1' },
    body,
    user: { id: 'inspector-1', rol: 'INSPECTOR', esInspector: true },
    file: { buffer: Buffer.from('png-bytes'), originalname: 'hallazgo.png', mimetype: 'image/png' },
  } as any;
}

describe('inspection checklist evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.inspection.mockResolvedValue({ inspectorId: 'inspector-1', tipoActor: 'GENERADOR', estado: 'EN_CAMPO', version: 7 });
    mocks.item.mockResolvedValue({ codigo: 'SEG-02', etiqueta: 'Señalización y elementos de emergencia operativos' });
    mocks.duplicate.mockResolvedValue(null);
    mocks.persist.mockResolvedValue({ storageKey: 'inspecciones/inspection-1/evidence.png', mimeType: 'image/png', bytes: 9, sha256: 'sha-qa' });
    mocks.createEvidence.mockResolvedValue({ id: 'evidence-1', itemId: 'item-1', tipo: 'FOTO' });
    mocks.updateInspectionMany.mockResolvedValue({ count: 1 });
    mocks.updateEvidenceMany.mockResolvedValue({ count: 1 });
    mocks.evidenceById.mockResolvedValue({
      id: 'evidence-1',
      nombreOriginal: 'hallazgo.png',
      anuladaAt: new Date('2026-09-21T12:00:00Z'),
      motivoAnulacion: 'La captura quedó movida y no representa el hallazgo.',
      creadoPor: { id: 'inspector-1', nombre: 'Inspectora', apellido: 'QA' },
      anuladaPor: { id: 'inspector-1', nombre: 'Inspectora', apellido: 'QA' },
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      evidenciaInspeccion: { create: mocks.createEvidence },
      eventoInspeccion: { create: mocks.createEvent },
      inspeccion: { updateMany: mocks.updateInspectionMany },
    }));
  });

  it('annuls evidence without deleting the file and records the reason atomically', async () => {
    const reason = 'La captura quedó movida y no representa el hallazgo.';
    mocks.inspection.mockResolvedValueOnce({ id: 'inspection-1', inspectorId: 'inspector-1', estado: 'EN_CAMPO', version: 7 });
    mocks.duplicate.mockResolvedValueOnce({ id: 'evidence-1', nombreOriginal: 'hallazgo.png', anuladaAt: null, motivoAnulacion: null });
    mocks.transaction.mockImplementationOnce(async (callback) => callback({
      inspeccion: { updateMany: mocks.updateInspectionMany },
      evidenciaInspeccion: { updateMany: mocks.updateEvidenceMany },
      eventoInspeccion: { create: mocks.createEvent },
    }));
    const req = {
      params: { id: 'inspection-1', evidenciaId: 'evidence-1' },
      body: { version: 7, motivo: reason },
      user: { id: 'inspector-1', rol: 'INSPECTOR', esInspector: true },
    } as any;
    const res = response();
    const next = vi.fn();

    await anularEvidencia(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.updateInspectionMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'inspection-1', version: 7 }) }));
    expect(mocks.updateEvidenceMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evidence-1', inspeccionId: 'inspection-1', anuladaAt: null },
      data: expect.objectContaining({ anuladaPorId: 'inspector-1', motivoAnulacion: reason }),
    }));
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tipo: 'EVIDENCIA_ANULADA', metadata: { evidenciaId: 'evidence-1', archivoPreservado: true } }),
    }));
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('permanecen preservados') }));
  });

  it('persists an image against the selected checklist item and records traceability', async () => {
    const res = response();
    const next = vi.fn();

    await subirEvidencia(request({ itemId: 'item-1', descripcion: 'Falta completar la señalización' }), res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.item).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'item-1', inspeccionId: 'inspection-1' } }));
    expect(mocks.createEvidence).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ itemId: 'item-1', tipo: 'FOTO', descripcion: 'Falta completar la señalización' }) }));
    expect(mocks.updateInspectionMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'inspection-1', version: 7, estado: expect.any(Object) }),
    }));
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ titulo: 'Evidencia vinculada a SEG-02' }) }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects ambiguous evidence linked to two parts of the expediente', async () => {
    const next = vi.fn();
    await subirEvidencia(request({ itemId: 'item-1', comparacionId: 'comparison-1' }), response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.createEvidence).not.toHaveBeenCalled();
  });

  it('returns an already synchronized client capture without persisting it twice', async () => {
    mocks.duplicate.mockResolvedValueOnce({ id: 'evidence-existing', clienteId: 'capture_12345678', itemId: 'item-1' });
    const res = response();
    const next = vi.fn();

    await subirEvidencia(request({ itemId: 'item-1', clienteId: 'capture_12345678' }), res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 'evidence-existing' }) }));
  });
});
