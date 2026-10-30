import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {assertCloudDatabase,backendRequire} from './safety.ts';
import {qaBackendEntry} from './rollback-backend.ts';

await assertCloudDatabase();
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.DISABLE_EMAILS,'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const out=process.env.QA_ARTIFACTS!;
assert.ok(/^\/work\/sitrep\/\.qa-operational-ui-current\d+$/.test(out) || out === '/work/sitrep/.qa-legacy-integrity-20261030');
const resultFile=path.join(out,'insitu-certificates.json');
assert.equal(existsSync(resultFile),false,'Do not repeat the synthetic issuance on the same cases');
const root=path.join(out,'proposal-e2e-'+(process.env.QA_BROWSER_ATTEMPT||'initial'));
const proofs=readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory())
 .map(e=>path.join(root,e.name,'proof.json')).filter(existsSync)
 .map(p=>JSON.parse(readFileSync(p,'utf8')))
 .filter(p=>p.creator==='operador'&&p.noTripOrGps===true);
assert.deepEqual(proofs.map(p=>p.surface).sort(),['app','web-desktop']);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
const {notificationMailContent}=backendRequire(path.join(path.dirname(qaBackendEntry()),'services/notification-mail.service.js'));
const sharp=backendRequire('sharp');
const signature='data:image/png;base64,'+(await sharp(Buffer.from('<svg width="300" height="100"><rect width="300" height="100" fill="white"/><path d="M10 70 L40 20 L80 75 L120 15 L180 80 L270 30" stroke="black" stroke-width="3" fill="none"/></svg>')).png().toBuffer()).toString('base64');
const roles=['generador','transportista','operador'] as const,tokens=new Map<string,string>();
const results:any[]=[];
async function login(role:string){
 if(!tokens.has(role)){
  const response=await fetch('http://127.0.0.1:4177/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'sitrep_qa_client=127.35.1.'+(roles.indexOf(role as typeof roles[number])+1)},body:JSON.stringify({email:role+'@night-qa.invalid',password:'OnlyLocal-NightQA-2026!'})});
  assert.equal(response.status,200,'Synthetic login '+role);
  tokens.set(role,(await response.json()).data.tokens.accessToken);
 }
 return tokens.get(role)!;
}
async function api(role:string,route:string,method='GET',body?:unknown,expected=200){
 const response=await fetch('http://127.0.0.1:4177/api'+route,{method,headers:{Authorization:'Bearer '+await login(role),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const result=await response.json();
 assert.equal(response.status,expected,role+' '+route+' '+JSON.stringify(result));return result.data;
}
try{
 for(const proof of proofs){
  const m=await db.manifiesto.findUniqueOrThrow({where:{id:proof.id},include:{generador:true,transportista:true,operador:true,residuos:{include:{tipoResiduo:true}}}});
  assert.equal(m.isDemoData,true);assert.equal(m.modalidad,'IN_SITU');assert.equal(m.estado,'RECIBIDO');assert.ok(m.transportistaId);assert.equal(m.fechaRetiro,null);
  for(const actor of [m.generador,m.transportista,m.operador])assert.match(actor.razonSocial,/^QA /);
  assert.equal(m.residuos.length,1);assert.equal(m.residuos[0].tipoResiduo.codigo,'Y1');
  const residue=m.residuos[0],quantity=Number(residue.cantidad),treatment=await db.tratamientoAutorizado.findFirst({where:{operadorId:m.operadorId,activo:true}});
  assert.ok(quantity>0);const method=treatment?.metodo||'QA tratamiento artificial';
  writeFileSync(path.join(out,'insitu-certificates-progress.json'),JSON.stringify({surface:proof.surface,id:m.id,stage:'before-weighing',results},null,2));
  await api('operador',`/manifiestos/${m.id}/pesaje`,'POST',{residuos:[{id:residue.id,cantidadRecibida:quantity}]});
  await api('operador',`/manifiestos/${m.id}/tratamiento`,'POST',{metodo:method});
  const parcial=(await api('operador',`/manifiestos/${m.id}/certificados`,'POST',{id:randomUUID(),tipo:'PARCIAL',firma:signature,metodo:method,cantidades:[{residuoId:residue.id,cantidad:Math.min(4,quantity)}]},201));
  await api('operador',`/manifiestos/${m.id}/cerrar`,'POST',{});
  const final=(await api('operador',`/manifiestos/${m.id}/certificados`,'POST',{id:randomUUID(),tipo:'FINAL',firma:signature,metodo:method,cantidades:[{residuoId:residue.id,cantidad:quantity}]},201));
  const notices:Record<string,string>={},mails:Record<string,string>={},mailDestinations:Record<string,string>={};
  for(const role of roles){
   const list=await api(role,`/manifiestos/${m.id}/certificados`);
   assert.ok(list.some((item:any)=>item.id===parcial.id));assert.ok(list.some((item:any)=>item.id===final.id));
   const response=await fetch(`http://127.0.0.1:4177/api/manifiestos/${m.id}/certificados/${final.id}/archivo`,{headers:{Authorization:'Bearer '+await login(role)}});
   assert.equal(response.status,200);assert.match(response.headers.get('content-type')||'',/application\/pdf/);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),final.pdfSha256);
   if(role==='operador'){
    const pdf=path.join(out,'insitu-final-'+proof.surface+'.pdf');writeFileSync(pdf,bytes);
    const text=execFileSync('pdftotext',['-raw',pdf,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
    assert.match(text,/Transporte aprobador/i);assert.match(text,/sin traslado ni viaje/i);assert.match(text,/SIN VALIDEZ OFICIAL/i);
   }else{
    const userId=role==='generador'?m.generador.usuarioId:m.transportista!.usuarioId;
    const found=await db.notificacion.findMany({where:{manifiestoId:m.id,usuarioId:userId,datos:{contains:final.id}},include:{usuario:true}});
    assert.equal(found.length,1,'One final notice for '+role);
    const notice=found[0],metadata=JSON.parse(notice.datos!);
    assert.equal(metadata.documentoId,final.id);assert.equal(metadata.tipoCertificado,'FINAL');
    const mail=notificationMailContent({...notice.usuario,...notice});
    assert.ok(mail);
    const companyAccess=Array.isArray(metadata.accesosEmpresa)&&metadata.accesosEmpresa.length>0;
    if(companyAccess)assert.ok(mail.html.includes('/notificaciones/'+notice.id));
    else {assert.match(mail.html,/certificado=/);assert.match(mail.html,/certificaciones/);}
    mailDestinations[role]=companyAccess?'notice':'manifest';
    notices[role]=notice.id;
    const file='insitu-final-mail-'+proof.surface+'-'+role+'.html';writeFileSync(path.join(out,file),mail.html);mails[role]=file;
   }
  }
  const current=await db.manifiesto.findUniqueOrThrow({where:{id:m.id},select:{estado:true,fechaRetiro:true}});
  assert.equal(current.estado,'TRATADO');assert.equal(current.fechaRetiro,null);
  assert.equal(await db.trackingGPS.count({where:{manifiestoId:m.id}}),0);
  assert.equal(await db.tramoTransporte.count({where:{manifiestoId:m.id}}),0);
  results.push({surface:proof.surface,id:m.id,numero:m.numero,partialId:parcial.id,finalId:final.id,finalSha256:final.pdfSha256,notices,mails,mailDestinations,noTripOrGps:true});
 }
 assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
 assert.equal(await db.emailQueue.count({where:{sentAt:{not:null}}}),0);
 writeFileSync(resultFile,JSON.stringify({synthetic:true,externalDelivery:false,results},null,2));
 console.log('Origin certificates: '+results.length+' synthetic manifests; three parties read the same PDF; no trip or GPS.');
}finally{await db.$disconnect();}
