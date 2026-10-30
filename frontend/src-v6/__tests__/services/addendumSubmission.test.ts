import { beforeEach, expect, it } from 'vitest';
import { addendumCommandConfirmed, addendumDraftScope, addendumSubmissionKey, clearAddendumSubmission,
  dispatchAddendumSubmission, legacyAddendumCommand, readAddendumSubmission, writeAddendumSubmission,
  type AddendumCommand } from '../../services/addendumSubmission';

const id='00000000-0000-4000-8000-000000000001', reviewId='00000000-0000-4000-8000-000000000002';
const command: AddendumCommand={id,kind:'create',body:{motivo:' Hallazgo ',residuos:[{corriente:'Y21',cantidad:4,unidad:'kg'}]}};
const review: AddendumCommand={id:reviewId,kind:'review',adendaId:id,body:{version:2,decision:'OBSERVADA',nota:' Revisar carga '}};
const token=(claims:object)=>'qa.'+btoa(JSON.stringify(claims))+'.qa';
beforeEach(()=>localStorage.clear());

it('separates temporary views while retaining the personal draft key',()=>{
 expect(addendumDraftScope('scope','u',token({id:'u'}))).toEqual({scope:'scope',impersonator:null});
 expect(addendumDraftScope('scope','u',token({id:'u',impersonatedBy:'admin'}))).toEqual({scope:JSON.stringify(['scope','temporary','admin']),impersonator:'admin'});
 expect(addendumDraftScope('scope','u',token({id:'other'}))).toBeNull();
 expect(addendumDraftScope('scope','u',token({id:'u',restricted:true}))).toBeNull();
});
it('persists a prepared command before marking it dispatched and refuses replacement',()=>{
 const prepared={command,phase:'prepared' as const}; writeAddendumSubmission('draft',prepared);
 expect(readAddendumSubmission('draft')).toEqual(prepared);
 expect(()=>writeAddendumSubmission('draft',{command:review,phase:'prepared'})).toThrow();
 const dispatched=dispatchAddendumSubmission('draft',prepared); expect(dispatched.phase).toBe('dispatched');
 expect(()=>clearAddendumSubmission('draft',prepared)).toThrow();
 clearAddendumSubmission('draft',dispatched);expect(readAddendumSubmission('draft')).toBeNull();
});
it('does not interpret corrupt storage as no pending command',()=>{
 for(const raw of ['', '{bad', JSON.stringify({version:1,submission:{phase:'dispatched'}})]){
  localStorage.setItem(addendumSubmissionKey('draft'),raw);expect(()=>readAddendumSubmission('draft')).toThrow();
 }
});
it('recovers valid legacy signatures and rejects foreign paths or invalid identifiers',()=>{
 const endpoint='/manifiestos/m/adendas';
 const old={id:reviewId,signature:JSON.stringify({path:endpoint+'/'+id+'/revisiones',body:review.body})};
 expect(legacyAddendumCommand(old,endpoint)).toEqual(review);
 expect(()=>legacyAddendumCommand({...old,signature:JSON.stringify({path:'/otro',body:review.body})},endpoint)).toThrow();
 expect(()=>legacyAddendumCommand({...old,id:'not-a-uuid'},endpoint)).toThrow();
});
it('recognizes only the exact authorized creation or review from the server',()=>{
 const row={id,creadoPorId:'u',impersonadoPorId:null,motivo:'Hallazgo',rectificaId:null,residuos:[{corriente:'Y21',cantidad:4,unidad:'kg'}],
  revisiones:[{id:reviewId,autorId:'u',version:2,decision:'OBSERVADA',nota:'Revisar carga'}]};
 expect(addendumCommandConfirmed(command,row,'u',null)).toBe(true);
 expect(addendumCommandConfirmed(review,row,'u',null)).toBe(true);
 expect(addendumCommandConfirmed(command,row,'other',null)).toBe(false);
 expect(addendumCommandConfirmed(command,{...row,residuos:[{corriente:'Y21',cantidad:5,unidad:'kg'}]},'u',null)).toBe(false);
 expect(addendumCommandConfirmed(review,row,'u','admin')).toBe(false);
 expect(addendumCommandConfirmed(review,{...row,revisiones:[{...row.revisiones[0],decision:'APROBADA'}]},'u',null)).toBe(false);
});
