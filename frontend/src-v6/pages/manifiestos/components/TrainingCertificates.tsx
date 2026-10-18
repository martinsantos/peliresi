import { Link } from 'react-router-dom';
import { useMobilePrefix } from '../../../hooks/useMobilePrefix';
import React,{useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {api} from '../../../services/api';
import {useAuth} from '../../../contexts/AuthContext';
import {Button} from '../../../components/ui/ButtonV2';
import {Input} from '../../../components/ui/Input';
import {SignaturePad} from '../../../components/ui/SignaturePad';
import type {Manifiesto} from '../../../types/models';
type DocumentRow={id:string;createdAt:string;documento:{tipo:string;cantidades:{residuoId:string;cantidad:number;corriente:string;unidad:string}[]}};
export function TrainingCertificates({manifest}:{manifest:Partial<Manifiesto>}){
 const {currentUser}=useAuth();const qc=useQueryClient();const id=manifest.id!;const mp=useMobilePrefix();
 const checks=useQuery({queryKey:['certificate-readiness',currentUser?.id,id],enabled:currentUser?.rol==='OPERADOR'&&manifest.estado==='TRATADO',queryFn:async()=>(await api.get(`/manifiestos/${id}/adendas`)).data.data.documental as {pendientes:number;observadas:number;rechazadas:number},refetchInterval:5000,staleTime:0});
 const unresolved=checks.data?checks.data.pendientes+checks.data.observadas+checks.data.rechazadas:null;
 const key=['training-certificates',currentUser?.id,id];
 const query=useQuery({queryKey:key,queryFn:async()=>(await api.get(`/manifiestos/${id}/documentos-cap`)).data.data as DocumentRow[],refetchInterval:15000,staleTime:0});
 const [kind,setKind]=useState<'PARCIAL'|'FINAL'|null>(null),[amounts,setAmounts]=useState<Record<string,string>>({}),[method,setMethod]=useState(''),[note,setNote]=useState(''),[signature,setSignature]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),request=useRef<{id:string;body:string}|null>(null);
 const operator=currentUser?.rol==='OPERADOR'&&currentUser.actorId===manifest.operadorId;
 const canRelease=operator&&['EN_TRATAMIENTO','TRATADO'].includes(manifest.estado||'');
 const final=query.data?.some(d=>d.documento.tipo==='FINAL');
 function open(tipo:'PARCIAL'|'FINAL'){
  setKind(tipo);setMethod((manifest as Partial<Manifiesto> & {tratamientoMetodo?:string}).tratamientoMetodo || '');setNote('');setAmounts(Object.fromEntries((manifest.residuos||[]).map(r=>[r.id,tipo==='FINAL'?String(r.cantidadRecibida??''):''])));setSignature('');setError('');
 }
 async function release(e:React.FormEvent){
  e.preventDefault();if(lock.current||!kind||!signature)return;lock.current=true;setBusy(true);setError('');
  const body={tipo:kind,firma:signature,metodo:method,nota:note,cantidades:Object.entries(amounts).filter(([,v])=>v!=='').map(([residuoId,v])=>({residuoId,cantidad:Number(v)}))};
  const content=JSON.stringify(body);if(request.current?.body!==content)request.current={id:crypto.randomUUID(),body:content};
  try{await api.post(`/manifiestos/${id}/documentos-cap`,{id:request.current.id,...body});setKind(null);setSignature('');request.current=null;await qc.invalidateQueries({queryKey:key});}
  catch(e:any){setError(e.response?.data?.message||'No se pudo liberar. Se conserva la carga para reintentar.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function download(document:DocumentRow){
  try{const {data}=await api.get(`/manifiestos/${id}/documentos-cap/${document.id}/archivo`,{responseType:'blob'});const url=URL.createObjectURL(data),a=window.document.createElement('a');a.href=url;a.download=`CAP-${document.documento.tipo}-${manifest.numero}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch{setError('No se pudo descargar el documento.');}
 }
 return <section id="certificaciones" aria-label="Certificaciones" className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
  <h2 className="text-xl font-bold">Certificaciones</h2><p className="text-sm">El operador firma y libera. Generador y transporte reciben un aviso y pueden descargar aquí el mismo documento.</p><p className="text-xs text-neutral-600">Práctica con datos artificiales · sin validez oficial.</p>
  {query.isError?<p role="alert">No se pudieron cargar los certificados.</p>:query.isPending?<p>Cargando...</p>:<>
   {!query.data?.length&&<p className="text-sm">El operador todavía no liberó documentos.</p>}
   <ul className="space-y-2">{query.data?.map((d,i)=><li key={d.id} className="rounded border border-neutral-200 p-3"><p className="font-semibold">{d.documento.tipo==='FINAL'?'Certificación final total':'Certificación parcial '+(i+1)} · Liberado</p><p className="text-sm">{d.documento.cantidades.map(r=>`${r.corriente}: ${r.cantidad} ${r.unidad}`).join(' · ')}</p><Button variant="outline" onClick={()=>void download(d)}>Descargar {d.documento.tipo==='FINAL'?'final':'parcial '+(i+1)} CAP</Button></li>)}</ul>
  </>}
  {canRelease&&!final&&!kind&&<div className="flex flex-wrap gap-2"><Button onClick={()=>open('PARCIAL')}>Emitir certificación parcial</Button><Button disabled={manifest.estado!=='TRATADO'||unresolved!==0} onClick={()=>open('FINAL')}>Emitir certificación final total</Button></div>}
  {operator&&canRelease&&!final&&<p className="text-sm text-neutral-700">{manifest.estado!=='TRATADO'?'Para emitir la final total: cerrá el tratamiento cuando corresponda.':unresolved===null?'Comprobando revisiones antes de la certificación final…':unresolved>0?<>{unresolved} adenda(s) por resolver antes del final. <Link className="font-semibold text-primary-800 underline" to={mp(`/manifiestos/${id}/adendas`)}>Ver qué falta resolver</Link></>:'Todo listo para firmar la certificación final total.'}</p>}
  {checks.isError&&<p role="alert">No pudimos comprobar las adendas. <button onClick={()=>void checks.refetch()} className="underline">Reintentar</button></p>}
  {operator&&!canRelease&&!final&&<p className="text-sm">Todavía falta recibir, pesar o registrar el tratamiento. Completá la acción que aparece arriba. La final se emite después del cierre y de resolver las adendas.</p>}
  {kind&&<form onSubmit={release} className="space-y-3 border-t pt-3"><h3 className="font-semibold">{kind==='PARCIAL'?'Cantidad efectivamente tratada en este parcial':'Total tratado: incluye los parciales previos'}</h3>
   {(manifest.residuos||[]).map(r=><Input key={r.id} label={`Cantidad a certificar ${r.tipoResiduo?.codigo||r.id} (${r.unidad})`} type="number" min="0.001" step="any" required={kind==='FINAL'} disabled={kind==='FINAL'} value={amounts[r.id]||''} onChange={e=>setAmounts({...amounts,[r.id]:e.target.value})} helperText={`Pesaje recibido: ${r.cantidadRecibida??'pendiente'} ${r.unidad}. En un parcial, dejá vacío lo que no se certifica.`}/>)}
   <p className="text-sm">Datos del manifiesto y pesaje ya incorporados. Revisá el método registrado y firmá.</p><Input label="Método de tratamiento certificado" required maxLength={200} value={method} onChange={e=>setMethod(e.target.value)}/>
   <Input label="Observaciones del certificado (opcional)" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
   <p className="font-medium">Firma del operador</p>{signature?<div><img className="max-h-28" src={signature} alt="Firma del operador"/><Button type="button" variant="outline" onClick={()=>setSignature('')}>Volver a firmar</Button></div>:<SignaturePad onConfirm={setSignature}/>}
   <div className="flex gap-2"><Button type="submit" disabled={busy||!signature}>{busy?'Guardando...':'Firmar y publicar certificación'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setKind(null)}>Cancelar</Button></div>
  </form>}
  {error&&<p role="alert">{error}</p>}
  <Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Actualizar certificados</Button>
 </section>;
}
