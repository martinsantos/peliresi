import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire, root } from './safety.ts';

await assertCloudDatabase();
const output=process.env.QA_ARTIFACTS!;
await mkdir(path.join(output,'uploads'),{recursive:true});
backendRequire('ts-node/register');
const {seedNightDatabase}=backendRequire(path.join(root,'backend/tests/integration/seed-night.ts'));
const fixture=await seedNightDatabase();
const {PrismaClient}=backendRequire('@prisma/client');
const db=new PrismaClient();
try {
  // Explicit synthetic page-two/mixed-unit data, not business responses or fake auth.
  for(let i=0;i<55;i++)await db.manifiesto.upsert({
    where:{id:'cloud-qa-report-'+i},
    create:{id:'cloud-qa-report-'+i,numero:'QA-CLOUD-'+String(i+1).padStart(5,'0'),
      generadorId:fixture.actors.generador,transportistaId:fixture.actors.transportista,
      operadorId:fixture.actors.operador,creadoPorId:fixture.users.admin,
      estado:'TRATADO',isDemoData:true,modalidad:'FIJO',fechaCierre:new Date(),
      observaciones:'QA nube: expediente completamente sintético',
      residuos:{create:[{tipoResiduoId:fixture.wastes[i%2],cantidad:i+1,
        cantidadRecibida:i+1,unidad:['kg','lt','tn'][i%3],estado:'SOLIDO'}]}},
    update:{},
  });
  await writeFile(path.join(output,'fixture.json'),JSON.stringify({
    ...fixture,database:'sitrep_night_qa_20260926',source:process.env.GITHUB_SHA,
    externalDelivery:false,syntheticReportRecords:55},null,2));
}finally{await db.$disconnect();}
console.log('Synthetic cloud fixture ready; no production data or credentials');
