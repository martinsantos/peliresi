import {describe,expect,it} from 'vitest';
import {formatReportQuantities,groupReportResidues} from '../../utils/report-quantities';
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
  it('groups only the same category and explicit unit without merging physical dimensions',()=>{
    expect(groupReportResidues([{residuos:[{tipo:'Y1',cantidad:2,unidad:'kg'},{tipo:'Y1',cantidad:'3',unidad:'kg'},{tipo:'Y1',cantidad:4,unidad:'L'},{tipo:'Y2',cantidad:1,unidad:'kg'}]}],'tipo')).toEqual({groups:[{unit:'kg',items:[{name:'Y1',value:5},{name:'Y2',value:1}]},{unit:'L',items:[{name:'Y1',value:4}]}]});
  });
  it('retains zero and unclassified data without inventing a waste code',()=>{
    expect(groupReportResidues([{residuos:[{cantidad:0,unidad:' kg '}]}],'codigo')).toEqual({groups:[{unit:'kg',items:[{name:'Sin clasificación',value:0}]}]});
    expect(groupReportResidues([],'codigo')).toEqual({groups:[]});
  });
  it('rejects malformed, negative and overflowing data rather than returning partial charts',()=>{
    for(const residuos of ['invalid',[null],[{cantidad:-1,unidad:'kg'}],[{cantidad:Number.MAX_VALUE,unidad:'kg'},{cantidad:Number.MAX_VALUE,unidad:'kg'}]])expect(groupReportResidues([{residuos}],'tipo')).toEqual({error:'Hay cantidades inválidas; no se muestra una suma parcial.'});
  });
  it('requires a declared unit before comparing any quantity',()=>{
    expect(groupReportResidues([{residuos:[{tipo:'Y1',cantidad:2,unidad:''}]}],'tipo')).toEqual({error:'Falta la unidad de un residuo; no se puede comparar su cantidad.'});
  });
});
