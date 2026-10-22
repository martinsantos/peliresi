import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { assertCloudDatabase, backendRequire, assertCloudEnvironment, externalKeys } from './safety.ts';
await assertCloudDatabase();
assert.ok(['manifest_certificates_20261021','web_app_audit_20261022'].includes(new URL(process.env.DATABASE_URL!).searchParams.get('schema')!));
const out=process.env.QA_ARTIFACTS!, f=JSON.parse(readFileSync(out+'/fixture.json','utf8'));
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient(),base='http://127.0.0.1:4177/api',checks:string[]=[];
const tokens=new Map<string,string>(),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
async function token(role:string) {
 if(!tokens.has(role)){const res=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.21.31.'+(tokens.size+1)},body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});const data=await res.json();assert.equal(res.status,200,JSON.stringify(data));assert.notEqual(data.data.user.training,true);tokens.set(role,data.data.tokens.accessToken);}
 return tokens.get(role)!;
}
async function request(role:string,path:string,method='GET',body?:unknown,status=200) {
 const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+await token(role),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});const result=await r.json();assert.equal(r.status,status,role+' '+path+' '+JSON.stringify(result));assert.notEqual(r.headers.get('x-sitrep-training'),'true');return result;
}
async function download(role:string,path:string,status=200) {
 const r=await fetch(base+path,{headers:{Authorization:'Bearer '+await token(role)}});assert.equal(r.status,status);if(status!==200)return null;
 assert.match(r.headers.get('content-type')!,/application\/pdf/);const bytes=Buffer.from(await r.arrayBuffer());
 if(r.headers.get('x-document-sha256'))assert.equal(sha(bytes),r.headers.get('x-document-sha256'));return bytes;
}
const manifest=(state='EN_TRATAMIENTO',inSitu=false,numero?:string)=>db.manifiesto.create({data:{numero:numero||'QA-CERT-'+randomUUID(),estado:state,generadorId:f.actors.generador,transportistaId:inSitu?null:f.actors.transportista,operadorId:f.actors.operador,creadoPorId:f.users.operador,isDemoData:true,modalidad:inSitu?'IN_SITU':'FIJO',tratamientoMetodo:'QA tratamiento artificial',residuos:{create:[{tipoResiduoId:f.wastes[0],cantidad:10,cantidadRecibida:10,unidad:'kg',estado:'SOLIDO'}]},eventos:{create:{tipo:'CERTIFICACION_OPERADOR_V1',descripcion:'QA',usuarioId:f.users.operador}}},include:{residuos:true}});
const sharp=backendRequire('sharp'),firma='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
const command=(m:any,tipo='PARCIAL',cantidad=4)=>({id:randomUUID(),tipo,firma,metodo:'QA tratamiento certificado',nota:'Documento artificial',cantidades:[{residuoId:m.residuos[0].id,cantidad}]});
const endpoint=(id:string)=>'/manifiestos/'+id+'/certificados';
try {
 const phase=process.argv[2];
 if(phase==='pdf-label') {
  const service=backendRequire('./dist/services/manifestCertificate.service.js');
  for(const tipo of ['PARCIAL','FINAL']) {
   const data={version:1,tipo,numero:'QA-PDF-'+tipo,manifiestoNumero:'QA-PDF',generador:'QA Generador',transportista:'QA Transporte',operador:'QA Operador',autor:'QA Firmante',fecha:new Date().toISOString(),metodo:'QA',nota:'',cantidades:[{residuoId:'qa-r',cantidad:1,corriente:'Y1',unidad:'kg'}],parcialesPrevios:[],adendas:[{id:'qa-adenda',version:1}],firmaSha256:'qa',artificial:true};
   const bytes=await service.renderManifestCertificate(data,'qa-pdf',firma),file=out+'/adenda-label-'+tipo+'.pdf';writeFileSync(file,bytes);
   const text=execFileSync('pdftotext',['-raw',file,'-'],{encoding:'utf8'});
   assert.ok(text.includes(tipo==='FINAL'?'Adendas resueltas:':'Adendas vinculadas:'));
   if(tipo==='PARCIAL')assert.ok(!text.includes('Adendas resueltas:'));
  }
  checks.push('partial PDF lists linked addenda without claiming resolution; final labels resolved addenda');
 } else if(phase==='fixtures') {
  const cases:Record<string,unknown>={};for(const surface of ['web-desktop','web-responsive','app'])cases[surface]=await manifest('TRATADO',false,'QA-CERT-'+({'web-desktop':'WEB','web-responsive':'MOV',app:'APP'}[surface])+'-'+String(Date.now()).slice(-4));
  writeFileSync(out+'/certificate-browser-fixture.json',JSON.stringify({cases}));
 } else if(phase==='off') {
  const saved=JSON.parse(readFileSync(out+'/certificate-http.json','utf8'));
  for(const role of ['generador','transportista','operador']) {
   const list=await request(role,endpoint(saved.id));assert.equal(list.emisionHabilitada,false);assert.equal(list.data.length,3);
   assert.equal(sha((await download(role,endpoint(saved.id)+'/'+saved.final.id+'/archivo'))!),saved.final.pdfSha256);
  }
  const m=await manifest();await request('operador',endpoint(m.id),'POST',command(m),409);
  await request('operador','/manifiestos/'+saved.id+'/adendas','POST',{id:randomUUID(),motivo:'QA intento posterior al final',residuos:[{corriente:'Y1',cantidad:10,unidad:'kg'}]},409);
  checks.push('flag off closes only emission; existing PDF/rights and final dossier guard survive');
 } else if(phase==='audit') {
  for(const proc of JSON.parse(readFileSync(out+'/processes.json','utf8'))){const env=Object.fromEntries(readFileSync('/proc/'+proc.pid+'/environ','utf8').split('\0').filter(Boolean).map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));assertCloudEnvironment(env);assert.equal(new URL(env.DATABASE_URL).searchParams.get('schema'),'manifest_certificates_20261021');assert.equal(env.TRAINING_DATABASE_URL,'');assert.equal(env.PUSH_MANIFEST_NOTICES_ENABLED,'false');for(const key of externalKeys)assert.equal(env[key],'');}
  for(const role of ['admin','generador','transporte','operador']){const r=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.21.31.99'},body:JSON.stringify({email:role+'@capacitacion.invalid',password:'expired-probe'})});assert.equal(r.status,403);}
  const compiled=backendRequire('./dist/lib/prisma.js').default;
  try{
   const mail=backendRequire('./dist/services/notification-mail.service.js');
   const notices=await db.notificacion.findMany({where:{datos:{contains:'certificado_manifiesto'}},include:{usuario:true}});
   const types=new Set<string>();
   for(const n of notices){const data=JSON.parse(n.datos);types.add(data.tipoCertificado);const envelope={...n,...n.usuario,id:n.id,usuarioId:n.usuarioId,tipo:n.tipo,datos:n.datos,manifiestoId:n.manifiestoId};const content=mail.notificationMailContent(envelope);assert.ok(content);assert.match(content.subject,data.tipoCertificado==='FINAL'?/final total/:/parcial/);assert.ok(content.html.includes(data.documentoId));assert.equal(await mail.notificationSourceEligible(envelope,'manifiestos'),false);}
   assert.deepEqual([...types].sort(),['FINAL','PARCIAL']);const before=await db.emailQueue.count();assert.equal(await mail.queueCommittedNotificationEmails(),0);assert.equal(await db.emailQueue.count(),before);assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
   assert.equal(JSON.stringify(await db.manifiesto.findUniqueOrThrow({where:{id:'manifest-qa-legacy'},include:{residuos:true,eventos:true}})),readFileSync(out+'/manifest-legacy-before.json','utf8'));
   checks.push('CAP aliases 403, actual providers closed, '+notices.length+' certificate mail envelopes simulated, zero queue/attempts/sends; legacy unchanged');
  }finally{await compiled.$disconnect();}
 } else {
  assert.equal(phase,'api');
  const m=await manifest(),ep=endpoint(m.id),cmd=command(m);
  for(const role of ['generador','transportista','admin'])await request(role,ep,'POST',cmd,403);
  for(const role of ['operador2','generador2','transportista2'])await request(role,ep,'GET',undefined,404);
  const early=await manifest('RECIBIDO');await request('operador',endpoint(early.id),'POST',command(early),409);
  await request('operador',ep,'POST',{...cmd,firma:'bad'},400);
  await request('operador',ep,'POST',{...cmd,cantidades:[{residuoId:'foreign',cantidad:1}]},409);
  await request('operador',ep,'POST',command(m,'FINAL',10),409);
  assert.equal(await db.certificadoManifiesto.count({where:{manifiestoId:m.id}}),0);assert.equal(await db.notificacion.count({where:{manifiestoId:m.id}}),0);
  checks.push('only linked operator; unrelated readers denied; state/signature/quantity validation atomic');
  const first=(await request('operador',ep,'POST',cmd,201)).data;
  const replay=(await request('operador',ep,'POST',cmd)).data;assert.equal(replay.id,first.id);assert.equal(replay.pdfSha256,first.pdfSha256);
  await request('operador',ep,'POST',{...cmd,nota:'Changed'},409);
  await request('operador',ep,'POST',command(m,'PARCIAL',7),409);
  const secondCmd=command(m,'PARCIAL',6);
  const concurrent=await Promise.all([1,2,3].map(async()=>{const r=await fetch(base+ep,{method:'POST',headers:{Authorization:'Bearer '+await token('operador'),'Content-Type':'application/json'},body:JSON.stringify(secondCmd)});return r.status;}));assert.deepEqual(concurrent.sort(),[200,200,201]);
  assert.equal(await db.certificadoManifiesto.count({where:{manifiestoId:m.id}}),2);assert.equal(await db.notificacion.count({where:{manifiestoId:m.id}}),4);
  await request('admin','/manifiestos/'+m.id+'/revertir-estado','POST',{estadoNuevo:'RECIBIDO',motivo:'QA no cambiar pesaje certificado'},409);
  checks.push('two partials total 10; overflow and changed replay rejected; concurrent duplicate emits once; reversal blocked');
  await request('operador','/manifiestos/'+m.id+'/cerrar','POST',{});
  await request('generador','/pdf/certificado/'+m.id,'GET',undefined,409);
  const adenda=(await request('operador','/manifiestos/'+m.id+'/adendas','POST',{id:randomUUID(),motivo:'QA verificar cantidad',residuos:[{corriente:'Y1',cantidad:10,unidad:'kg'}]},201)).data.adenda;
  await request('operador',ep,'POST',command(m,'FINAL',10),409);
  await request('generador','/manifiestos/'+m.id+'/adendas/'+adenda.id+'/revisiones','POST',{id:randomUUID(),version:0,decision:'OBSERVADA',nota:'QA pendiente'});
  await request('operador',ep,'POST',command(m,'FINAL',10),409);
  await request('generador','/manifiestos/'+m.id+'/adendas/'+adenda.id+'/revisiones','POST',{id:randomUUID(),version:1,decision:'APROBADA',nota:'QA resuelta'});
  const finals=await Promise.all([1,2].map(async()=>{const r=await fetch(base+ep,{method:'POST',headers:{Authorization:'Bearer '+await token('operador'),'Content-Type':'application/json'},body:JSON.stringify(command(m,'FINAL',10))});return {status:r.status,body:await r.json()};}));
  assert.deepEqual(finals.map(r=>r.status).sort(),[201,409]);const final=finals.find(r=>r.status===201)!.body.data;
  assert.equal(await db.certificadoManifiesto.count({where:{manifiestoId:m.id,tipo:'FINAL'}}),1);
  for(const role of ['generador','transportista','operador','admin']) {
   const list=(await request(role,ep)).data;assert.equal(list.length,3);
   for(const record of [first,final]){const bytes=(await download(role,ep+'/'+record.id+'/archivo'))!;assert.equal(sha(bytes),record.pdfSha256);writeFileSync(out+'/'+record.id+'.pdf',bytes);}
  }
  assert.equal(sha((await download('generador','/pdf/certificado/'+m.id))!),final.pdfSha256);
  const text=execFileSync('pdftotext',['-raw',out+'/'+final.id+'.pdf','-'],{encoding:'utf8'});assert.match(text,/final total/);assert.match(text,/Y1: 10 kg/);assert.match(text,/PARCIALES|Parciales previos/);assert.match(text,/SIN VALIDEZ OFICIAL/);assert.match(text,/Firma manuscrita/);assert.ok(!text.includes('Y1: 20'));
  for(const outsider of ['generador2','transportista2','operador2'])await download(outsider,ep+'/'+final.id+'/archivo',404);
  const other=await manifest();await download('operador',endpoint(other.id)+'/'+final.id+'/archivo',404);
  await request('operador','/manifiestos/'+m.id+'/adendas','POST',{id:randomUUID(),motivo:'QA no alterar final',residuos:[{corriente:'Y1',cantidad:11,unidad:'kg'}]},409);
  await request('generador','/manifiestos/'+m.id+'/adendas/'+adenda.id+'/revisiones','POST',{id:randomUUID(),version:2,decision:'OBSERVADA',nota:'QA final inmutable'},409);
  checks.push('pending/observed addenda block final; concurrent final once; all authorized readers download exact hash; total includes partials; final closes adenda edits');
  const raced=await manifest(),raceResults=await Promise.all([1,2].map(async()=>{const r=await fetch(base+endpoint(raced.id),{method:'POST',headers:{Authorization:'Bearer '+await token('operador'),'Content-Type':'application/json'},body:JSON.stringify(command(raced,'PARCIAL',6))});return r.status;}));
  assert.deepEqual(raceResults.sort(),[201,409]);assert.equal(await db.certificadoManifiesto.count({where:{manifiestoId:raced.id}}),1);
  const missingWeight=await manifest();await db.manifiestoResiduo.update({where:{id:missingWeight.residuos[0].id},data:{cantidadRecibida:null}});await request('operador',endpoint(missingWeight.id),'POST',command(missingWeight),409);
  checks.push('simultaneous independent partials cannot over-certify; declared quantity never substitutes for missing received weight');
  const notices=await db.notificacion.findMany({where:{manifiestoId:m.id,datos:{contains:'certificado_manifiesto'}}});
  assert.equal(notices.length,6);
  for(const n of notices){assert.ok([f.users.generador,f.users.transportista].includes(n.usuarioId));const d=JSON.parse(n.datos);assert.ok(d.url.endsWith('?certificado='+d.documentoId+'#certificaciones'));}
  await download('generador','/pdf/certificado/manifest-qa-legacy');
  const inSitu=await manifest('TRATADO',true),inSituFinal=(await request('operador',endpoint(inSitu.id),'POST',command(inSitu,'FINAL',10),201)).data;
  assert.equal(await db.notificacion.count({where:{manifiestoId:inSitu.id}}),1);assert.equal((await db.certificadoManifiesto.findUniqueOrThrow({where:{id:inSituFinal.id}})).documento.transportista,'In situ');
  checks.push('exact partial/final notices to two counterpart accounts; no invented carrier for in situ; legacy PDF retained');
  const input={generadorId:f.actors.generador,transportistaId:f.actors.transportista,operadorId:f.actors.operador,modalidad:'FIJO',fechaEstimadaRetiro:'2099-12-25',residuos:[{tipoResiduoId:f.wastes[0],cantidad:10,unidad:'kg'}]};
  const created=(await request('operador','/manifiestos','POST',input,201)).data.manifiesto;
  assert.equal(await db.eventoManifiesto.count({where:{manifiestoId:created.id,tipo:'CERTIFICACION_OPERADOR_V1'}}),1);
  await db.manifiesto.update({where:{id:created.id},data:{isDemoData:true}});
  checks.push('new manifests marked for explicit release, historical ones untouched');
  writeFileSync(out+'/certificate-http.json',JSON.stringify({id:m.id,first,final,checks},null,2));
 }
 writeFileSync(out+'/certificate-'+phase+'-checks.json',JSON.stringify({checks},null,2));console.log(phase+': '+checks.length+' groups PASS');
} finally {await db.$disconnect();}
