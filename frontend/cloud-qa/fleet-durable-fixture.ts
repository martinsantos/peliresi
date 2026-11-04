import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const directory=process.env.QA_ARTIFACTS!,fixture=JSON.parse(await readFile(path.join(directory,'fleet-private.json'),'utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try{
  for(const surface of ['web','app']){
    const entry=fixture.cases[surface],original=await db.manifiesto.findUniqueOrThrow({where:{id:entry.a.id}});
    assert.equal(original.isDemoData,true);assert.match(original.numero,/^QA-FLEET-/);
    const stale=await db.manifiesto.create({data:{numero:entry.prefix+'-STALE',generadorId:original.generadorId,
      operadorId:original.operadorId,transportistaId:original.transportistaId,creadoPorId:original.creadoPorId,
      estado:'EN_TRANSITO',modalidad:'FIJO',fechaRetiro:new Date(),isDemoData:true,asignacionTransporte:original.asignacionTransporte}});
    entry.stale={id:stale.id,numero:stale.numero};
  }
  await writeFile(path.join(directory,'fleet-durable-private.json'),JSON.stringify(fixture),{mode:0o600});
  console.log('Synthetic fleet recovery fixtures created');
}finally{await db.$disconnect();}
