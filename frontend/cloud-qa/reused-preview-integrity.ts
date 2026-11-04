/** Fingerprint a resumed artificial preview without replacing its historical baseline. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
const schema = 'proposal_operations_20261021';
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;
try {
 const tables = await db.$queryRawUnsafe("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('information_schema',$1) AND table_schema NOT LIKE 'pg_%' ORDER BY 1,2", schema);
 const current:Record<string,unknown> = {};
 for(const row of tables) {
  assert.match(row.table_schema,/^[a-zA-Z_][a-zA-Z_0-9]*$/);assert.match(row.table_name,/^[a-zA-Z_][a-zA-Z_0-9]*$/);
  current[row.table_schema+'.'+row.table_name]=await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${row.table_schema}"."${row.table_name}" t`);
 }
 const baseline=out+'/protected-refinement-before.json';
 if(process.argv[2]==='baseline') {
  const historical=JSON.parse(readFileSync(out+'/protected-schemas-before.json','utf8'));
  for(const [key,value] of Object.entries(historical))assert.deepEqual(current[key],value,key+' historical fingerprint');
  const additional=Object.keys(current).filter(key=>!Object.hasOwn(historical,key));
  // This synthetic schema was created in the earlier communications QA, after that snapshot.
  assert.ok(additional.length>0);
  assert.ok(additional.every(key=>key.startsWith('communication_links_20261022.')));
  writeFileSync(baseline,JSON.stringify(current,null,2),{flag:'wx'});
  console.log('Resumed preview: historical fingerprints retained; '+additional.length+' communications QA tables now included before new tests');
 } else {
  assert.equal(process.argv[2],'audit');
  assert.deepEqual(current,JSON.parse(readFileSync(baseline,'utf8')));
  writeFileSync(out+'/protected-refinement-audit.json',JSON.stringify({at:new Date().toISOString(),tables:Object.keys(current).length,unchanged:true},null,2));
  console.log('PASS all '+Object.keys(current).length+' protected preview tables unchanged');
 }
} finally {await db.$disconnect();}
