import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {assertCloudDatabase} from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const base='http://127.0.0.1:3037/api';
const checks:Array<{actor:string;path:string;status:number}>=[];
async function login(alias:string){
 const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:alias+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
 assert.equal(r.status,200);return (await r.json()).data.tokens.accessToken as string;
}
async function get(token:string,actor:string,path:string,status:number){
 const r=await fetch(base+path,{headers:{Authorization:'Bearer '+token}}),body=await r.json();
 assert.equal(r.status,status,actor+' '+path+' '+JSON.stringify(body));checks.push({actor,path,status});return body.data;
}
for(const actor of ['generador','transportista','operador']){
 const token=await login(actor),id='qa-role-navigation-'+actor+'-20261024';
 await get(token,actor,'/inspecciones',403);
 await get(token,actor,'/inspecciones/participacion',403);
 await get(token,actor,'/inspecciones/'+id,403);
 const data=await get(token,actor,'/inspecciones/'+id+'/intercambios',200);
 assert.equal(data.parteActual,'INSPECCIONADO');assert.equal(data.comunicacionExterna,false);
 assert.ok(data.intercambios.some((e:{tipo:string})=>e.tipo==='REQUERIMIENTO'));
 for(const key of ['informeTecnico','observaciones','datosActa','eventos','evidencias'])assert.equal(data.inspeccion[key],undefined);
 const other='qa-role-navigation-'+(actor==='generador'?'operador':'generador')+'-20261024';
 await get(token,actor,'/inspecciones/'+other+'/intercambios',403);
}
for(const staff of ['admin','inspector','jefe-generadores','jefe-transporte','jefe-operadores']){
 await get(await login(staff),staff,'/inspecciones',200);
}
writeFileSync(process.env.QA_ARTIFACTS+'/role-boundaries-http.json',JSON.stringify({at:new Date().toISOString(),checks,passed:checks.length},null,2));
console.log(checks.length+' HTTP role-boundary checks passed');
