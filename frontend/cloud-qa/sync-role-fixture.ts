import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.ACTOR_MULTIROLE_ENABLED,'true');
assert.equal(process.env.VITE_ACTOR_MULTIROLE_ENABLED,'true');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.DISABLE_EMAILS,'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const {PrismaClient}=backendRequire('@prisma/client');
const db=new PrismaClient();
try {
  const [multi,generator,operator]=await Promise.all([
    db.usuario.findUniqueOrThrow({where:{email:'draft-multirole-20261024@night-qa.invalid'},include:{generador:true,transportista:true,operador:true}}),
    db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'},include:{generador:true}}),
    db.usuario.findUniqueOrThrow({where:{email:'operador@night-qa.invalid'},include:{operador:true}}),
  ]);
  assert.equal(multi.activo,true);
  for(const actor of [multi.generador,multi.transportista,multi.operador,generator.generador,operator.operador]){
    assert.equal(actor.activo,true);assert.match(actor.razonSocial,/^QA /);
  }
  const run=randomUUID().slice(0,8),cases:Record<string,{id:string;numero:string}>={},legacy:Record<string,{id:string;numero:string}>={};
  for(const surface of ['web-desktop','app']){
    for(const kind of ['current','legacy']){
      const manifest=await db.manifiesto.create({data:{
        numero:`QA-SYNC-ROLE-${run}-${surface.toUpperCase()}-${kind.toUpperCase()}`,
        generadorId:generator.generador.id,transportistaId:multi.transportista.id,operadorId:operator.operador.id,
        creadoPorId:multi.id,estado:'EN_TRANSITO',modalidad:'FIJO',fechaRetiro:new Date(),isDemoData:true,
        asignacionTransporte:{version:1,transportistaId:multi.transportista.id,vehiculo:null,chofer:null},
      },select:{id:true,numero:true}});
      (kind==='current'?cases:legacy)[surface]=manifest;
    }
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!,'sync-role-private.json'),JSON.stringify({owner:multi.id,cases,legacy}),{mode:0o600});
  console.log('Manifiestos artificiales preparados para el cambio de actividad.');
}finally{await db.$disconnect();}
