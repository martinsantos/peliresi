import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findInspection: vi.fn(),
  findFullInspection: vi.fn(),
  updateInspection: vi.fn(),
  createEvent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: {
    findUnique: mocks.findInspection,
    findUniqueOrThrow: mocks.findFullInspection,
  },
  $transaction: mocks.transaction,
} }));
vi.mock('../../services/inspectionEvidence.service', () => ({
  persistInspectionEvidence: vi.fn(),
  removeInspectionEvidence: vi.fn(),
  resolveInspectionEvidence: vi.fn(),
}));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({
  buildDeclaredInspectionSnapshot: vi.fn(),
  ensureInspectionDeclaredComparisons: vi.fn(),
}));
vi.mock('../../services/inspectionActPdf.service', () => ({ streamInspectionTechnicalReportPdf: vi.fn() }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: vi.fn() }));

import { actualizarInformeTecnico } from '../../controllers/inspeccion.controller';

function response() {
  return { json: vi.fn() };
}

describe('inspection technical report review editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findInspection.mockResolvedValue({
      id: 'inspection-1',
      inspectorId: 'inspector-1',
      estado: 'EN_REVISION',
      version: 9,
      tipoActor: 'GENERADOR',
    });
    mocks.updateInspection.mockResolvedValue({ count: 1 });
    mocks.createEvent.mockResolvedValue({ id: 'event-1' });
    mocks.findFullInspection.mockResolvedValue({ id: 'inspection-1', version: 10, estado: 'EN_REVISION' });
    mocks.transaction.mockImplementation(async (callback) => callback({
      inspeccion: { updateMany: mocks.updateInspection },
      eventoInspeccion: { create: mocks.createEvent },
    }));
  });

  it('versions the post-field report without reopening the field act', async () => {
    const req = {
      params: { id: 'inspection-1' },
      body: {
        version: 9,
        informeTecnico: {
          objetivo: 'Evaluar la situación constatada.',
          evaluacion: 'Se contrastó el acta con las evidencias incorporadas.',
          conclusion: 'La evaluación queda documentada para dictamen.',
          recomendacion: 'Remitir junto con el acta a Legales.',
        },
      },
      user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
    } as any;
    const res = response();
    const next = vi.fn();

    await actualizarInformeTecnico(req, res as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.updateInspection).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inspection-1', version: 9, estado: 'EN_REVISION' },
      data: expect.objectContaining({ version: { increment: 1 } }),
    }));
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: 'INFORME_TECNICO_ACTUALIZADO',
        metadata: expect.objectContaining({
          versionBase: 9,
          versionNueva: 10,
          contenidoSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          snapshot: expect.objectContaining({ objetivo: 'Evaluar la situación constatada.' }),
        }),
        visibleActor: false,
      }),
    }));
    expect(res.json).toHaveBeenCalledWith({ success: true, data: expect.objectContaining({ version: 10 }) });
  });

  it('rejects report edits before the field act reaches review', async () => {
    mocks.findInspection.mockResolvedValueOnce({
      id: 'inspection-1', inspectorId: 'inspector-1', estado: 'EN_CAMPO', version: 9, tipoActor: 'GENERADOR',
    });
    const next = vi.fn();

    await actualizarInformeTecnico({
      params: { id: 'inspection-1' }, body: { version: 9, informeTecnico: {} },
      user: { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('prevents an administrator from another sector from editing the report', async () => {
    const next = vi.fn();

    await actualizarInformeTecnico({
      params: { id: 'inspection-1' }, body: { version: 9, informeTecnico: {} },
      user: { id: 'admin-transport', rol: 'ADMIN_TRANSPORTISTA', esInspector: false },
    } as any, response() as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
