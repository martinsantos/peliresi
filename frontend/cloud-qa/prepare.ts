import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';
import { loadSeed } from './load-seed.ts';

await assertCloudDatabase();
const output=process.env.QA_ARTIFACTS!;
await mkdir(path.join(output,'uploads'),{recursive:true});
const {seedNightDatabase}=loadSeed();
const fixture=await seedNightDatabase();
const {PrismaClient}=backendRequire('@prisma/client');
const db=new PrismaClient();
try {
  // Address assistance uses real catalog fields, populated only in the guarded synthetic DB.
  await db.generador.update({ where: { id: fixture.actors.generador }, data: {
    domicilio: 'QA Registro 100', domicilioRealCalle: 'QA Planta 200', domicilioRealLocalidad: 'Las Heras',
    domicilioLegalCalle: 'QA Oficina 300', domicilioLegalDepto: 'Capital',
  } });
  await db.generador.update({ where: { id: fixture.actors.generador2 }, data: { domicilio: 'QA Otro 400', domicilioLegalCalle: 'A'.repeat(301) } });
  // Missing location stays missing. No real address is sent to a geocoder.
  await db.transportista.update({ where: { id: fixture.actors.transportista2 }, data: {
    domicilio: '', latitud: null, longitud: null,
  } });
  await db.operador.update({ where: { id: fixture.actors.operador }, data: {
    domicilioRealCalle: 'QA Tratamiento 500', domicilioRealDepto: 'Godoy Cruz',
  } });
  await db.sedeOperador.upsert({ where: { id: 'cloud-qa-operator-site' },
    create: { id: 'cloud-qa-operator-site', operadorId: fixture.actors.operador, nombre: 'QA Sede norte', tipo: 'FIJO', domicilio: 'QA Acceso 600', activo: true },
    update: { domicilio: 'QA Acceso 600', activo: true },
  });
  const deviceManifest = await db.manifiesto.create({data:{
    numero:'2026-990001', generadorId:fixture.actors.generador,
    transportistaId:fixture.actors.transportista, operadorId:fixture.actors.operador,
    creadoPorId:fixture.users.admin, estado:'EN_TRANSITO', isDemoData:true, modalidad:'FIJO',
    fechaRetiro:new Date(), observaciones:'QA Android GPS y lector QR; datos completamente sintéticos',
    residuos:{create:[{tipoResiduoId:fixture.wastes[0],cantidad:10,unidad:'kg',estado:'SOLIDO'}]},
  }});
  // The PDF emits this JSON shape. Only optical input is synthetic: jsQR,
  // navigation, real login and the business API remain unmodified during E2E.
  const payload=JSON.stringify({numero:deviceManifest.numero,id:deviceManifest.id,timestamp:new Date().toISOString()});
  const matrix=backendRequire('qrcode').create(payload,{errorCorrectionLevel:'M'}).modules;
  const size=320,scale=Math.floor(size/(matrix.size+8)),offset=Math.floor((size-matrix.size*scale)/2);
  const frame=Buffer.alloc(size*size*3/2,128);frame.fill(235,0,size*size);
  for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x)){
    for(let dy=0;dy<scale;dy++)frame.fill(16,(offset+y*scale+dy)*size+offset+x*scale,(offset+y*scale+dy)*size+offset+(x+1)*scale);
  }
  await writeFile(path.join(output,'qr-camera.y4m'),Buffer.concat([
    Buffer.from(`YUV4MPEG2 W${size} H${size} F5:1 Ip A1:1 C420\n`),
    ...Array.from({length:5},()=>[Buffer.from('FRAME\n'),frame]).flat(),
  ]));
  // Explicit synthetic page-two/mixed-unit data, not business responses or fake auth.
  for(let i=0;i<155;i++)await db.manifiesto.upsert({
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
  // A real persisted observation older than seven days proves the restored month
  // is not merely a new selector over the former seven-day API cap.
  const historicalTimestamp = new Date(Date.now() - 20 * 86400000);
  await db.manifiesto.update({ where: { id: 'cloud-qa-report-0' }, data: {
    createdAt: historicalTimestamp, fechaRetiro: historicalTimestamp,
  } });
  await db.trackingGPS.create({ data: { id: 'cloud-qa-monitor-20-days',
    manifiestoId: 'cloud-qa-report-0', latitud: -32.8895, longitud: -68.8458,
    timestamp: historicalTimestamp,
  } });
  await writeFile(path.join(output,'fixture.json'),JSON.stringify({
    ...fixture,deviceManifest:{id:deviceManifest.id,numero:deviceManifest.numero},database:'sitrep_night_qa_20260926',source:process.env.GITHUB_SHA,
    externalDelivery:false,syntheticReportRecords:155},null,2));
}finally{await db.$disconnect();}
console.log('Synthetic cloud fixture ready; no production data or credentials');
