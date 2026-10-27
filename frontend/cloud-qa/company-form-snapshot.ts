import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const out=process.env.QA_ARTIFACTS!,before=out+'/company-validation-records-before.json';
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try {
 const snapshot:Record<string,{count:number;hash:string}>={};
 for(const table of ['empresa','empresaActividad','establecimientoEmpresa','responsableEmpresa','autorizacionEmpresa','invitacionEmpresa','eventoEmpresa']){
  const rows=await db[table].findMany({orderBy:{id:'asc'}});
  snapshot[table]={count:rows.length,hash:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 }
 if(process.argv[2]==='company-forms-before'){
  assert.equal(existsSync(before),false,'Do not replace the before snapshot');
  writeFileSync(before,JSON.stringify(snapshot,null,2));
  console.log('Company form baseline saved without business writes');
 }else{
  assert.equal(process.argv[2],'company-forms-after');
  assert.deepEqual(snapshot,JSON.parse(readFileSync(before,'utf8')));
  const result={at:new Date().toISOString(),unchanged:snapshot,businessWrites:0};
  writeFileSync(out+'/company-validation-records-after.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }
}finally{await db.$disconnect();}
