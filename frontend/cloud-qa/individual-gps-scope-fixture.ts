import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED, 'true');
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
try {
  const [generator, carrier, operator, admin] = await Promise.all([
    db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'},include:{generador:true}}),
    db.usuario.findUniqueOrThrow({where:{email:'transportista@night-qa.invalid'},include:{transportista:true}}),
    db.usuario.findUniqueOrThrow({where:{email:'operador@night-qa.invalid'},include:{operador:true}}),
    db.usuario.findUniqueOrThrow({where:{email:'admin@night-qa.invalid'}}),
  ]);
  for (const user of [generator, carrier, operator, admin]) assert.equal(user.activo, true);
  for (const actor of [generator.generador,carrier.transportista,operator.operador]) assert.match(actor.razonSocial,/^QA /);
  const activity = await db.empresaActividad.findUniqueOrThrow({where:{rol_actorId:{rol:'TRANSPORTISTA',actorId:carrier.transportista.id}}});
  const company = await db.empresa.findUniqueOrThrow({where:{id:activity.empresaId}});
  assert.equal(activity.activa,true); assert.equal(company.activa,true); assert.match(company.razonSocial,/^QA /);
  let authorization = await db.autorizacionEmpresa.findUnique({where:{actividadId_usuarioId:{actividadId:activity.id,usuarioId:carrier.id}}});
  if (!authorization) {
    assert.ok(await db.autorizacionEmpresa.count({where:{empresaId:company.id,activa:true}}) < 2);
    authorization = await db.autorizacionEmpresa.create({data:{empresaId:company.id,actividadId:activity.id,usuarioId:carrier.id,
      todosEstablecimientos:true,establecimientoIds:[],otorgadaPor:admin.id}});
  }
  assert.equal(authorization.activa,true);
  const run = randomUUID().slice(0,8), cases:Record<string,Record<string,{id:string;numero:string}>> = {};
  for (const surface of ['web-desktop','app']) {
    cases[surface]={};
    for (const kind of ['scope','legacy']) cases[surface][kind] = await db.manifiesto.create({data:{
      numero:`QA-GPS-SCOPE-${run}-${surface.toUpperCase()}-${kind.toUpperCase()}`,
      generadorId:generator.generador.id,transportistaId:carrier.transportista.id,operadorId:operator.operador.id,
      creadoPorId:carrier.id,estado:'EN_TRANSITO',modalidad:'FIJO',fechaRetiro:new Date(),isDemoData:true,
      asignacionTransporte:{version:1,transportistaId:carrier.transportista.id,vehiculo:null,chofer:null},
    },select:{id:true,numero:true}});
  }
  await writeFile(path.join(process.env.QA_ARTIFACTS!,'individual-gps-scope-private.json'),
    JSON.stringify({owner:carrier.id,company:{id:company.id,name:company.razonSocial},cases}),{mode:0o600});
  console.log('Dos contextos autorizados y manifiestos artificiales preparados.');
} finally { await db.$disconnect(); }
