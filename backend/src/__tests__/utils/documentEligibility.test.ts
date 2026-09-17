import { describe, expect, it } from 'vitest';
import { satisfiesDocumentRequirement } from '../../utils/documentEligibility';
const now = new Date('2026-09-05T12:00:00Z');
const requirement = { tipo: 'LICENCIA_CONDUCIR', requiereVigencia: true, requiereFrenteDorso: false };
const evidence = { tipo: requirement.tipo, archivoId: 'file-1', estado: 'APROBADO', estadoScan: 'LIMPIO', vigenteDesde: new Date('2026-01-01'), vigenteHasta: new Date('2027-01-01') };
describe('document readiness', () => {
  it('accepts approved scanned current documents', () => expect(satisfiesDocumentRequirement(requirement, [evidence], now)).toBe(true));
  it.each([
    { estado: 'PENDIENTE' }, { estado: 'RECHAZADO' }, { estadoScan: 'CUARENTENA' }, { estadoScan: 'RECHAZADO' },
    { archivoId: null }, { vigenteDesde: new Date('2026-10-01') }, { vigenteHasta: now }, { vigenteDesde: null }, { vigenteHasta: null },
  ])('rejects invalid evidence %j', invalid => expect(satisfiesDocumentRequirement(requirement, [{ ...evidence, ...invalid }], now)).toBe(false));
  it('requires separate clean files for both faces when policy requires them', () => {
    const req = { ...requirement, requiereFrenteDorso: true };
    const front = { ...evidence, cara: 'FRENTE' };
    expect(satisfiesDocumentRequirement(req, [front], now)).toBe(false);
    expect(satisfiesDocumentRequirement(req, [front, { ...front, cara: 'DORSO' }], now)).toBe(false);
    expect(satisfiesDocumentRequirement(req, [front, { ...front, archivoId: 'file-2', cara: 'DORSO' }], now)).toBe(true);
  });
  it('allows pending review only at submission, never rejected evidence', () => {
    expect(satisfiesDocumentRequirement(requirement, [{ ...evidence, estado: 'PENDIENTE' }], now, false)).toBe(true);
    expect(satisfiesDocumentRequirement(requirement, [{ ...evidence, estado: 'RECHAZADO' }], now, false)).toBe(false);
  });
});
