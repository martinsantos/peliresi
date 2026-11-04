import { beforeEach, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
const mock=vi.hoisted(()=>({find:vi.fn(),certificate:vi.fn()}));
vi.mock('../../lib/prisma',()=>({default:{manifiesto:{findUnique:mock.find},certificadoManifiesto:{findFirst:mock.certificate}}}));
vi.mock('../../utils/roleFilter',()=>({canAccessManifiesto:()=>true}));
import { generarCertificado } from '../../controllers/pdf.controller';
beforeEach(()=>vi.clearAllMocks());
it('keeps the complete legacy certificate title and records under the shared identity',async()=>{
 const record={id:'qa-legacy-pdf',numero:'QA-ANTERIOR-0001',estado:'TRATADO',generador:{razonSocial:'QA Generador',cuit:'99-00000000-0'},operador:{razonSocial:'QA Operador',cuit:'99-00000001-0'},residuos:[{tipoResiduo:{codigo:'Y1',nombre:'Residuo artificial'},cantidad:12,unidad:'kg'}],eventos:[{tipo:'CIERRE',descripcion:'Método declarado en el antecedente'}],fechaRecepcion:new Date('2026-10-23T13:00:00Z'),fechaCierre:new Date('2026-10-23T14:00:00Z')};
 const before=JSON.stringify(record);mock.find.mockResolvedValue(record);
 const res=new PassThrough() as any;res.setHeader=vi.fn();const chunks:Buffer[]=[];res.on('data',(b:Buffer)=>chunks.push(b));
 const done=new Promise<void>((resolve,reject)=>{res.on('finish',resolve);res.on('error',reject)});const next=vi.fn();
 await generarCertificado({params:{id:record.id},user:{id:'qa'}} as any,res,next);expect(next).not.toHaveBeenCalled();await done;
 const directory=process.env.QA_ARTIFACTS?path.join(process.env.QA_ARTIFACTS,'pdf'):fs.mkdtempSync(path.join(os.tmpdir(),'pdf-identity-'));
 fs.mkdirSync(directory,{recursive:true});const file=path.join(directory,'certificado-anterior.pdf');fs.writeFileSync(file,Buffer.concat(chunks));
 const text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'}).replace(/\s+/g,' ');
 expect(text).toContain('Certificado de tratamiento y disposición final');expect(text).toContain('CERT-QA-ANTERIOR-0001');expect(text).toContain('Método declarado en el antecedente');expect(text).toContain('SITREP');expect(text).toContain('12 kg');expect(JSON.stringify(record)).toBe(before);
});
it('returns the exact stored signed bytes without regenerating historical certificates',async()=>{
 mock.find.mockResolvedValue({estado:'TRATADO',eventos:[{tipo:'CERTIFICACION_OPERADOR_V1'}]});
 const pdf=Buffer.from('%PDF-signed-artificial-preserved');mock.certificate.mockResolvedValue({id:'qa-signed',tipo:'FINAL',pdf,pdfSha256:'immutable-hash'});
 const res={setHeader:vi.fn(),send:vi.fn()},next=vi.fn();await generarCertificado({params:{id:'qa'},user:{id:'qa'}} as any,res as any,next);
 expect(next).not.toHaveBeenCalled();expect(res.send).toHaveBeenCalledWith(pdf);expect(res.setHeader).toHaveBeenCalledWith('X-Document-SHA256','immutable-hash');
});
