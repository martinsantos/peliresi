import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';
await assertCloudDatabase();
assert.equal(process.env.DISABLE_EMAILS,'true');assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const {COMPANY_NOTICE_LABELS}=backendRequire(root+'/backend/dist/services/companyNotice.service.js');
const {notificationMailContent,notificationSourceEligible}=backendRequire(root+'/backend/dist/services/notification-mail.service.js');
const output=process.env.QA_ARTIFACTS!+'/mail-gallery';mkdirSync(output,{recursive:true});
mkdirSync(output+'/source-templates',{recursive:true});
const assets=['mendoza-marca-horizontal-transparente.png','mail-sitrep-rotonda.png'].map(name=>{
 const bytes=readFileSync(root+'/frontend/public/'+name);
 return {name,sha256:createHash('sha256').update(bytes).digest('hex'),url:process.env.FRONTEND_URL+'/'+name,data:'data:image/png;base64,'+bytes.toString('base64')};
});
const notices=Object.keys(COMPANY_NOTICE_LABELS).map(evento=>({tipo:'INFO_GENERAL',datos:JSON.stringify({tipo:'representacion_empresa',version:1,empresaId:'qa-company',eventoId:'qa-event',evento})}));
for(const tipo of ['SOLICITUD_ENVIADA','SOLICITUD_OBSERVADA','SOLICITUD_MENSAJE','SOLICITUD_APROBADA','SOLICITUD_RECHAZADA'])notices.push({tipo,datos:JSON.stringify({solicitudId:'qa-application'})});
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const cards=notices.map((notice,index)=>{
 const mail=notificationMailContent({...notice,id:'qa-'+index,createdAt:new Date(),email:'person@night-qa.invalid',activo:true,emailVerified:true,notifEmail:true,rol:notice.tipo==='SOLICITUD_ENVIADA'?'ADMIN':'GENERADOR',usuarioId:'qa-person'});assert.ok(mail);
 // Preserve the exact generated message; the gallery embeds only the two real
 // local logo assets so reviewing it never contacts a server or a tracker.
 writeFileSync(output+'/source-templates/'+index+'.html',mail.html);
 let preview=mail.html;for(const asset of assets){assert.ok(preview.includes(asset.url));preview=preview.replaceAll(asset.url,asset.data);}
 writeFileSync(output+'/'+index+'.html',preview);
 return '<section><h2>'+escape(mail.subject)+'</h2><iframe title="'+escape(mail.subject)+'" sandbox src="'+index+'.html"></iframe></section>';
});
writeFileSync(output+'/index.html','<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SITREP · Altas y representación · Correos de muestra</title><style>body{margin:0;background:#f5f7f6;color:#143d2c;font:16px system-ui}header{padding:24px;background:#174f35;color:white}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr));gap:20px;padding:20px}section{background:white;border:1px solid #dce5df;border-radius:12px;overflow:hidden}h2{font-size:17px;padding:16px;margin:0}iframe{width:100%;height:500px;border:0}</style><header><h1>Altas y representantes</h1><p>Plantillas reales con datos artificiales · '+cards.length+' variantes · Ningún envío</p></header><main>'+cards.join('')+'</main></html>');
console.log('Rendered '+cards.length+' email variants, no provider or send invoked');
writeFileSync(output+'/asset-provenance.json',JSON.stringify({originalTemplates:'source-templates',contentChanged:false,embeddedLocalAssets:assets.map(({name,sha256})=>({name,sha256})),externalRequests:0}));

const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try {
 const rows=await db.notificacion.findMany({where:{datos:{contains:'"representacion_empresa"'}},include:{usuario:true},orderBy:{createdAt:'desc'},take:300});
 const reviewed=[];
 for(const n of rows){const notice={...n,...n.usuario,usuarioId:n.usuarioId,id:n.id};const mail=notificationMailContent(notice);assert.equal(mail?.family,'representacion');reviewed.push({noticeId:n.id,event:JSON.parse(n.datos).evento,sourceEligible:await notificationSourceEligible(notice,'representacion'),mailPreference:n.usuario.notifEmail});}
 assert.ok(reviewed.length>0);assert.equal(await db.emailQueue.count({where:{estado:{not:'SUPRIMIDO'}}}),0);assert.equal(await db.emailQueue.count({where:{intentos:{gt:0}}}),0);
 writeFileSync(output+'/eligibility.json',JSON.stringify({actualNoticesReviewed:reviewed.length,records:reviewed,queueWrites:0,deliveryAttempts:0}));
}finally{await db.$disconnect();}
