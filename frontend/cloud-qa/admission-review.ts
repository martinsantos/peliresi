import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const file = process.env.QA_ARTIFACTS + '/admission-review-fixtures.json', password = 'OnlyLocal-NightQA-2026!';
async function api(route: string, token?: string, body?: unknown, expected = 200) {
  const response = await fetch('http://127.0.0.1:3037/api' + route, {method:body ? 'POST' : 'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const result = await response.json(); assert.equal(response.status, expected, route + ': ' + JSON.stringify(result)); return result.data;
}
try {
  const admin = (await api('/auth/login', undefined, { email: 'admin@night-qa.invalid', password })).tokens.accessToken;
  const actor = await db.generador.findFirstOrThrow({where:{usuario:{email:'generador@night-qa.invalid'}},include:{usuario:true}});
  const actorToken = (await api('/auth/login',undefined,{email:actor.usuario.email,password})).tokens.accessToken;
  if (process.env.QA_ADMISSION_CONTRACT === 'true') {
    const output = process.env.QA_ARTIFACTS + '/admission-observations-contract.json';
    assert.ok(!existsSync(output), 'Contract already verified; preserve evidence');
    const verified = [];
    for (const [index, decision] of ['aprobar', 'rechazar'].entries()) {
      const year = 2080 + index;
      assert.equal(await db.renovacion.count({ where: { generadorId: actor.id, anio: year } }), 0);
      const observation = 'QA observaciones originales que deben conservarse · ' + decision;
      const row = (await api('/renovaciones', actorToken, { anio: year, tipoActor: 'GENERADOR', generadorId: actor.id, modalidad: 'SIN_CAMBIOS', observaciones: observation }, 201)).renovacion;
      await api('/renovaciones/' + row.id + '/' + decision, admin, { motivoRechazo: 'QA motivo de rechazo adicional' });
      const after = await db.renovacion.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(after.observaciones, observation);
      if (decision === 'rechazar') assert.equal(after.motivoRechazo, 'QA motivo de rechazo adicional');
      verified.push({ id: row.id, decision, observationsPreserved: true });
    }
    assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
    writeFileSync(output, JSON.stringify({ at: new Date().toISOString(), verified, emailAttempts: 0 }, null, 2));
    console.log(JSON.stringify(verified));
  } else if (process.env.QA_ADMISSION_VERIFY === 'true') {
    const fixture = JSON.parse(readFileSync(file,'utf8'));
    const results = [];
    for (const row of fixture.ui) {
      const current = await db.renovacion.findUniqueOrThrow({where:{id:row.id}});
      const expected = row.decision === 'approve' ? 'APROBADA' : 'RECHAZADA';
      assert.equal(current.estado, expected, row.surface + ' ' + row.decision);
      const type = row.decision === 'approve' ? 'MODIFICACION_APROBADA' : 'MODIFICACION_RECHAZADA';
      const notices = await db.notificacion.findMany({where:{tipo:type,datos:{contains:row.id}}});
      assert.equal(notices.length,1); assert.equal(notices[0].usuarioId,actor.usuarioId);
      results.push({id:row.id,surface:row.surface,decision:current.estado,ownerNotices:1});
    }
    assert.equal(await db.manifiesto.count(), fixture.manifests);
    assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
    assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
    writeFileSync(process.env.QA_ARTIFACTS+'/admission-review-ui.json',JSON.stringify({at:new Date().toISOString(),results,emailSent:0,emailAttempts:0},null,2));
    console.log(JSON.stringify(results));
  } else {
    assert.ok(!existsSync(file),'Fixture already exists; reuse it');
    const prefix='ux-review-'+randomUUID().slice(0,8), applications=[], renewals=[];
    const manifests=await db.manifiesto.count();
    // Minimal inactive fixtures only for exercising multi-page application navigation.
    for(let index=0;index<9;index++){
      const user=await db.usuario.create({data:{email:prefix+'-'+index+'@night-qa.invalid',password:actor.usuario.password,nombre:'QA revisión '+index,rol:'GENERADOR',activo:false,emailVerified:false,notifEmail:false}});
      const s=await db.solicitudInscripcion.create({data:{usuarioId:user.id,tipoActor:'GENERADOR',estado:'BORRADOR',datosActor:JSON.stringify({razonSocial:'QA revisión '+index})}});
      applications.push(s.id);
    }
    for(let year=2028;renewals.length<23&&year<=2100;year++){
      if(await db.renovacion.findUnique({where:{anio_generadorId:{anio:year,generadorId:actor.id}}}))continue;
      const r=(await api('/renovaciones',actorToken,{anio:year,tipoActor:'GENERADOR',generadorId:actor.id,modalidad:'CON_CAMBIOS',datosNuevos:{telefono:'0261000'+year},observaciones:'QA revisión · datos artificiales · '+prefix},201)).renovacion;
      renewals.push({id:r.id,year,actor:actor.razonSocial});
    }
    assert.equal(renewals.length,23);
    const list=(await api('/renovaciones?limit=20&page=2',admin));assert.ok(list.renovaciones.length>0);assert.ok(list.pagination.total>=23);
    const appPage=await api('/solicitudes?limit=20&page=2',admin);assert.ok(appPage.solicitudes.length>0);
    const http=[];
    for(const [index,decision] of ['aprobar','rechazar'].entries()){
      const r=renewals[index];
      await api('/renovaciones/'+r.id+'/'+decision,actorToken,{motivoRechazo:'QA revisión rechazada'},403);
      await api('/renovaciones/'+r.id+'/'+decision,admin,{motivoRechazo:'QA revisión rechazada'});
      await api('/renovaciones/'+r.id+'/'+decision,admin,{motivoRechazo:'No duplicar decisión'},400);
      const type=decision==='aprobar'?'MODIFICACION_APROBADA':'MODIFICACION_RECHAZADA';
      const notices=await db.notificacion.findMany({where:{tipo:type,datos:{contains:r.id}}});
      assert.equal(notices.length,1);assert.equal(notices[0].usuarioId,actor.usuarioId);
      http.push({id:r.id,decision,ownerNotices:1,actorDecisionDenied:true,duplicateDecisionDenied:true});
    }
    const ui=renewals.slice(2,6).map((row,index)=>({...row,surface:index<2?'web':'app',decision:index%2===0?'approve':'reject'}));
    assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
    writeFileSync(file,JSON.stringify({prefix,manifests,applications,renewals,ui,http},null,2));
    console.log(JSON.stringify({applications:applications.length,renewals:renewals.length,http,ui}));
  }
} finally {await db.$disconnect();}
