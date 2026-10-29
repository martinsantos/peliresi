import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.ENTERPRISE_ENABLED,'true');assert.equal(process.env.VITE_ENTERPRISE_ENABLED,'true');
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try{
 const [representative,admin,generator,operator,...carriers]=await Promise.all([
  db.usuario.findUniqueOrThrow({where:{email:'draft-multirole-20261024@night-qa.invalid'}}),
  db.usuario.findUniqueOrThrow({where:{email:'admin@night-qa.invalid'}}),
  db.usuario.findUniqueOrThrow({where:{email:'generador@night-qa.invalid'},include:{generador:true}}),
  db.usuario.findUniqueOrThrow({where:{email:'operador@night-qa.invalid'},include:{operador:true}}),
  ...['transportista','transportista2'].map(name=>db.usuario.findUniqueOrThrow({where:{email:`${name}@night-qa.invalid`},include:{transportista:true}})),
 ]);
 assert.equal(representative.activo,true);assert.equal(representative.emailVerified,true);
 const companies=[];
 for(const [i,user] of carriers.entries()){
  const actor=user.transportista;assert.equal(user.activo,true);assert.equal(actor.activo,true);assert.match(actor.razonSocial,/^QA /);
  const cuit=actor.cuit.replace(/\D/g,'');assert.ok(cuit.length>=10);
  let activity=await db.empresaActividad.findUnique({where:{rol_actorId:{rol:'TRANSPORTISTA',actorId:actor.id}}});
  let company=activity?await db.empresa.findUniqueOrThrow({where:{id:activity.empresaId}}):null;
  if(!company){
   assert.equal(await db.empresa.findUnique({where:{cuit}}),null);
   company=await db.empresa.create({data:{cuit,razonSocial:`QA Alcance transporte ${i+1}`,domicilioLegal:{calle:'QA',localidad:'Mendoza',departamento:'Capital'}}});
   activity=await db.empresaActividad.create({data:{empresaId:company.id,rol:'TRANSPORTISTA',actorId:actor.id,aprobadaPor:admin.id}});
  }
  assert.match(company.razonSocial,/^QA Alcance transporte /);assert.equal(activity.activa,true);
  const existing=await db.autorizacionEmpresa.findUnique({where:{actividadId_usuarioId:{actividadId:activity.id,usuarioId:representative.id}}});
  if(!existing)await db.autorizacionEmpresa.create({data:{empresaId:company.id,actividadId:activity.id,usuarioId:representative.id,todosEstablecimientos:true,establecimientoIds:[],otorgadaPor:admin.id}});
  else assert.equal(existing.activa,true);
  companies.push({id:company.id,activity:activity.id,actor:actor.id,name:company.razonSocial});
 }
 const cases:Record<string,{id:string;numero:string}>={},run=randomUUID().slice(0,8);
 for(const surface of ['web-desktop','app'])cases[surface]=await db.manifiesto.create({data:{
  numero:`QA-TRIP-SCOPE-${run}-${surface.toUpperCase()}`,generadorId:generator.generador.id,transportistaId:companies[0].actor,
  operadorId:operator.operador.id,creadoPorId:representative.id,estado:'EN_TRANSITO',modalidad:'FIJO',fechaRetiro:new Date(),isDemoData:true,
  asignacionTransporte:{version:1,transportistaId:companies[0].actor,vehiculo:null,chofer:null},
 },select:{id:true,numero:true}});
 await writeFile(path.join(process.env.QA_ARTIFACTS!,'trip-scope-private.json'),JSON.stringify({owner:representative.id,companies,cases}),{mode:0o600});
 console.log('Dos empresas y viajes artificiales preparados para comprobar el aislamiento.');
}finally{await db.$disconnect();}
