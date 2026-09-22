import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findInspection: vi.fn(),
  findFullInspection: vi.fn(),
  updateInspection: vi.fn(),
  createEvent: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma', () => ({
  default: {
    inspeccion: {
      findUnique: mocks.findInspection,
      findUniqueOrThrow: mocks.findFullInspection,
      updateMany: mocks.updateInspection,
    },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../../services/inspectionEvidence.service', () => ({
  persistInspectionEvidence: vi.fn(),
  removeInspectionEvidence: vi.fn(),
  resolveInspectionEvidence: vi.fn(),
}));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({
  buildDeclaredInspectionSnapshot: vi.fn(),
  ensureInspectionDeclaredComparisons: vi.fn(),
}));
vi.mock('../../services/inspectionActPdf.service', () => ({
  streamInspectionTechnicalReportPdf: vi.fn(),
}));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({
  streamInspectionActPdf: vi.fn(),
}));

import {
  actualizarInformeTecnico,
  actualizarInspeccion,
} from '../../controllers/inspeccion.controller';

function response() {
  return { json: vi.fn() };
}

function inspectionRequest(
  body: Record<string, unknown>,
  user: Record<string, unknown> = { id: 'inspector-1', rol: 'INSPECTOR', esInspector: true },
) {
  return {
    params: { id: 'inspection-1' },
    body,
    user,
  } as any;
}

describe('inspection evidentiary-flow invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findInspection.mockResolvedValue({
      id: 'inspection-1',
      inspectorId: 'inspector-1',
      estado: 'EN_REVISION',
      version: 7,
      tipoActor: 'GENERADOR',
    });
    mocks.updateInspection.mockResolvedValue({ count: 1 });
    mocks.createEvent.mockResolvedValue({ id: 'event-1' });
    mocks.findFullInspection.mockResolvedValue({
      id: 'inspection-1',
      estado: 'EN_REVISION',
      version: 8,
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      inspeccion: { updateMany: mocks.updateInspection },
      eventoInspeccion: { create: mocks.createEvent },
    }));
  });

  it.each(['EN_REVISION', 'NOTIFICADA', 'CERRADA_CONFORME'])(
    'keeps the field act immutable after field closure (%s)',
    async (estado) => {
      mocks.findInspection.mockResolvedValueOnce({
        inspectorId: 'inspector-1',
        estado,
        version: 7,
      });
      const next = vi.fn();

      await actualizarInspeccion(
        inspectionRequest({
          version: 7,
          datosActa: { motivoInspeccion: 'Texto alterado después del cierre de campo.' },
        }),
        response() as any,
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('ya no admite cambios de campo'),
      }));
      expect(mocks.updateInspection).not.toHaveBeenCalled();
      expect(mocks.findFullInspection).not.toHaveBeenCalled();
    },
  );

  it.each(['EN_CAMPO', 'NOTIFICADA', 'DERIVADA_LEGALES', 'FINALIZADA'])(
    'allows no technical-report mutation outside EN_REVISION (%s)',
    async (estado) => {
      mocks.findInspection.mockResolvedValueOnce({
        id: 'inspection-1',
        inspectorId: 'inspector-1',
        estado,
        version: 7,
        tipoActor: 'GENERADOR',
      });
      const next = vi.fn();

      await actualizarInformeTecnico(
        inspectionRequest({
          version: 7,
          informeTecnico: { conclusion: 'Intento fuera de la etapa autorizada.' },
        }),
        response() as any,
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        statusCode: 409,
        message: expect.stringContaining('solo puede editarse durante la revision'),
      }));
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it('rejects a stale report version atomically and writes no traceability event', async () => {
    mocks.updateInspection.mockResolvedValueOnce({ count: 0 });
    const next = vi.fn();

    await actualizarInformeTecnico(
      inspectionRequest({
        version: 6,
        informeTecnico: { conclusion: 'Versión basada en una lectura desactualizada.' },
      }),
      response() as any,
      next,
    );

    expect(mocks.updateInspection).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inspection-1', version: 6, estado: 'EN_REVISION' },
    }));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 409,
      message: expect.stringContaining('otro dispositivo'),
    }));
    expect(mocks.createEvent).not.toHaveBeenCalled();
    expect(mocks.findFullInspection).not.toHaveBeenCalled();
  });

  it('prevents an unassigned inspector from altering the technical report', async () => {
    const next = vi.fn();

    await actualizarInformeTecnico(
      inspectionRequest(
        { version: 7, informeTecnico: { evaluacion: 'Edición no autorizada.' } },
        { id: 'inspector-2', rol: 'INSPECTOR', esInspector: true },
      ),
      response() as any,
      next,
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('lets the competent sector reviewer version only the technical report', async () => {
    const res = response();
    const next = vi.fn();

    await actualizarInformeTecnico(
      inspectionRequest(
        {
          version: 7,
          informeTecnico: {
            evaluacion: 'Evaluación técnica revisada por el sector competente.',
            recomendacion: 'Remitir el expediente completo a Legales.',
          },
        },
        { id: 'admin-generador', rol: 'ADMIN_GENERADOR', esInspector: false },
      ),
      res as any,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(mocks.updateInspection).toHaveBeenCalledWith({
      where: { id: 'inspection-1', version: 7, estado: 'EN_REVISION' },
      data: {
        informeTecnico: {
          evaluacion: 'Evaluación técnica revisada por el sector competente.',
          recomendacion: 'Remitir el expediente completo a Legales.',
        },
        version: { increment: 1 },
      },
    });
    expect(mocks.updateInspection.mock.calls[0]?.[0]?.data).not.toHaveProperty('datosActa');
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tipo: 'INFORME_TECNICO_ACTUALIZADO',
        usuarioId: 'admin-generador',
        metadata: expect.objectContaining({
          versionBase: 7,
          versionNueva: 8,
          contenidoSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }),
    }));
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ version: 8 }),
    });
  });
});
