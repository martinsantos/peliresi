import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { inspeccion: { findUnique: mocks.findUnique } } }));
vi.mock('../../services/inspectionEvidence.service', () => ({ persistInspectionEvidence: vi.fn(), removeInspectionEvidence: vi.fn(), resolveInspectionEvidence: vi.fn() }));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({ buildDeclaredInspectionSnapshot: vi.fn(), ensureInspectionDeclaredComparisons: vi.fn() }));
vi.mock('../../services/inspectionActPdf.service', () => ({ streamInspectionTechnicalReportPdf: vi.fn() }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: vi.fn() }));

import { verificarInspeccionPublica } from '../../controllers/inspeccion.controller';
import { createInspectionTraceToken } from '../../services/inspectionTraceToken.service';
import { buildInspectionDocumentFingerprint } from '../../services/inspectionDocumentIntegrity.service';

describe('public inspection trace verification', () => {
  beforeEach(() => vi.clearAllMocks());

  function inspectionFixture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'inspection-1', numero: 'I-2026-000001', numeroActa: 'ACTA-1', tipoActor: 'GENERADOR', estado: 'EN_REVISION', version: 3,
      createdAt: new Date('2026-09-22T10:00:00Z'), updatedAt: new Date('2026-09-22T11:00:00Z'),
      inspector: { id: 'inspector-1', nombre: 'Inspectora', apellido: 'QA', email: 'inspectora@dgfa.gob.ar' },
      generador: { id: 'gen-1', razonSocial: 'Empresa Peligrosa S.A.', cuit: '30-12345678-9', domicilio: 'Domicilio sensible 123', telefono: '+54 261 555 1234', email: 'privado@example.com', activo: true },
      transportista: null, operador: null, items: [], comparaciones: [], evidencias: [], eventos: [], intercambios: [],
      ...overrides,
    };
  }

  it('returns only the public verification envelope, never dossier or sensitive actor data', async () => {
    const fixture = inspectionFixture();
    const fingerprint = buildInspectionDocumentFingerprint(fixture);
    const token = createInspectionTraceToken('inspection-1', 'I-2026-000001', 3, fingerprint);
    mocks.findUnique.mockResolvedValue(fixture);
    const res = { json: vi.fn(), set: vi.fn() };
    const next = vi.fn();
    await verificarInspeccionPublica({ params: { token } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.valido).toBe(true);
    expect(body.data).toEqual(expect.objectContaining({ numero: 'I-2026-000001', estado: 'EN_REVISION', verificacion: expect.objectContaining({ huella: fingerprint, estadoVerificacion: 'VIGENTE', versionActual: 3 }) }));
    expect(body.data).not.toHaveProperty('id');
    expect(body.data).not.toHaveProperty('actor');
    expect(body.data).not.toHaveProperty('evidencias');
    expect(body.data).not.toHaveProperty('eventos');
    expect(body.data).not.toHaveProperty('intercambios');
    expect(JSON.stringify(body)).not.toContain('Domicilio sensible');
    expect(JSON.stringify(body)).not.toContain('privado@example.com');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store, max-age=0');
    expect(res.set).toHaveBeenCalledWith('X-Robots-Tag', 'noindex, nofollow, noarchive');
  });

  it('marks an unchanged signed document as historical-authentic after a later version', async () => {
    const original = inspectionFixture();
    const fingerprint = buildInspectionDocumentFingerprint(original);
    const token = createInspectionTraceToken('inspection-1', 'I-2026-000001', 3, fingerprint);
    mocks.findUnique.mockResolvedValue(inspectionFixture({ version: 4, updatedAt: new Date('2026-09-22T12:00:00Z') }));
    const res = { json: vi.fn(), set: vi.fn() };
    await verificarInspeccionPublica({ params: { token } } as any, res as any, vi.fn());
    const verification = res.json.mock.calls[0][0].data.verificacion;
    expect(verification.estadoVerificacion).toBe('HISTORICA_AUTENTICA');
    expect(verification.version).toBe(3);
    expect(verification.versionActual).toBe(4);
    expect(verification.huella).toBe(fingerprint);
  });

  it('does not disclose whether an adulterated token references a real inspection', async () => {
    const token = createInspectionTraceToken('inspection-1', 'I-2026-000001', 3, '0'.repeat(64));
    const [payload, signature] = token.split('.');
    const next = vi.fn();
    await verificarInspeccionPublica({ params: { token: `${payload}.${'a'.repeat(signature.length)}` } } as any, {} as any, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
