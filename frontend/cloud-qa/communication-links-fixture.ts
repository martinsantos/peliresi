import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const schema = 'communication_links_20261022';
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
  } else if (process.argv[2] === 'seed') {
    assert.deepEqual(await db.$queryRawUnsafe('SELECT current_schema() AS name'), [{ name: schema }]);
    assert.equal(await db.usuario.count(), 0);
    const fixture = await loadSeed().seedNightDatabase();
    const manifest = await db.manifiesto.create({ data: {
      id: 'qa-mail-copy-manifest', numero: 'QA-CORREOS-0001', estado: 'TRATADO',
      generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
      creadoPorId: fixture.users.operador, isDemoData: true, fechaCierre: new Date(),
      residuos: { create: [{ tipoResiduoId: fixture.wastes[0], cantidad: 10, cantidadRecibida: 10, unidad: 'kg', estado: 'SOLIDO' }] },
    } });
    const adenda = await db.adendaManifiesto.create({ data: {
      id: 'qa-mail-copy-adenda', manifiestoId: manifest.id, creadoPorId: fixture.users.operador, huellaSolicitud: 'qa-mail-copy',
      declaracion: { numero: manifest.numero, residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
      residuos: [{ corriente: 'Y1', cantidad: 12, unidad: 'kg' }], motivo: 'QA diferencia de pesaje', version: 1,
      revisiones: [{ id: 'qa-mail-copy-review', autorId: fixture.users.transportista, fecha: new Date().toISOString(), version: 1, decision: 'APROBADA', nota: 'QA decisión individual' }],
    } });
    const { notifyAddendumParties } = backendRequire(path.join(root, 'backend/dist/services/manifiestoAddendumNotice.service.js'));
    const { receiptNotice } = backendRequire(path.join(root, 'backend/dist/services/documentAnalysis.service.js'));
    const { notificationService } = backendRequire(path.join(root, 'backend/dist/services/notification-dispatcher.service.js'));
    await db.$transaction((tx: unknown) => notifyAddendumParties(tx, manifest, adenda.id, 1, 'APROBADA', fixture.users.transportista));
    await notificationService.notificarCambioEstado(manifest.id, 'TRATADO', fixture.users.operador);
    const application = await db.solicitudInscripcion.create({ data: { usuarioId: fixture.users.generador, tipoActor: 'GENERADOR', estado: 'APROBADA', datosActor: '{}', observaciones: 'QA comprobante para revisar' } });
    await db.$transaction((tx: unknown) => receiptNotice(tx, fixture.users.generador, { solicitudId: application.id }));
    await db.$transaction((tx: unknown) => receiptNotice(tx, fixture.users.generador, { documentoId: 'qa-receipt-profile' }));
    const notices = await db.notificacion.findMany({ where: { usuarioId: fixture.users.generador, OR: [{ manifiestoId: manifest.id }, { titulo: 'Comprobante repetido' }] }, orderBy: { createdAt: 'asc' } });
    const { notificationMailContent } = backendRequire(path.join(root, 'backend/dist/services/notification-mail.service.js'));
    const mails = notices.map((notice: any) => ({ id: notice.id, notice, ...notificationMailContent({ ...notice, rol: 'GENERADOR' }) }));
    assert.equal(mails.length, 4);
    assert.ok(mails.every((mail: any) => mail.html));
    for (const state of ['EN_TRATAMIENTO', 'CANCELADO']) {
      await notificationService.notificarCambioEstado(manifest.id, state, fixture.users.operador);
    }
    const extra = await db.notificacion.findMany({ where: { usuarioId: fixture.users.generador, manifiestoId: manifest.id, datos: { contains: 'estado_manifiesto' } } });
    for (const notice of extra.filter((n: any) => !mails.some((m: any) => m.id === n.id))) mails.push({ id: notice.id, notice, ...notificationMailContent({ ...notice, rol: 'GENERADOR' }) });
    const reminderManifest = await db.manifiesto.create({ data: {
      id: 'qa-links-signed', numero: 'QA-LINKS-FIRMA', estado: 'RECIBIDO', fechaFirma: new Date('2026-09-22T12:00:00Z'),
      generadorId: fixture.actors.generador, transportistaId: fixture.actors.transportista, operadorId: fixture.actors.operador,
      creadoPorId: fixture.users.generador, isDemoData: false,
    } });
    const { ejecutarRecordatorioFirma } = backendRequire(path.join(root, 'backend/dist/jobs/manifestSignatureReminder.job.js'));
    const count = await ejecutarRecordatorioFirma(new Date('2026-10-15T12:00:00Z'));
    assert.equal(count, 3); assert.equal(await ejecutarRecordatorioFirma(new Date('2026-10-15T12:00:00Z')), 0);
    assert.equal(await ejecutarRecordatorioFirma(new Date('2026-10-22T12:00:00Z')), 3);
    await db.manifiesto.update({ where: { id: reminderManifest.id }, data: { estado: 'TRATADO' } });
    assert.equal(await ejecutarRecordatorioFirma(new Date('2026-10-23T12:00:00Z')), 0);
    writeFileSync(out + '/signature-reminder-http.json', JSON.stringify({ at23Days: 3, at30Days: 3, retryDuplicates: 0, closedNewNotices: 0 }));
    writeFileSync(out + '/fixture.json' , JSON.stringify({ ...fixture, mails, manifestId: manifest.id, applicationId: application.id, database: 'sitrep_night_qa_20260926', externalDelivery: false, capClosed: true }));
  } else if (process.argv[2] === 'cases') {
    const f=JSON.parse(readFileSync(out+'/fixture.json','utf8'));
    const existingTicket=await db.ticketSoporte.findFirst({where:{asunto:'QA comunicación resuelta'}});
    const tokens:Record<string,string>={};
    async function request(role:string,url:string,method='GET',body?:unknown,status=200){
      if(!tokens[role]){
        const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.22.33.'+(Object.keys(tokens).length+1)},body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
        const payload=await response.json();assert.equal(response.status,200);tokens[role]=payload.data.tokens.accessToken;
      }
      const response=await fetch('http://127.0.0.1:4177/api'+url,{method,headers:{Authorization:'Bearer '+tokens[role],'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},...(body===undefined?{}:{body:JSON.stringify(body)})});
      const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data.data;
    }
    const ticket=existingTicket||await request('generador','/soporte','POST',{asunto:'QA comunicación resuelta',descripcion:'QA consulta artificial para probar cierre y enlaces'},201);
    let version=1;
    for(const accion of (existingTicket?[]:['TOMAR','RESPONDER','CERRAR'])){const response=await request('admin','/soporte/'+ticket.id+'/acciones','POST',{accion,version,cuerpo:'QA solución documentada'});version=response.version;}
    const inspection=await db.inspeccion.create({data:{numero:'QA-LINKS-PSIP-LINKED',inspectorId:f.users.admin,tipoActor:'GENERADOR',generadorId:f.actors.generador,estado:'NOTIFICADA'}});
    await request('admin','/inspecciones/'+inspection.id+'/intercambios','POST',{version:1,clienteId:crypto.randomUUID(),tipo:'REQUERIMIENTO',asunto:'QA documentación requerida',cuerpo:'QA responder con constancia sintética dentro del plazo indicado.',plazoRespuestaAt:new Date(Date.now()+3*86400000).toISOString()},201);
    const all=await db.notificacion.findMany({where:{usuarioId:f.users.generador},orderBy:{createdAt:'asc'}});
    const {notificationMailContent}=backendRequire(path.join(root,'backend/dist/services/notification-mail.service.js'));
    for(const notice of all){const data=JSON.parse(notice.datos||'{}');if(data.tipo!=='soporte'&&!(data.tipo==='intercambio_inspeccion'&&data.inspeccionId===inspection.id))continue;
      const mail=notificationMailContent({...notice,rol:'GENERADOR'});assert.ok(mail);f.mails.push({id:notice.id,notice,...mail});
      if(data.tipo==='intercambio_inspeccion')assert.ok(mail.html.includes('Plazo para responder:'));
    }
    const other=await request('generador2','/notificaciones/'+f.mails[0].id,'GET',undefined,404);assert.equal(other,undefined);
    await request('generador2','/manifiestos/'+f.manifestId+'/adendas?adenda=qa-mail-copy-adenda','GET',undefined,404);
    assert.equal((await request('generador','/manifiestos/'+f.manifestId+'/adendas?adenda=unknown')).adendas.length,0);
    writeFileSync(out+'/fixture.json',JSON.stringify(f));
    writeFileSync(out+'/cases-http.json',JSON.stringify({supportStages:['TOMAR','RESPONDER','CERRAR'],psipRequirement:true,deadlineInMail:true,foreignNotice:404,foreignAddendum:404,unknownAddendumEmpty:true}));
  } else if (process.argv[2] === 'extra') {
    const f=JSON.parse(readFileSync(out+'/fixture.json','utf8'));
    const {notificationMailContent}=backendRequire(path.join(root,'backend/dist/services/notification-mail.service.js'));
    const notices=await db.notificacion.findMany({where:{usuarioId:f.users.generador,manifiestoId:'qa-links-signed'},orderBy:{createdAt:'asc'}});
    assert.equal(notices.length,2);
    for(const notice of notices)if(!f.mails.some((m:any)=>m.id===notice.id))f.mails.push({id:notice.id,notice,...notificationMailContent({...notice,rol:'GENERADOR'})});
    for(const item of f.mails)Object.assign(item,notificationMailContent({...item.notice,rol:'GENERADOR'}));
    writeFileSync(out+'/fixture.json',JSON.stringify(f));
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
