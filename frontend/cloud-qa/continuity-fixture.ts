import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const schema = new URL(process.env.DATABASE_URL!).searchParams.get('schema')!;
assert.ok(['continuity_final_20261022', 'reactivation_20261022'].includes(schema));
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'), schema);
assert.equal(process.env.TRAINING_DATABASE_URL, '');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
assert.equal(process.env.EMAIL_NOTIFICATION_FAMILIES, '');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
const { PrismaClient } = backendRequire('@prisma/client'), db = new PrismaClient();
const out = process.env.QA_ARTIFACTS!;
async function protectedTables() {
  const tables = await db.$queryRawUnsafe("SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema NOT IN ('information_schema',$1) AND table_schema NOT LIKE 'pg_%' ORDER BY 1,2", schema);
  const result: Record<string, unknown> = {};
  for (const row of tables) {
    assert.match(row.table_schema, /^[a-zA-Z_][a-zA-Z_0-9]*$/); assert.match(row.table_name, /^[a-zA-Z_][a-zA-Z_0-9]*$/);
    result[row.table_schema + '.' + row.table_name] = await db.$queryRawUnsafe(`SELECT COUNT(*)::int AS count, md5(COALESCE(string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)), '')) AS hash FROM "${row.table_schema}"."${row.table_name}" t`);
  }
  return result;
}
try {
  if (process.argv[2] === 'prepare') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT nspname FROM pg_namespace WHERE nspname=$1', schema), []);
    writeFileSync(out + '/protected-before.json', JSON.stringify(await protectedTables()));
    await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  } else if (process.argv[2] === 'migrate') {
    const sql=readFileSync(root+'/backend/prisma/migrations/20261022130000_actor_form_drafts/migration.sql','utf8');
    await db.$transaction(async (tx:any)=>{for(const statement of sql.split(';').filter(s=>s.trim()))await tx.$executeRawUnsafe(statement);});
    assert.equal(await db.actorFormDraft.count(),0);
    writeFileSync(out+'/migration.json',JSON.stringify({additive:true,tables:2,existingSchemasUnchanged:true}));
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(),0);
    const fixture=await loadSeed().seedNightDatabase();
    const common={generadorId:fixture.actors.generador,transportistaId:fixture.actors.transportista,operadorId:fixture.actors.operador,creadoPorId:fixture.users.operador,isDemoData:true};
    const today=new Date(new Date().toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Mendoza'})+'T12:00:00-03:00');
    for(let i=0;i<125;i++)await db.manifiesto.create({data:{...common,id:'continuity-active-'+i,numero:'QA-AGENDA-'+String(i).padStart(4,'0'),estado:'APROBADO',createdAt:new Date(today.getTime()-i*60000),fechaEstimadaRetiro:today}});
    const proposal={version:1,generadorId:common.generadorId,transportistaId:common.transportistaId,operadorId:common.operadorId,creadoPorId:common.creadoPorId,autorRol:'OPERADOR'};
    for(const [id,approved] of [['mine',false],['waiting',true]] as const)await db.manifiesto.create({data:{...common,id:'continuity-'+id,numero:'QA-'+id.toUpperCase(),estado:'PENDIENTE_APROBACION',fechaEstimadaRetiro:today,eventos:{create:[{tipo:'PROPUESTA_PARTES_V1',descripcion:JSON.stringify(proposal),usuarioId:fixture.users.operador},...(approved?[{tipo:'APROBACION_OPERADOR',descripcion:'QA approved',usuarioId:fixture.users.operador}]:[])]}}});
    await db.manifiesto.create({data:{...common,id:'continuity-future',numero:'QA-FUTURE',estado:'EN_TRANSITO',fechaEstimadaRetiro:new Date(today.getTime()+86400000)}});
    await db.manifiesto.create({data:{...common,id:'continuity-foreign',numero:'QA-FOREIGN',estado:'APROBADO',generadorId:fixture.actors.generador2,transportistaId:fixture.actors.transportista2,operadorId:fixture.actors.operador2}});
    await db.manifiesto.create({data:{...common,id:'continuity-historical',numero:'QA-HISTORICAL',estado:'TRATADO',fechaCierre:today}});
    const cases:Record<string,unknown>={};
    for(const surface of ['web-desktop','web-responsive','app']){
      const m=await db.manifiesto.create({data:{...common,id:'continuity-final-'+surface,numero:'QA-FINAL-'+surface,estado:'TRATADO',tratamientoMetodo:'QA tratamiento artificial',fechaCierre:today,createdAt:new Date('2020-01-01'),eventos:{create:[{tipo:'CERTIFICACION_OPERADOR_V1',descripcion:'QA circuito de emisión explícita',usuarioId:fixture.users.operador}]},residuos:{create:[{tipoResiduoId:fixture.wastes[0],cantidad:10,cantidadRecibida:10,unidad:'kg',estado:'SOLIDO'}]}}});
      cases[surface]={id:m.id,numero:m.numero};
    }
    const password=await backendRequire('bcryptjs').hash('OnlyLocal-NightQA-2026!',8);
    for(const surface of ['web-desktop','web-responsive','app'])for(const role of ['generador','operador','transportista']){
      const key='application-'+role+'-'+surface;
      const user=await db.usuario.create({data:{email:key+'@night-qa.invalid',nombre:'QA solicitante '+role,password,rol:role.toUpperCase(),activo:false,motivoInactividad:'PENDIENTE_APROBACION',emailVerified:true,notifEmail:false}});
      const application=await db.solicitudInscripcion.create({data:{usuarioId:user.id,tipoActor:role.toUpperCase(),estado:'BORRADOR',datosActor:JSON.stringify({nombre:user.nombre,email:user.email,cuit:'99-90000001-0',razonSocial:'QA inicio',_sitrepDraftStep:1})}});
      fixture.users[key]=user.id;cases[key]={id:application.id};
    }
    writeFileSync(out+'/fixture.json',JSON.stringify({...fixture,cases,synthetic:true}));
    writeFileSync(out+'/certificate-browser-fixture.json',JSON.stringify({cases}));
  } else if (process.argv[2] === 'audit') {
    assert.deepEqual(await protectedTables(), JSON.parse(readFileSync(out + '/protected-before.json', 'utf8')));
    const processes = JSON.parse(readFileSync(out + '/processes.json', 'utf8'));
    for (const item of processes) {
      const env = Object.fromEntries(readFileSync(`/proc/${item.pid}/environ`, 'utf8').split('\0').filter(Boolean).map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
      for (const key of ['DISABLE_EMAILS', 'PUSH_MANIFEST_NOTICES_ENABLED', 'TRAINING_DATABASE_URL', 'TRAINING_DIRECT_LOGIN_UNTIL', 'EMAIL_NOTIFICATION_FAMILIES']) assert.equal(env[key], process.env[key]);
    }
    assert.equal(await db.emailQueue.count({ where: { estado: { not: 'SUPRIMIDO' } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { intentos: { gt: 0 } } }), 0);
    assert.equal(await db.emailQueue.count({ where: { sentAt: { not: null } } }), 0);
    for (const alias of ['admin', 'generador', 'transporte', 'operador']) {
      const res = await fetch('http://127.0.0.1:4177/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'sitrep_qa_client=127.12.33.99' }, body: JSON.stringify({ email: alias + '@capacitacion.invalid', password: 'expired-qa-probe' }) });
      assert.equal(res.status, 403);
    }
    writeFileSync(out + '/audit.json', JSON.stringify({ protectedTables: Object.keys(await protectedTables()).length, emailAttempts: 0, activeMailQueue: 0, capAliasesRejected: 4, processesVerified: processes.length }));
  } else throw new Error('Unknown fixture phase');
} finally { await db.$disconnect(); }
