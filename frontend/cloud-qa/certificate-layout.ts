import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const output=process.env.QA_ARTIFACTS!;
assert.equal(output,'/work/sitrep/.qa-certificate-layout-20261030');
assert.equal(new URL(process.env.DATABASE_URL!).searchParams.get('schema'),'proposal_operations_20261021');
assert.equal(process.env.TRAINING_DATABASE_URL,'');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL,'2000-01-01T00:00:00Z');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED,'false');
const prior='/work/sitrep/.qa-operational-ui-current2026103090/manifest-complete/proposal-lifecycle-complet-e4f7f-ox-updates-transport-starts-web-desktop/complete-lifecycle.json';
const proof=JSON.parse(readFileSync(prior,'utf8'));
assert.equal(proof.creator,'generador');assert.equal(proof.actualRoles,true);assert.equal(proof.samePdfAcrossParties,true);
const {PrismaClient}=backendRequire('@prisma/client'),db=new PrismaClient();
try{
 const manifest=await db.manifiesto.findUniqueOrThrow({where:{id:proof.id},include:{generador:true,transportista:true,operador:true}});
 assert.equal(manifest.isDemoData,true);assert.equal(manifest.estado,'TRATADO');
 for(const actor of [manifest.generador,manifest.transportista,manifest.operador]){assert.ok(actor);assert.match(actor.razonSocial,/^QA /);}
 const docs=await db.certificadoManifiesto.findMany({where:{manifiestoId:manifest.id},select:{id:true,tipo:true,pdfSha256:true}});
 assert.equal(docs.length,2);
 for(const certificate of proof.certificates){assert.ok(docs.some((d:any)=>d.id===certificate.id&&d.tipo===certificate.tipo&&d.pdfSha256===certificate.sha256));}
 writeFileSync(path.join(output,'fixture.json'),JSON.stringify({synthetic:true,id:manifest.id,certificates:proof.certificates}),{flag:'wx',mode:0o600});
 console.log('Manifiesto artificial y sus dos documentos firmados comprobados en la base aislada.');
}finally{await db.$disconnect();}
