import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { syntheticCuit } from './synthetic-cuit.ts';
await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), 'proposal_operations_20261021');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const prefix = 'ux-draft-' + randomUUID().slice(0, 8), password = 'OnlyLocal-NightQA-2026!', rows = [];
async function api(route: string, token?: string, data?: unknown, status = 200, method = data ? 'POST' : 'GET') {
  const response = await fetch('http://127.0.0.1:3037/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? {Authorization:'Bearer '+token} : {}) }, ...(data ? {body:JSON.stringify(data)} : {}) });
  const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); return result.data;
}
try {
  for (const [index, type] of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].entries()) {
    const email = prefix + '-' + type.toLowerCase() + '@night-qa.invalid', cuit = syntheticCuit(Date.now() + index * 119);
    const result = await api('/solicitudes/iniciar', undefined, {nombre:'QA formulario '+type,email,cuit,password,tipoActor:type},201);
    const user = await db.usuario.findUniqueOrThrow({where:{email}});
    assert.equal(user.activo,false); assert.equal(user.emailVerified,false);
    const proof = randomUUID();
    await db.usuario.update({where:{id:user.id},data:{emailVerificationToken:createHash('sha256').update(proof).digest('hex')}});
    await api('/auth/verify-email?token='+proof);
    const token = (await api('/auth/login',undefined,{email,password})).tokens.accessToken;
    const id = result.solicitudId, current = (await api('/solicitudes/'+id,token)).solicitud;
    await api('/solicitudes/'+id,token,{expectedUpdatedAt:current.updatedAt,pasoActual:1,datosActor:{razonSocial:'QA borrador '+type,cuit,domicilio:'Domicilio artificial inicial',telefono:'02610000000',emailContacto:email}},200,'PUT');
    rows.push({id,email,type,cuit});
  }
  assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
  writeFileSync(process.env.QA_ARTIFACTS+'/onboarding-draft-fixtures.json',JSON.stringify(rows,null,2));
  console.log('Three verified artificial applicants prepared for real UI form checks');
} finally {await db.$disconnect();}
