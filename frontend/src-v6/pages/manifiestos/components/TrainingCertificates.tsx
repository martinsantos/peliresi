import { Award, FileCheck2, LockKeyhole, CheckCircle2, Download } from 'lucide-react';
import { CardHeader } from '../../../components/ui/CardV2';
import { Link, useSearchParams } from 'react-router-dom';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import React,{useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../../../services/api';
import {useAuth} from '../../../contexts/AuthContext';
import {Button} from '../../../components/ui/ButtonV2';
import {Input} from '../../../components/ui/Input';
import {SignaturePad} from '../../../components/ui/SignaturePad';
import type {Manifiesto} from '../../../types/models';
type DocumentRow={id:string;numero?:string;createdAt:string;documento:{tipo:string;cantidades:{residuoId:string;cantidad:number;corriente:string;unidad:string}[]}};
export function TrainingCertificates({manifest}:{manifest:Partial<Manifiesto>}){
 const {currentUser}=useAuth();
 const scope=JSON.stringify([currentUser?.id,currentUser?.rol,currentUser?.actorId,currentUser?.empresaContexto?.empresaId,currentUser?.empresaContexto?.establecimientoId,manifest.id]);
 return currentUser?<CertificateContext key={scope} scope={scope} manifest={manifest}/>:null;
}
function CertificateContext({manifest,scope}:{manifest:Partial<Manifiesto>;scope:string}){
 const {currentUser}=useAuth();const qc=useQueryClient();const id=manifest.id!;const mp=useMobilePrefix();
 const training=!!currentUser?.training;
 const endpoint=`/manifiestos/${id}/${training?'documentos-cap':'certificados'}`;
 const checks=useQuery({queryKey:['certificate-readiness',scope],enabled:training&&currentUser?.rol==='OPERADOR'&&manifest.estado==='TRATADO',queryFn:async()=>(await api.get(`/manifiestos/${id}/adendas`)).data.data.documental as {pendientes:number;observadas:number;rechazadas:number},refetchInterval:5000,staleTime:0});

 const key=[training?'training-certificates':'manifest-certificates',scope];
 const query=useQuery({queryKey:key,queryFn:async()=>{const {data}=await api.get(endpoint);return {documents:data.data as DocumentRow[],enabled:training||data.emisionHabilitada===true,unresolved:data.adendasSinResolver as number};},refetchInterval:5000,staleTime:0});
 const unresolved=training?(checks.data?checks.data.pendientes+checks.data.observadas+checks.data.rechazadas:null):(query.data?.unresolved??null);
 const [searchParams]=useSearchParams();const selectedCertificate=searchParams.get('certificado');
 const scrolled=useRef('');
 useEffect(()=>{const target=selectedCertificate||id;if(query.data&&window.location.hash==='#certificaciones'&&scrolled.current!==target){(document.getElementById('certificado-'+selectedCertificate)||document.getElementById('certificaciones'))?.scrollIntoView({block:'start'});scrolled.current=target;}},[query.data,id,selectedCertificate]);
 const [kind,setKind]=useState<'PARCIAL'|'FINAL'|null>(null),[amounts,setAmounts]=useState<Record<string,string>>({}),[method,setMethod]=useState(''),[note,setNote]=useState(''),[signature,setSignature]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),request=useRef<{id:string;body:string}|null>(null);
 const operator=currentUser?.rol==='OPERADOR'&&currentUser.actorId===manifest.operadorId;
 const canRelease=operator&&!query.isError&&query.data?.enabled&&['EN_TRATAMIENTO','TRATADO'].includes(manifest.estado||'');
 const final=query.data?.documents.some(d=>d.documento.tipo==='FINAL');
 function open(tipo:'PARCIAL'|'FINAL'){
  setKind(tipo);setMethod((manifest as Partial<Manifiesto> & {tratamientoMetodo?:string}).tratamientoMetodo || '');setNote('');setAmounts(Object.fromEntries((manifest.residuos||[]).map(r=>[r.id,String(tipo==='FINAL'?(r.cantidadRecibida??''):Math.max(0,(r.cantidadRecibida??0)-(query.data?.documents.filter(d=>d.documento.tipo==='PARCIAL').flatMap(d=>d.documento.cantidades).filter(row=>row.residuoId===r.id).reduce((n,row)=>n+row.cantidad,0)??0))||'')])));setSignature('');setError('');
 }
 async function release(e:React.FormEvent){
  e.preventDefault();if(lock.current||!kind||!signature||!canRelease||(kind==='FINAL'&&(manifest.estado!=='TRATADO'||unresolved!==0||checks.isError)))return;lock.current=true;setBusy(true);setError('');
  const body={tipo:kind,firma:signature,metodo:method,nota:note,cantidades:Object.entries(amounts).filter(([,v])=>v!=='').map(([residuoId,v])=>({residuoId,cantidad:Number(v)}))};
  const content=JSON.stringify(body);if(request.current?.body!==content)request.current={id:crypto.randomUUID(),body:content};
  try{await api.post(endpoint,{id:request.current.id,...body});setKind(null);setSignature('');request.current=null;await qc.invalidateQueries({queryKey:key});await qc.invalidateQueries({queryKey:['manifiestos']});await qc.invalidateQueries({queryKey:['training-tasks']});}
  catch(e:any){setError(e.response?.data?.message||'No se pudo liberar. Se conserva la carga para reintentar.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function download(document:DocumentRow){
  try{const {data}=await api.get(`${endpoint}/${document.id}/archivo`,{responseType:'blob'});const url=URL.createObjectURL(data),a=window.document.createElement('a');a.href=url;a.download=`${training?'CAP':'SITREP'}-${document.documento.tipo}-${manifest.numero}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch{setError('No se pudo descargar el documento.');}
 }
 return <section id="certificaciones" aria-label="Certificaciones" className="scroll-mt-28 rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
  <CardHeader icon={<Award size={22}/>} title="Certificaciones" subtitle="El operador firma y emite. Las partes vinculadas reciben un aviso y pueden descargarlo."/>
  {query.isError?<p role="alert">No se pudieron comprobar los certificados. <Button variant="outline" onClick={()=>void query.refetch()}>Reintentar certificados</Button></p>:query.isPending?<p role="status">Comprobando certificados…</p>:<>
   <div className="grid grid-cols-2 gap-2" aria-label="Estado de certificaciones">{(['PARCIAL','FINAL'] as const).map(type=>{
    const issued=query.data?.documents.filter(d=>d.documento.tipo===type).length||0;
    const ready=canRelease&&!final&&(type==='PARCIAL'||manifest.estado==='TRATADO'&&unresolved===0&&!checks.isError);
    const Icon=issued?CheckCircle2:ready?FileCheck2:LockKeyhole;
    return <div key={type} className={`rounded-lg border p-3 ${issued?'border-emerald-200 bg-emerald-50 text-emerald-900':ready?'border-primary-200 bg-primary-50 text-primary-900':'border-neutral-200 bg-neutral-50 text-neutral-600'}`}><Icon size={22} aria-hidden="true"/><h3 className="mt-2 text-sm font-semibold">{type==='PARCIAL'?'Parcial':'Final total'}</h3><p className="mt-1 text-xs">{issued?`${issued} emitida${issued>1?'s':''}`:ready?'Lista para firmar':!operator?'Pendiente del operador':final?'No emitida':type==='PARCIAL'?'Requiere tratamiento':'Requiere cierre y adendas resueltas'}</p></div>;
   })}</div>
   <ul className="space-y-2">{query.data?.documents.map((d,i)=><li key={d.id} id={`certificado-${d.id}`} data-certificate-id={d.id} className={`scroll-mt-32 rounded border p-3 ${selectedCertificate===d.id?'border-primary-400 bg-primary-50':'border-neutral-200'}`}><p className="font-semibold">{d.documento.tipo==='FINAL'?'Certificación final total':'Certificación parcial '+(i+1)} · Liberado</p><p className="text-xs text-neutral-600 break-words">{d.numero || manifest.numero} · {new Date(d.createdAt).toLocaleString('es-AR')}</p><p className="text-sm">{d.documento.cantidades.map(r=>`${r.corriente}: ${r.cantidad} ${r.unidad}`).join(' · ')}</p><Button variant="outline" leftIcon={<Download size={16}/>} onClick={()=>void download(d)}>Descargar {d.documento.tipo==='FINAL'?'final':'parcial '+(i+1)}{training?' CAP':''}</Button></li>)}</ul>
  </>}
  {canRelease&&!final&&!kind&&<div className="flex flex-wrap gap-2"><Button variant={manifest.estado==='TRATADO'&&unresolved===0?'outline':'primary'} onClick={()=>open('PARCIAL')}>Emitir certificación parcial</Button><Button disabled={manifest.estado!=='TRATADO'||unresolved!==0||checks.isError} onClick={()=>open('FINAL')}>Emitir certificación final total</Button></div>}
  {operator&&canRelease&&!final&&<p className="text-sm text-neutral-700">{manifest.estado!=='TRATADO'?'Para emitir la final total: cerrá el tratamiento cuando corresponda.':unresolved===null?'Comprobando revisiones antes de la certificación final…':unresolved>0?<>{unresolved} adenda(s) por resolver antes del final. <Link className="font-semibold text-primary-800 underline" to={mp(`/manifiestos/${id}/adendas`)}>Ver qué falta resolver</Link></>:'Todo listo para firmar la certificación final total.'}</p>}
  {checks.isError&&<p role="alert">No pudimos comprobar las adendas. <button onClick={()=>void checks.refetch()} className="underline">Reintentar</button></p>}
  {operator&&query.data&&!query.data.enabled&&<p className="text-sm">La emisión está deshabilitada. Los documentos emitidos siguen disponibles.</p>}
  {operator&&query.data?.enabled&&!canRelease&&!final&&<p className="text-sm">Primero: recepción → pesaje → tratamiento.</p>}
  {kind&&<form onSubmit={release} className="space-y-3 border-t pt-3"><h3 className="font-semibold">{kind==='PARCIAL'?'Cantidad efectivamente tratada en este parcial':'Total tratado: incluye los parciales previos'}</h3>
   {(manifest.residuos||[]).map(r=><Input key={r.id} label={`Cantidad a certificar ${r.tipoResiduo?.codigo||r.id} (${r.unidad})`} type="number" min="0.001" step="any" required={kind==='FINAL'} disabled={kind==='FINAL'} value={amounts[r.id]||''} onChange={e=>setAmounts({...amounts,[r.id]:e.target.value})} helperText={`Pesaje recibido: ${r.cantidadRecibida??'pendiente'} ${r.unidad}. En un parcial, dejá vacío lo que no se certifica.`}/>)}
   <p className="text-sm">Datos del manifiesto y pesaje ya incorporados. Revisá el método registrado y firmá.</p><Input label="Método de tratamiento certificado" required maxLength={200} value={method} onChange={e=>setMethod(e.target.value)}/>
   <Input label="Observaciones del certificado (opcional)" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
   <p className="font-medium">Firma del operador</p>{signature?<div><img className="max-h-28" src={signature} alt="Firma del operador"/><Button type="button" variant="outline" onClick={()=>setSignature('')}>Volver a firmar</Button></div>:<SignaturePad onConfirm={setSignature}/>}
   <div className="flex gap-2"><Button type="submit" disabled={busy||!signature||!canRelease||(kind==='FINAL'&&(manifest.estado!=='TRATADO'||unresolved!==0||checks.isError))}>{busy?'Guardando...':'Firmar y publicar certificación'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setKind(null)}>Cancelar</Button></div>
  </form>}
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-neutral-600">{training?'Capacitación · sin validez oficial':'Cada documento emitido conserva su firma y contenido.'}</span><Button size="sm" variant="ghost" onClick={()=>void query.refetch()}>Actualizar certificados</Button></div>
 </section>;
}
