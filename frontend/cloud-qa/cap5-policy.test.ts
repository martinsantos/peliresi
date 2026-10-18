import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cap5Allowed,origin,manifests} from './cap5-policy.ts';
const teacher='qa-instructor-id';
const token=(claims:object)=>'Bearer x.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.x';
const school=token({id:'cap-20261012-admin-5',realm:'sitrep-capacitacion-v1',impersonatedBy:teacher});
const instructor=token({id:teacher});
test('CAP 5 writes require real school realm and exact whitelisted record',()=>{
 for(const id of manifests)assert.equal(cap5Allowed(origin+'/api/manifiestos/'+id+'/firmar','POST','{}',school,teacher),true);
 for(const n of [1,2,3,4]){
  assert.equal(cap5Allowed(origin+'/api/admin/training/impersonate/cap-20261012-generador-'+n,'POST','{}',instructor,teacher),false);
  assert.equal(cap5Allowed(origin+'/api/manifiestos/cap-20261012-manifiesto-'+n+'-BORRADOR/firmar','POST','{}',school,teacher),false);
 }
 for(const auth of [instructor,undefined,token({id:'cap-20261012-admin-5'})])assert.equal(cap5Allowed(origin+'/api/manifiestos/'+manifests[0]+'/cerrar','POST','{}',auth,teacher),false);
});
test('no new ticket, real applications, jobs, global settings or handoff to teams 1–4',()=>{
 for(const route of ['/api/soporte','/api/solicitudes/iniciar','/api/admin/jobs/vencimientos','/api/admin/usuarios'])assert.equal(cap5Allowed(origin+route,'POST','{}',school,teacher),false);
 const route=origin+'/api/soporte/cap-20261012-ticket-generador-5/acciones';
 assert.equal(cap5Allowed(route,'POST',JSON.stringify({responsableId:'cap-20261012-inspector-5'}),school,teacher),true);
 assert.equal(cap5Allowed(route,'POST',JSON.stringify({responsableId:'cap-20261012-admin-1'}),school,teacher),false);
 assert.equal(cap5Allowed('https://example.com/api/health','GET',null,school,teacher),false);
 assert.equal(cap5Allowed(origin+'/api/manifiestos','GET',null,instructor,teacher),false);
});
