import { it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import { execFileSync } from 'node:child_process';
import { renderManifestPdf } from '../../services/manifestPdf.service';
import { renderManifestCertificate } from '../../services/manifestCertificate.service';
let sig: string;
beforeAll(async()=>{const svg='<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="white"/><text x="12" y="50" font-family="sans-serif" font-size="28" fill="#172c24">FIRMA QA · ARTIFICIAL</text><path d="M12 68 H388" stroke="#526359" fill="none"/></svg>';sig='data:image/png;base64,'+(await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');});
function fixture(long=false){
 const actor={razonSocial:'QA Gestión de residuos '+(long?'industriales y sanitarios de establecimientos de Mendoza '.repeat(8):'Mendoza'),cuit:'99-00000000-0',numeroHabilitacion:'QA-HAB',numeroInscripcion:'QA-INS',domicilio:'Domicilio artificial 123, Mendoza'};
 return {numero:long?'QA-DISEÑO-EXTENSO':'QA-DISEÑO-0001',estado:'TRATADO',createdAt:new Date('2026-10-23T13:00:00Z'),generador:actor,operador:{...actor,razonSocial:'QA Operador de destino'},transportista:{...actor,razonSocial:'QA Transportista'},transportistaId:'qa-transporte',residuos:Array.from({length:long?28:2},(_,i)=>({tipoResiduo:{codigo:'Y'+(i+1),nombre:long?'Descripción completa '+i+' con observaciones '.repeat(8):'Residuos de atención sanitaria'},cantidad:21+i,unidad:'kg'})),observaciones:long?'OBSERVACIÓN COMPLETA '.repeat(150):'Datos artificiales para revisión de diseño. Sin validez oficial.',fechaFirma:new Date('2026-10-23T13:01:00Z'),eventos:[{tipo:'FIRMA',firmaImagen:sig,firmaSha256:'a'.repeat(64),createdAt:new Date('2026-10-23T13:01:00Z'),usuario:{nombre:'QA',apellido:'Generador'}}]};
}
function inspect(bytes:Buffer,name:string){
 const dir=process.env.QA_ARTIFACTS?path.join(process.env.QA_ARTIFACTS,'pdf'):fs.mkdtempSync(path.join(os.tmpdir(),'sitrep-pdf-design-'));
 fs.mkdirSync(dir,{recursive:true});const filename=path.join(dir,name+'.pdf');fs.writeFileSync(filename,bytes);
 const raw=execFileSync('pdftotext',['-raw',filename,'-'],{encoding:'utf8'}),bbox=execFileSync('pdftotext',['-bbox',filename,'-'],{encoding:'utf8'});
 const words=[...bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)];
 expect(words.length).toBeGreaterThan(50);
 for(const w of words){expect(Number(w[1])).toBeGreaterThanOrEqual(40);expect(Number(w[3])).toBeLessThanOrEqual(554);expect(Number(w[4])).toBeLessThan(820);}
 const pages=raw.split('\f').filter(p=>p.trim());pages.forEach((p,i)=>{expect(p).toContain('SITREP');expect(p).toContain('Página '+(i+1));});
 return {text:raw.replace(/\s+/g,' '),pages};
}
it.each([false,true])('preserves records, signatures and page boundaries; long=%s',async long=>{
 const m=fixture(long),before=JSON.stringify(m),pdf=inspect(await renderManifestPdf(m),long?'manifiesto-extenso':'manifiesto');
 expect(JSON.stringify(m)).toBe(before);expect(pdf.text).toContain('Firma manuscrita adjunta');expect(pdf.text).toContain('a'.repeat(64));
 for(const r of m.residuos)expect(pdf.text).toContain(r.tipoResiduo.codigo);
 if(long){expect(pdf.pages.length).toBeGreaterThan(3);expect(pdf.text.match(/OBSERVACIÓN\b/g)).toHaveLength(150);expect(pdf.text.match(/COMPLETA\b/g)).toHaveLength(150);}
});
it('in situ and unsigned is honest',async()=>{
 const m={...fixture(),transportista:null,fechaFirma:null,estado:'BORRADOR'};
 const pdf=inspect(await renderManifestPdf(m),'manifiesto-in-situ');expect(pdf.text).toContain('sin transporte');expect(pdf.text).not.toContain('Firma manuscrita adjunta');
});
it('identifies an in-situ approving carrier without inventing a vehicle or trip',async()=>{
 const m={...fixture(),modalidad:'IN_SITU'};
 const pdf=inspect(await renderManifestPdf(m),'manifiesto-in-situ-aprobador');
 expect(pdf.text).toContain('MANIFIESTO · TRATAMIENTO EN ORIGEN');
 expect(pdf.text).toContain('TRANSPORTE APROBADOR');
 expect(pdf.text).toContain('sin traslado ni viaje');
 expect(pdf.text).not.toContain('Vehículo asignado');
 expect(pdf.text).not.toContain('Chofer asignado');
});
it('labels every page of an artificial manifest and leaves the original unchanged',async()=>{
 const manifest={...fixture(true),isDemoData:true};
 const before=JSON.stringify(manifest);
 const pdf=inspect(await renderManifestPdf(manifest),'manifiesto-artificial');
 expect(pdf.pages.length).toBeGreaterThan(3);
 for(const page of pdf.pages) expect(page).toContain('DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL');
 expect(JSON.stringify(manifest)).toBe(before);
});
it('does not label an operational manifest as artificial',async()=>{
 const manifest={...fixture(),isDemoData:false,observaciones:'Observación operativa'};
 const pdf=inspect(await renderManifestPdf(manifest),'manifiesto-operativo');
 expect(pdf.text).not.toContain('DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL');
 expect(pdf.text).toContain('Observación operativa');
});
it.each(['PARCIAL','FINAL'] as const)('certificate retains snapshot and integrity %s',async tipo=>{
 const data={version:1 as const,tipo,numero:'QA-CERT-'+tipo,manifiestoNumero:'QA-DISEÑO-0001',generador:'QA Generador',transportista:'QA Transporte',operador:'QA Operador',autor:'QA Emisor',fecha:'2026-10-23T13:00:00Z',metodo:'Método declarado artificial',nota:'Prueba de diseño',cantidades:[{corriente:'Y1',cantidad:21,unidad:'kg'}],parcialesPrevios:tipo==='FINAL'?['QA-CERT-PARCIAL']:[],adendas:[{id:'qa-adenda',version:1}],firmaSha256:'b'.repeat(64),artificial:true};
 const before=JSON.stringify(data),pdf=inspect(await renderManifestCertificate(data,'qa-certificate',sig),'certificado-'+tipo.toLowerCase());
 expect(pdf.pages).toHaveLength(1);expect(JSON.stringify(data)).toBe(before);expect(pdf.text).toContain('SIN VALIDEZ OFICIAL');expect(pdf.text).toContain('Firma manuscrita del operador');expect(pdf.text).toContain('b'.repeat(64));
 expect(pdf.text).toContain(tipo==='FINAL'?'Adendas resueltas':'Adendas vinculadas');
 expect(pdf.text).toMatch(/Adenda 1\s*·\s*versión 1/);expect(pdf.text).not.toContain('qa-adenda');
});
it('does not label an operational certificate as artificial',async()=>{
 const data={version:1 as const,tipo:'PARCIAL' as const,numero:'QA-CERT-OPERATIVO',manifiestoNumero:'QA-1',
  generador:'QA Generador',transportista:'QA Transporte',operador:'QA Operador',autor:'QA Emisor',
  fecha:'2026-10-23T13:00:00Z',metodo:'Método declarado',nota:'',
  cantidades:[{corriente:'Y1',cantidad:1,unidad:'kg'}],parcialesPrevios:[],adendas:[],firmaSha256:'b'.repeat(64),artificial:false};
 const pdf=inspect(await renderManifestCertificate(data,'qa-operational',sig),'certificado-operativo');
 expect(pdf.text).not.toContain('DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL');
 expect(pdf.text).toContain('Firma manuscrita del operador');
});
it('keeps a short final with a prior partial and an approved finding together',async()=>{
 const data={version:1 as const,tipo:'FINAL' as const,numero:'2026-000269-F',manifiestoNumero:'2026-000269',
  generador:'QA Generador 1',transportista:'QA Transporte 1',operador:'QA Operador 1',autor:'QA operador',
  fecha:'2026-10-29T02:18:53.000Z',metodo:'QA ESTABILIZACION',nota:'',
  cantidades:[{residuoId:'qa-y1',corriente:'Y1',cantidad:22,unidad:'kg'},
   {residuoId:'qa-y12',corriente:'Y12',cantidad:1,unidad:'kg',origen:'HALLAZGO' as const,adendas:[{id:'qa-rectificacion',version:1}]}],
  parcialesPrevios:['2026-000269-P01'],adendas:[{id:'qa-original',version:1},{id:'qa-rectificacion',version:1}],
  firmaSha256:'b'.repeat(64),artificial:true};
 const before=JSON.stringify(data);
 const pdf=inspect(await renderManifestCertificate(data,'290428d0-4557-420d-8ff0-ec77aca526e6',sig),'certificado-rectificacion-compacto');
 expect(pdf.pages).toHaveLength(1);
 expect(pdf.pages[0]).toContain('Firma manuscrita del operador');
 expect(pdf.text).toContain('Y12'); expect(pdf.text).toContain('adenda 2'); expect(JSON.stringify(data)).toBe(before);
});
it('renders 200 certified quantities across pages without clipping',async()=>{
 const data={version:1 as const,tipo:'FINAL' as const,numero:'QA-CERT-200',manifiestoNumero:'QA-1',generador:'QA Generador',transportista:'QA Transporte',operador:'QA Operador',autor:'QA Emisor',fecha:'2026-10-23T13:00:00Z',metodo:'Método QA',nota:'',cantidades:Array.from({length:200},(_,i)=>({residuoId:`r${i}`,corriente:`Y${i+1}`,cantidad:1,unidad:'kg'})),parcialesPrevios:[],adendas:[],firmaSha256:'b'.repeat(64),artificial:true};
 const pdf=inspect(await renderManifestCertificate(data,'qa-200',sig),'certificado-200');
 expect(pdf.pages.length).toBeGreaterThan(3);
 for(const page of pdf.pages) expect(page).toContain('DATOS ARTIFICIALES · SIN VALIDEZ OFICIAL');
 expect(pdf.text).toMatch(/Y1\s+1\s+kg/);
 expect(pdf.text).toMatch(/Y200\s+1\s+kg/);
 expect(pdf.text).toContain('Firma manuscrita del operador');
 const signaturePage=pdf.pages.find(page=>page.includes('Firma manuscrita del operador'));
 expect(signaturePage).toContain('Huella de la firma');
},15000);
it('distinguishes treated findings from findings declared not treated in the final PDF',async()=>{
 const data={version:1 as const,tipo:'FINAL' as const,numero:'QA-CERT-F',manifiestoNumero:'QA-1',generador:'QA Generador',transportista:'QA Transporte',operador:'QA Operador',autor:'QA Emisor',fecha:'2026-10-23T13:00:00Z',metodo:'Método QA',nota:'',cantidades:[{residuoId:'hallazgo:Y12:kg',corriente:'Y12',cantidad:1,unidad:'kg',origen:'HALLAZGO' as const,adendas:[{id:'a',version:1}]}],parcialesPrevios:[],adendas:[{id:'a',version:1}],hallazgosNoTratados:[{id:'hallazgo:Y13:kg',corriente:'Y13',unidad:'kg',observado:2,adendas:[{id:'a',version:1}]}],firmaSha256:'b'.repeat(64),artificial:true};
 const pdf=inspect(await renderManifestCertificate(data,'qa-findings',sig),'certificado-hallazgos');
 expect(pdf.text).toMatch(/Y12\s+1\s+kg/);
 expect(pdf.pages).toHaveLength(1);
 expect(pdf.text).toContain('No tratadas en esta certificación');
 expect(pdf.text).toContain('Y13');
 expect(pdf.text).toContain('Origen de corrientes');
 expect(pdf.text).toMatch(/Y12\s*·\s*adenda 1/i);
 expect(pdf.text).toMatch(/Adenda 1\s*·\s*versión 1/i);
});
