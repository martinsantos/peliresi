import { readSupportCommandRecord, updateSupportCommandRecord } from './supportCommandStore';
export type CertificateScope={userId:string;context:string;manifestId:string};
export type CertificateInput={tipo:'PARCIAL'|'FINAL';firma:string;metodo:string;nota:string;cantidades:{residuoId:string;cantidad:number}[];exclusionesHallazgos?:string[]};
export type CertificateReceipt={id:string;status:'confirmed'|'withdrawn';numero?:string;pdfSha256?:string};
export type CertificateCommand={id:string;scope:CertificateScope;key:string;input:CertificateInput;status:'pending'|'confirmed'|'withdrawn';receipt?:CertificateReceipt};
export const certificateCommandKey=(s:CertificateScope)=>JSON.stringify(['certificate-v1',s.userId,s.context,s.manifestId]);
function verify(c:CertificateCommand,s:CertificateScope) {
 if(!s.userId||!s.context||!s.manifestId||c.id!==certificateCommandKey(s)||JSON.stringify(c.scope)!==JSON.stringify(s)
 ||!c.key||!['pending','confirmed','withdrawn'].includes(c.status)||!['PARCIAL','FINAL'].includes(c.input?.tipo)
 ||typeof c.input.firma!=='string'||!c.input.firma||typeof c.input.metodo!=='string'||typeof c.input.nota!=='string'
 ||!Array.isArray(c.input.cantidades)||!c.input.cantidades.length||c.input.cantidades.some(r=>!r.residuoId||!Number.isFinite(r.cantidad)||r.cantidad<=0)
 ||c.input.exclusionesHallazgos!==undefined&&(!Array.isArray(c.input.exclusionesHallazgos)||c.input.exclusionesHallazgos.some(id=>typeof id!=='string'||!id)||new Set(c.input.exclusionesHallazgos).size!==c.input.exclusionesHallazgos.length)) throw Error('No pudimos verificar la solicitud guardada. Conservamos la copia sin reenviarla.');
}
export async function loadCertificateCommand(s:CertificateScope) {
 const c=await readSupportCommandRecord<CertificateCommand>(certificateCommandKey(s));if(c)verify(c,s);return c;
}
export async function claimCertificateCommand(s:CertificateScope,key:string,input:CertificateInput) {
 const proposed:CertificateCommand={id:certificateCommandKey(s),scope:{...s},key,input:structuredClone(input),status:'pending'};verify(proposed,s);
 return (await updateSupportCommandRecord<CertificateCommand>(proposed.id,c=>{if(c){verify(c,s);return c;}return proposed;}))!;
}
export async function settleCertificateCommand(s:CertificateScope,key:string,receipt:CertificateReceipt) {
 if(receipt.id!==key||!['confirmed','withdrawn'].includes(receipt.status)||receipt.status==='confirmed'&&(!receipt.numero||!receipt.pdfSha256)) throw Error('No pudimos verificar el resultado de esta certificación.');
 return (await updateSupportCommandRecord<CertificateCommand>(certificateCommandKey(s),c=>{
  if(!c||c.key!==key)throw Error('La solicitud cambió en otra pestaña.');verify(c,s);
  if(c.status==='confirmed')return c;return {...c,status:receipt.status,receipt};
 }))!;
}
export async function releaseCertificateCommand(s:CertificateScope,key:string) {
 await updateSupportCommandRecord<CertificateCommand>(certificateCommandKey(s),c=>{
  if(!c)return null;verify(c,s);if(c.key!==key||c.status==='pending')throw Error('Comprobá primero el resultado de la solicitud.');return null;
 });
}
