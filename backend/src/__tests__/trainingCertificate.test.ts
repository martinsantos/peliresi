import {expect,it} from 'vitest';
import {certifiedRows} from '../domain/trainingCertificate';
const r=[{id:'a',cantidadRecibida:10,unidad:'kg',tipoResiduo:{codigo:'Y1'}},{id:'b',cantidadRecibida:3,unidad:'l',tipoResiduo:{codigo:'Y2'}}];
const cmd=(tipo:'PARCIAL'|'FINAL',cantidades:{residuoId:string;cantidad:number}[])=>({id:'x',tipo,cantidades,firma:'x',metodo:'m',nota:'n'});
it('certifies only selected treated amounts and preserves independent units',()=>{
 expect(certifiedRows(cmd('PARCIAL',[{residuoId:'a',cantidad:4}]),r,[])).toEqual([{residuoId:'a',corriente:'Y1',cantidad:4,unidad:'kg'}]);
});
it('does not certify a partial amount twice or above received weight',()=>{
 expect(()=>certifiedRows(cmd('PARCIAL',[{residuoId:'a',cantidad:7}]),r,[[{residuoId:'a',corriente:'Y1',cantidad:4,unidad:'kg'}]])).toThrow('supera');
});
it('requires actual received weights rather than treating declared weights as measurements',()=>{
 expect(()=>certifiedRows(cmd('PARCIAL',[{residuoId:'a',cantidad:4}]),[{...r[0],cantidadRecibida:null}],[])).toThrow('pesaje');
});
it('rejects duplicate and unrelated residue ids',()=>{
 expect(()=>certifiedRows(cmd('PARCIAL',[{residuoId:'a',cantidad:1},{residuoId:'a',cantidad:1}]),r,[])).toThrow('repitas');
 expect(()=>certifiedRows(cmd('PARCIAL',[{residuoId:'other',cantidad:1}]),r,[])).toThrow();
});
it('final includes all received amounts without adding partials again',()=>{
 const c=cmd('FINAL',[{residuoId:'a',cantidad:10},{residuoId:'b',cantidad:3}]);
 expect(certifiedRows(c,r,[[{residuoId:'a',corriente:'Y1',cantidad:4,unidad:'kg'}]])).toHaveLength(2);
 expect(()=>certifiedRows(cmd('FINAL',[{residuoId:'a',cantidad:6},{residuoId:'b',cantidad:3}]),r,[])).toThrow('total');
 expect(()=>certifiedRows(cmd('FINAL',[{residuoId:'a',cantidad:10}]),r,[])).toThrow('todos');
});
