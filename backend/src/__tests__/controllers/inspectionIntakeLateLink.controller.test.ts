import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ intake: vi.fn(), inspection: vi.fn(), reserve: vi.fn(), event: vi.fn(), reread: vi.fn(), lock: vi.fn(), signatures: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { $transaction: (fn: any) => fn({
  $queryRaw: m.lock,
  antecedenteFiscalizacion: { findFirst: m.intake, updateMany: m.reserve, findUniqueOrThrow: m.reread },
  inspeccion: { findUnique: m.inspection, findUniqueOrThrow: m.inspection },
  eventoInspeccion: { create: m.event, count: m.signatures },
}) } }));
vi.mock('../../controllers/inspeccion.controller', () => ({ canAccessInspection: () => true }));

import { decideInspectionIntake } from '../../controllers/inspection-intake.controller';
import { eventualLinkRefusal, EVENTUAL_LINK_MESSAGES } from '../../domain/inspectionEventualOrigin';
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
  m.signatures.mockResolvedValue(0);
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

  it('refuses to add an external party during the visit once the act is signed, so the signature is never voided silently', async () => {
    m.signatures.mockResolvedValue(1);
    const { next } = await decide();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409, message: EVENTUAL_LINK_MESSAGES.ACTA_FIRMADA }));
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.event).not.toHaveBeenCalled();
  });

  it('locks the case row before reading signatures, so a link and a signature in flight serialize', async () => {
    await decide();
    expect(m.lock).toHaveBeenCalled();
    expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.signatures.mock.invocationCallOrder[0]);
  });

  it('keeps linking non-eventual antecedents to closed or signed cases, which do not enter the act', async () => {
    m.intake.mockResolvedValue({ ...eventual, origen: 'INFORME_ADENDA', actorId: null });
    m.inspection.mockResolvedValue({ ...fieldCase, estado: 'CERRADA_CONFORME' });
    m.signatures.mockResolvedValue(3);
    const { next } = await decide();
    expect(next).not.toHaveBeenCalled();
    expect(m.lock).not.toHaveBeenCalled();
    expect(eventualLinkRefusal({ origen: 'INFORME_ADENDA' }, { estado: 'CERRADA_CONFORME' }, true)).toBeNull();
    expect(eventualLinkRefusal({ origen: 'PARTICIPANTE_EVENTUAL' }, { estado: 'EN_REVISION' }, false)).toBe('CAMPO_CERRADO');
    expect(eventualLinkRefusal({ origen: 'PARTICIPANTE_EVENTUAL' }, { estado: 'EN_CAMPO' }, true)).toBe('ACTA_FIRMADA');
    expect(eventualLinkRefusal({ origen: 'PARTICIPANTE_EVENTUAL' }, { estado: 'EN_CAMPO' }, false)).toBeNull();
  });

  it('documents why: a new origin changes the signable content, so earlier signatures stop being current', () => {
    const act = { id: 'case', numero: 'QA', numeroActa: 'QA-1', observaciones: 'Obs', ubicacion: 'Lugar', datosActa: {}, items: [], comparaciones: [], evidencias: [] };
    const origin = { origenId: 'ev', referencia: 'BI-ev', tipoActor: 'OPERADOR', actorNombre: 'Externo A' };
    const signed = inspectionSignatureHash({ ...act, antecedentes: [origin] });
    expect(inspectionSignatureHash({ ...act, antecedentes: [origin, { ...origin, tipoActor: 'TRANSPORTISTA', actorNombre: 'Externo B' }] })).not.toBe(signed);
  });
});
