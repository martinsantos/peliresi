import {expect,it} from 'vitest';
import {certificateCommand,certifiedRows} from '../domain/trainingCertificate';
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

const finding={id:'hallazgo:Y12:kg',corriente:'Y12',unidad:'kg',observado:2,adendas:[{id:'adenda',version:2}]};
it('requires an explicit treated or not-treated decision for each approved finding in the final',()=>{
 const original=cmd('FINAL',[{residuoId:'a',cantidad:10},{residuoId:'b',cantidad:3}]);
 expect(()=>certifiedRows(original,r,[],[finding])).toThrow('Indicá si cada corriente hallada');
 expect(certifiedRows({...original,exclusionesHallazgos:[finding.id]},r,[],[finding])).toHaveLength(2);
 expect(certifiedRows({...original,cantidades:[...original.cantidades,{residuoId:finding.id,cantidad:1}]},r,[],[finding])[2])
  .toMatchObject({corriente:'Y12',cantidad:1,origen:'HALLAZGO',adendas:finding.adendas});
});
it('never certifies more than observed or excludes something already signed in a partial',()=>{
 const parcial=cmd('PARCIAL',[{residuoId:finding.id,cantidad:1}]);
 const previous=certifiedRows(parcial,r,[],[finding]);
 expect(()=>certifiedRows(cmd('PARCIAL',[{residuoId:finding.id,cantidad:1.1}]),r,[previous],[finding])).toThrow('supera');
 const final=cmd('FINAL',[{residuoId:'a',cantidad:10},{residuoId:'b',cantidad:3}]);
 expect(()=>certifiedRows({...final,exclusionesHallazgos:[finding.id]},r,[previous],[finding])).toThrow('ya certificado');
 expect(()=>certifiedRows({...final,cantidades:[...final.cantidades,{residuoId:finding.id,cantidad:0.5}]},r,[previous],[finding])).toThrow('ya certificado');
 expect(()=>certifiedRows({...final,cantidades:[...final.cantidades,{residuoId:finding.id,cantidad:2.1}]},r,[previous],[finding])).toThrow('observado');
 expect(certifiedRows({...final,cantidades:[...final.cantidades,{residuoId:finding.id,cantidad:1.5}]},r,[previous],[finding])[2].cantidad).toBe(1.5);
});
it('does not silently discard a previously certified finding whose adenda changed',()=>{
 const previous=certifiedRows(cmd('PARCIAL',[{residuoId:finding.id,cantidad:1}]),r,[],[finding]);
 expect(()=>certifiedRows(cmd('FINAL',[{residuoId:'a',cantidad:10},{residuoId:'b',cantidad:3}]),r,[previous],[])).toThrow('ya no coincide');
});
it('accepts more than 50 rows when findings extend an existing declaration, within a bounded request',()=>{
 const input={...cmd('FINAL',Array.from({length:51},(_,i)=>({residuoId:'r'+i,cantidad:1}))),id:'63dab5d4-a36d-42fb-b559-99fd84129c37'};
 expect(certificateCommand.safeParse(input).success).toBe(true);
 expect(certificateCommand.safeParse({...input,cantidades:Array.from({length:201},(_,i)=>({residuoId:'r'+i,cantidad:1}) )}).success).toBe(false);
});
