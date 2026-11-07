import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ read: vi.fn(), access: vi.fn(), party: vi.fn(), stream: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { inspeccion: { findUnique: m.read } } }));
vi.mock('../../controllers/inspeccion.controller', () => ({ canAccessInspection: m.access, inspectionActInclude: {} }));
vi.mock('../../services/inspectionExchange.service', () => ({ exchangePartyForUser: m.party }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: m.stream }));
vi.mock('../../services/inspectionEvidence.service', () => ({ resolveInspectionEvidence: vi.fn() }));
vi.mock('../../domain/manifiestoSignature', () => ({ prepareManifiestoSignature: vi.fn() }));

import { previewInspectionSignature, downloadSignedInspectionAct } from '../../controllers/inspectionSignature.controller';

const actor = { id: 'gen', rol: 'GENERADOR' };
const run = async (handler: any, user: any, params: any) => { const next = vi.fn(); await handler({ user, params } as any, { json: vi.fn() } as any, next); return next.mock.calls[0]?.[0]; };

beforeEach(() => { vi.resetAllMocks(); m.access.mockReturnValue(false); m.party.mockReturnValue(null); });

describe('denials do not reveal whether a case exists', () => {
  it('an operational account is refused the act preview before any lookup', async () => {
    m.read.mockResolvedValue({ id: 'case', inspectorId: 'insp', tipoActor: null, eventos: [] });
    const real = await run(previewInspectionSignature, actor, { id: 'case' });
    m.read.mockResolvedValue(null);
    const missing = await run(previewInspectionSignature, actor, { id: 'nope' });
    expect(real).toMatchObject({ statusCode: 403 });
    expect(missing).toMatchObject({ statusCode: 403, message: real.message });
    expect(m.read).not.toHaveBeenCalled();
  });

  it('a third party asking for a signed copy gets the same answer for a foreign and a missing case', async () => {
    m.read.mockResolvedValue({ id: 'case', inspectorId: 'insp', tipoActor: 'GENERADOR', eventos: [] });
    const foreign = await run(downloadSignedInspectionAct, actor, { id: 'case', firmaId: 'x' });
    m.read.mockResolvedValue(null);
    const missing = await run(downloadSignedInspectionAct, actor, { id: 'nope', firmaId: 'x' });
    expect(foreign).toMatchObject({ statusCode: 404 });
    expect(missing).toMatchObject({ statusCode: 404, message: foreign.message });
  });

  it('the inspected party still reaches its signed copy lookup', async () => {
    m.read.mockResolvedValue({ id: 'case', inspectorId: 'insp', tipoActor: 'GENERADOR', eventos: [] });
    m.party.mockReturnValue('INSPECCIONADO');
    const error = await run(downloadSignedInspectionAct, actor, { id: 'case', firmaId: 'unknown' });
    expect(error).toMatchObject({ statusCode: 404, message: 'Copia firmada no encontrada' });
    expect(m.party).toHaveBeenCalled();
  });
});
