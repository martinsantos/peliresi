import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase } from './safety.ts';

await assertCloudDatabase();
const out=process.env.QA_ARTIFACTS!;
assert.equal(out,'/work/sitrep/.qa-actor-overview-20261031');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const fixture=JSON.parse(readFileSync(path.join(out,'fixture.json'),'utf8'));
assert.equal(fixture.synthetic,true);assert.equal(fixture.perType,121);
const attempt=process.env.QA_CONCURRENCY_ATTEMPT||'initial';
assert.match(attempt,/^[a-z0-9-]+$/);
const base='http://127.0.0.1:4177/api';
const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json','cookie':'sitrep_qa_client=127.11.43.1'},
 body:JSON.stringify({email:'admin@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
assert.equal(login.status,200);const token=(await login.json()).data.tokens.accessToken as string;
const total=100,start=performance.now();
const results=await Promise.all(Array.from({length:total},async(_,index)=>{
 const began=performance.now(),page=index%19+1;
 try {
  const query=new URLSearchParams({search:fixture.search,limit:'20',page:String(page)});
  const response=await fetch(base+'/actores/directorio?'+query,{headers:{authorization:'Bearer '+token,cookie:'sitrep_qa_client=127.11.44.'+(index+1)},signal:AbortSignal.timeout(45000)});
  const body=await response.json();
  return {status:response.status,ms:Math.round(performance.now()-began),correct:response.status===200&&body.data?.pagination?.total===363&&body.data?.pagination?.page===page&&body.data?.items?.length===(page===19?3:20)};
 } catch(error) {
  return {status:0,ms:Math.round(performance.now()-began),correct:false,error:error instanceof Error?error.name:'unknown'};
 }
}));
const times=results.map(item=>item.ms).sort((a,b)=>a-b);
const failures=results.filter(item=>!item.correct);
const report={synthetic:true,concurrency:total,oneAccount:true,uniqueSimulatedClients:true,fixtureRows:363,
 elapsedMs:Math.round(performance.now()-start),p50Ms:times[49],p95Ms:times[94],maxMs:times[99],
 statuses:results.reduce((counts:Record<string,number>,item)=>{counts[item.status]=(counts[item.status]||0)+1;return counts;},{}),failures};
writeFileSync(path.join(out,'concurrency-'+attempt+'.json'),JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
console.log(JSON.stringify(report));
assert.equal(failures.length,0,'Algunas consultas concurrentes fallaron o devolvieron datos incoherentes');
