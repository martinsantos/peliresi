import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase,backendRequire,root } from './safety.ts';
await assertCloudDatabase();
const out='/work/sitrep/.qa-inspection-deadline-company-20261030';
assert.equal(process.env.QA_ARTIFACTS,out);assert.equal(process.env.QA_COMPAT_BACKEND,'inspection-deadline-company-after');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const fixture=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8'));assert.match(fixture.email,/@night-qa\.invalid$/);
const dist=path.join(root,'backend/dist-qa-psip-deadline-company-20261030-v2');
const db=backendRequire(path.join(dist,'lib/prisma.js')).default,{ejecutarCatalogo}=backendRequire(path.join(dist,'jobs/alertCatalogue.job.js'));
try{
 const rule=await db.reglaAlerta.findUniqueOrThrow({where:{id:fixture.ruleId}});assert.ok(rule.activa&&rule.nombre.startsWith('QA vencimiento representante'));
 const records=Object.values(fixture.cases).flat() as any[];assert.equal(records.length,9);
 const rules=db.reglaAlerta,requests=db.intercambioInspeccion,findRules=rules.findMany.bind(rules),findRequests=requests.findMany.bind(requests);
 rules.findMany=(args:any)=>findRules({...args,where:{AND:[args.where,{id:rule.id}]}});
 requests.findMany=(args:any)=>findRequests({...args,where:{AND:[args.where,{id:{in:records.map(r=>r.requirementId)}}]}});
 assert.equal(await ejecutarCatalogo(new Date()),18);
 assert.equal(await db.alertaGenerada.count({where:{reglaId:rule.id}}),9);
 for(const item of records){const rows=await db.notificacion.findMany({where:{datos:{contains:item.caseId}}});assert.equal(rows.length,2);}
 assert.equal((await db.notificacion.findUniqueOrThrow({where:{id:records[0].noticeId}})).leida,true);
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 writeFileSync(path.join(out,'job-final-proof.json'),JSON.stringify({synthetic:true,production:false,cases:9,representatives:9,
  duplicateNotices:0,readStatePreserved:true,emailAttempts:0,emailSent:0},null,2),{flag:'wx',mode:0o600});
 console.log('PASS barrido final compilado: nueve avisos a representantes, sin duplicados ni correos.');
}finally{await db.$disconnect();}
