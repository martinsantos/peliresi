import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ intake: vi.fn(), inspection: vi.fn(), reserve: vi.fn(), event: vi.fn(), reread: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: (fn: any) => fn({
  antecedenteFiscalizacion: { findFirst: m.intake, updateMany: m.reserve, findUniqueOrThrow: m.reread },
  inspeccion: { findUnique: m.inspection },
  eventoInspeccion: { create: m.event },
}) } }));
vi.mock('../../controllers/inspeccion.controller', () => ({ canAccessInspection: () => true }));

import { decideInspectionIntake } from '../../controllers/inspection-intake.controller';
import { eventualLinkAllowed } from '../../domain/inspectionEventualOrigin';
import { inspectionSignatureHash } from '../../domain/inspectionSignature';

const eventual = { id: 'a'.repeat(64), origen: 'PARTICIPANTE_EVENTUAL', origenId: 'ev', referencia: 'BI-ev', tipoActor: 'TRANSPORTISTA', actorId: null, actorNombre: 'Externo de práctica', estado: 'PENDIENTE', version: 0, eventos: [], huellaEvidencia: 'h' };
const fieldCase = { id: 'case', estado: 'EN_CAMPO', inspectorId: 'insp', tipoActor: null, generadorId: null, transportistaId: null, operadorId: null };
const command = { id: '123e4567-e89b-42d3-a456-426614174000', version: 0, accion: 'VINCULADA', motivo: 'Segunda parte externa', inspeccionId: 'case' };

async function decide(body = command) {
  const next = vi.fn(), json = vi.fn();
  await decideInspectionIntake({ params: { antecedenteId: eventual.id }, user: { id: 'chief', rol: 'ADMIN' }, body } as any, { json } as any, next);
  return { next, json };
}

beforeEach(() => {
  vi.resetAllMocks();
  m.intake.mockResolvedValue(eventual);
  m.inspection.mockResolvedValue(fieldCase);
  m.reserve.mockResolvedValue({ count: 1 });
  m.reread.mockResolvedValue({ ...eventual, estado: 'VINCULADA' });
});

describe('late link of a declared external party', () => {
  it('links while the field stage is open', async () => {
    const { next, json } = await decide();
    expect(next).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalled();
    expect(m.reserve).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ inspeccionId: 'case' }) }));
  });

  for (const estado of ['EN_REVISION', 'NOTIFICADA', 'CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA']) {
    it(`refuses to add an external party to a case in ${estado}, leaving the act and its signatures untouched`, async () => {
      m.inspection.mockResolvedValue({ ...fieldCase, estado });
      const { next } = await decide();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
      expect(m.reserve).not.toHaveBeenCalled();
      expect(m.event).not.toHaveBeenCalled();
    });
  }

  it('keeps linking non-eventual antecedents to closed cases, which do not enter the act', () => {
    expect(eventualLinkAllowed({ origen: 'INFORME_ADENDA' }, { estado: 'CERRADA_CONFORME' })).toBe(true);
    expect(eventualLinkAllowed({ origen: 'PARTICIPANTE_EVENTUAL' }, { estado: 'EN_REVISION' })).toBe(false);
  });

  it('documents why: a new origin changes the signable content, so earlier signatures stop being current', () => {
    const act = { id: 'case', numero: 'QA', numeroActa: 'QA-1', observaciones: 'Obs', ubicacion: 'Lugar', datosActa: {}, items: [], comparaciones: [], evidencias: [] };
    const origin = { origenId: 'ev', referencia: 'BI-ev', tipoActor: 'OPERADOR', actorNombre: 'Externo A' };
    const signed = inspectionSignatureHash({ ...act, antecedentes: [origin] });
    expect(inspectionSignatureHash({ ...act, antecedentes: [origin, { ...origin, tipoActor: 'TRANSPORTISTA', actorNombre: 'Externo B' }] })).not.toBe(signed);
  });
});
