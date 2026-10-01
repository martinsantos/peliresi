import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), render: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { inspeccion: { findUnique: mocks.find } } }));
vi.mock('../../services/inspectionActPdf.service', () => ({
  streamInspectionDossierPdf: mocks.render, streamInspectionTechnicalReportPdf: vi.fn(),
}));
import { generarExpedienteInspeccionPdf } from '../../controllers/inspeccion.controller';

const row = { id: 'case-1', inspectorId: 'inspector-1', tipoActor: null, version: 3 };
beforeEach(() => { vi.clearAllMocks(); mocks.find.mockResolvedValue(row); });

describe('unified inspection PDF access', () => {
  it.each([
    { id: 'admin-1', rol: 'ADMIN' },
    { id: 'inspector-1', rol: 'GENERADOR', esInspector: true },
  ])('exports only the canonical server dossier for an authorized user %j', async (user) => {
    const next = vi.fn(); const res = {};
    await generarExpedienteInspeccionPdf({ user, params: { id: row.id } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(mocks.render).toHaveBeenCalledWith(res, row, expect.any(Function));
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: row.id }, include: expect.objectContaining({ evidencias: expect.anything(), inspector: expect.anything() }) }));
  });
  it.each([
    { id: 'other', rol: 'GENERADOR', esInspector: false },
    { id: 'other', rol: 'GENERADOR', esInspector: true },
    { id: 'other', rol: 'ADMIN_GENERADOR', esInspector: true },
  ])('does not expose the PDF to out-of-scope users %j', async (user) => {
    const next = vi.fn();
    await generarExpedienteInspeccionPdf({ user, params: { id: row.id } } as any, {} as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it('returns not found without rendering a missing case', async () => {
    mocks.find.mockResolvedValue(null); const next = vi.fn();
    await generarExpedienteInspeccionPdf({ user: { id: 'admin', rol: 'ADMIN' }, params: { id: row.id } } as any, {} as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(404);
    expect(mocks.render).not.toHaveBeenCalled();
  });
});
