import {describe,expect,it} from 'vitest';
import {formatReportQuantities} from '../../utils/report-quantities';
describe('report quantities do not invent conversions',()=>{
  it('sums only within the same declared unit',()=>{
    expect(formatReportQuantities([{residuos:[{cantidad:2,unidad:'L'},{cantidad:5,unidad:'kg'}]},{residuos:[{cantidad:3,unidad:'L'}]}])).toBe('5 L · 5 kg');
  });
  it('does not replace a missing unit with kg',()=>{
    expect(formatReportQuantities([{residuos:[{cantidad:'2.5',unidad:null}]}])).toBe('2,5 sin unidad');
  });
  it('does not silently ignore an invalid amount and present a partial total',()=>{
    expect(formatReportQuantities([{residuos:[{cantidad:2,unidad:'kg'},{cantidad:'unknown',unidad:'kg'}]}])).toBe('Cantidad no disponible');
  });
  it('reports zero for a genuinely empty page',()=>{
    expect(formatReportQuantities([])).toBe('0');
  });
});
