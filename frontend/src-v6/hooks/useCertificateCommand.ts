import { useEffect,useRef,useState } from 'react';
import { api } from '../services/api';
import { supportRequestContext,supportSessionMatches } from '../utils/supportSession';
import { certificateCommandKey,claimCertificateCommand,loadCertificateCommand,settleCertificateCommand,releaseCertificateCommand,type CertificateCommand,type CertificateInput,type CertificateScope,type CertificateReceipt } from '../services/certificateCommand';
const message=(e:unknown)=>(e as {response?:{data?:{message?:string}}})?.response?.data?.message||(e instanceof Error?e.message:'No pudimos confirmar la emisión.');
export function useCertificateCommand(scope:CertificateScope,enabled:boolean) {
 const [command,setCommand]=useState<CertificateCommand|null>(null),[ready,setReady]=useState(!enabled),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const alive=useRef(true),lock=useRef(false),generation=useRef(0),channel=useRef<BroadcastChannel|null>(null),context=useRef(supportRequestContext());
 const key=certificateCommandKey(scope),endpoint='/manifiestos/'+scope.manifestId+'/certificados';
 const active=()=>alive.current&&supportSessionMatches(scope.userId)&&!!context.current&&context.current===supportRequestContext();
 async function reload(){
  if(!enabled||lock.current)return;const n=++generation.current;
  try {const c=await loadCertificateCommand(scope);if(active()&&n===generation.current){setCommand(c);setReady(true);setError('');}}
  catch(e){if(active()&&n===generation.current){setReady(false);setError(message(e));}}
 }
 const announce=()=>channel.current?.postMessage('changed');
 useEffect(()=>{
  alive.current=true;if(enabled)void reload();
  const refresh=()=>void reload();window.addEventListener('focus',refresh);
  if(enabled&&typeof BroadcastChannel!=='undefined'){channel.current=new BroadcastChannel('sitrep-certificate-'+key);channel.current.onmessage=refresh;}
  return()=>{alive.current=false;generation.current++;window.removeEventListener('focus',refresh);channel.current?.close();channel.current=null;};
 },[key,enabled]);
 async function run(input?:CertificateInput,recover=false){
  if(!enabled||!ready||lock.current||!active())return;lock.current=true;generation.current++;setBusy(true);setError('');
  try{
   const proposed=input?crypto.randomUUID():null;
   const c=input?await claimCertificateCommand(scope,proposed!,input):await loadCertificateCommand(scope);
   if(!active())return;setCommand(c);announce();
   if(!c){setError('No hay una solicitud pendiente.');return;}
   if(proposed&&proposed!==c.key){setError('Hay una solicitud anterior guardada. Comprobá su resultado antes de emitir otra.');return;}
   if(c.status!=='pending')return;
   const response=await api.post(recover?endpoint+'/'+c.key+'/recuperar':endpoint,recover?{}:{id:c.key,...c.input});
   const receipt:CertificateReceipt={...response.data.data,status:recover?response.data.data.status:'confirmed'};
   if(receipt.id!==c.key||!['confirmed','withdrawn'].includes(receipt.status)||receipt.status==='confirmed'&&(!receipt.numero||!receipt.pdfSha256))throw Error('La respuesta no identifica esta certificación. Conservamos la solicitud.');
   if(active())setCommand({...c,status:receipt.status,receipt});
   try {const settled=await settleCertificateCommand(scope,c.key,receipt);if(active())setCommand(settled);announce();}
   catch {if(active())setError('El servidor confirmó el resultado. No pudimos guardarlo aquí; al reabrir se conserva la misma solicitud.');}
  }catch(e){if(active())setError(message(e));}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 async function release(before:(c:CertificateCommand)=>Promise<void>){
  if(!command||command.status==='pending'||lock.current||!active())return;lock.current=true;generation.current++;setBusy(true);setError('');
  try {await before(command);if(!active())return;await releaseCertificateCommand(scope,command.key);if(active())setCommand(null);announce();}
  catch(e){if(active())setError(message(e));}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return{command,ready,busy,error,reload,submit:(input:CertificateInput)=>run(input),retry:()=>run(),recover:()=>run(undefined,true),release};
}
