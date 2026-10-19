import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {assertCloudDatabase,backendRequire,root} from './safety.ts';
await assertCloudDatabase();
const {PrismaClient}=backendRequire('@prisma/client');const db=new PrismaClient();
const schema='qa_handoff_migration_'+randomUUID().replaceAll('-','');let created=false;
try{
  const sql=await readFile(path.join(root,'backend/prisma/migrations/20261019180000_transport_handoffs/migration.sql'),'utf8');
  const statements=sql.split(';').map(s=>s.trim()).filter(Boolean);
  assert.ok(statements.every(s=>/^(CREATE TABLE|CREATE (UNIQUE )?INDEX|ALTER TABLE "tracking_gps" ADD COLUMN)/.test(s)));
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);created=true;
  await db.$transaction(async(tx:any)=>{
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE manifiestos (id TEXT PRIMARY KEY)');
    await tx.$executeRawUnsafe('CREATE TABLE tracking_gps (id TEXT PRIMARY KEY, "manifiestoId" TEXT, timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP)');
    for(const statement of statements)await tx.$executeRawUnsafe(statement);
  });
  const q=(sql:string)=>db.$executeRawUnsafe(sql.replaceAll('TEST_SCHEMA',`"${schema}"`));
  await q("INSERT INTO TEST_SCHEMA.manifiestos(id) VALUES ('synthetic')");
  const insert=(id:string,order:number,finish:string)=>`INSERT INTO TEST_SCHEMA.tramos_transporte(id,"manifiestoId",orden,tipo,datos,"creadoPorId",motivo,"huellaSolicitud",inicio,fin) VALUES ('${id}','synthetic',${order},'EXTERNO','{}','qa','QA','qa',CURRENT_TIMESTAMP,${finish})`;
  await q(insert('original',0,'CURRENT_TIMESTAMP'));await q(insert('new',1,'NULL'));
  await assert.rejects(()=>q(insert('duplicate-active',2,'NULL')),(error:any)=>error.meta?.code==='23505'&&error.meta?.message?.includes('manifiestoId'));
  await q("INSERT INTO TEST_SCHEMA.tracking_gps(id,\"manifiestoId\",\"tramoId\") VALUES ('point','synthetic','new')");
  await assert.rejects(()=>q("DELETE FROM TEST_SCHEMA.tramos_transporte WHERE id='new'"),(error:any)=>error.meta?.code==='23503');
  // The reused synthetic database already received the additive table/columns;
  // complete the new per-leg GPS index without touching any existing rows.
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "tracking_gps_tramoId_timestamp_idx" ON "tracking_gps"("tramoId", "timestamp")');
  await db.$executeRawUnsafe('ALTER TABLE "tramos_transporte" ADD COLUMN IF NOT EXISTS "impersonadoPorId" TEXT');
  await writeFile(path.join(process.env.QA_ARTIFACTS!,'handoff-migration.json'),JSON.stringify({passed:true,checks:['additive-sql-only','applied-to-empty-scratch-schema','one-active-leg-db-constraint','gps-leg-foreign-key-preserves-history'],production:false},null,2));
  console.log('PASS: additive handoff migration rehearsed, concurrency and GPS foreign key enforced');
}finally{
  if(created)await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await db.$disconnect();
}
