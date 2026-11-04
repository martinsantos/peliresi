import { describe, expect, it } from 'vitest';
import { certificateFindings } from '../../domain/certificateFindings';

const report = (cantidad: number, unidad = 'kg') => ({ formato: 'SITREP-INFORME-HALLAZGO-1',
  diferencias: [{ tipo: 'Y_OMITIDA', corriente: 'Y12', unidad, observado: cantidad }] });
const row = (id: string, cantidad: number, decision = 'APROBADA', rectificaId: string | null = null) =>
  ({ id, version: 1, revisiones: [{ decision }], informeHallazgo: report(cantidad), rectificaId });

describe('findings eligible for a signed treatment decision', () => {
  it('does not mistake an observed or pending finding for an approved one', () => {
    expect(certificateFindings([row('a', 1, 'OBSERVADA'), row('b', 2, 'PENDIENTE')]).hallazgos).toEqual([]);
  });
  it('offers the approved rectification once and preserves its source', () => {
    expect(certificateFindings([row('a', 2, 'OBSERVADA'), row('b', 1, 'APROBADA', 'a')])).toEqual({
      hallazgos: [{ id: 'hallazgo:Y12:kg', corriente: 'Y12', unidad: 'kg', observado: 1, adendas: [{ id: 'b', version: 1 }] }], problemas: [],
    });
  });
  it('does not count an approved ancestor and its approved rectification twice', () => {
    expect(certificateFindings([row('a', 2), row('b', 1, 'APROBADA', 'a')]).hallazgos).toHaveLength(1);
    expect(certificateFindings([row('a', 2), row('b', 1, 'APROBADA', 'a')]).hallazgos[0].observado).toBe(1);
  });
  it('does not add independent reports together and blocks conflicting observations', () => {
    const equal = certificateFindings([row('a', 1), row('b', 1)]);
    expect(equal.hallazgos[0].observado).toBe(1);
    expect(equal.hallazgos[0].adendas).toHaveLength(2);
    expect(certificateFindings([row('a', 1), row('b', 2)]).problemas).toHaveLength(1);
  });
  it('normalizes equivalent spellings without converting between units', () => {
    const a = { ...row('a', 1), informeHallazgo: report(1, 'lt') };
    const b = { ...row('b', 1), informeHallazgo: report(1, 'l') };
    expect(certificateFindings([a, b]).hallazgos).toHaveLength(1);
    expect(certificateFindings([a, { ...b, informeHallazgo: report(1, 'kg') }]).hallazgos).toHaveLength(2);
  });
  it('fails closed on corrupt data or a rectification that drops the finding', () => {
    expect(certificateFindings([{ ...row('a', 1), informeHallazgo: { diferencias: [] } }]).problemas).toHaveLength(1);
    expect(certificateFindings([row('a', 1, 'OBSERVADA'), { ...row('b', 1, 'APROBADA', 'a'), informeHallazgo: null }]).problemas).toHaveLength(1);
  });
  it('includes a legacy approved addendum from its preserved declaration and observations', () => {
    const legacy = { ...row('a', 1), informeHallazgo: null,
      declaracion: { residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
      residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }, { corriente: 'Y12', cantidad: 1, unidad: 'kg' }] };
    expect(certificateFindings([legacy]).hallazgos[0]).toMatchObject({ corriente: 'Y12', observado: 1 });
    expect(certificateFindings([legacy]).problemas).toEqual([]);
  });
  it('does not silently certify a report that disagrees with its immutable snapshot', () => {
    const inconsistent = { ...row('a', 1),
      declaracion: { residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
      residuos: [{ corriente: 'Y12', cantidad: 2, unidad: 'kg' }] };
    const result=certificateFindings([inconsistent]);
    expect(result.hallazgos).toEqual([]);
    expect(result.problemas[0]).toContain('no coincide');
  });
  it('does not use orphaned or cyclic rectifications', () => {
    expect(certificateFindings([row('a', 1, 'APROBADA', 'missing')]).hallazgos).toEqual([]);
    expect(certificateFindings([row('a', 1, 'APROBADA', 'b'), row('b', 1, 'APROBADA', 'a')]).hallazgos).toEqual([]);
  });
});
