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
 const {currentUser}=useAuth();const qc=useQueryClient();const id=manifest.id!;
 const key=['training-certificates',currentUser?.id,id];
 const query=useQuery({queryKey:key,queryFn:async()=>(await api.get(`/manifiestos/${id}/documentos-cap`)).data.data as DocumentRow[],refetchInterval:15000,staleTime:0});
 const [kind,setKind]=useState<'PARCIAL'|'FINAL'|null>(null),[amounts,setAmounts]=useState<Record<string,string>>({}),[method,setMethod]=useState(''),[note,setNote]=useState(''),[signature,setSignature]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false),request=useRef<{id:string;body:string}|null>(null);
 const operator=currentUser?.rol==='OPERADOR'&&currentUser.actorId===manifest.operadorId;
 const canRelease=operator&&['EN_TRATAMIENTO','TRATADO'].includes(manifest.estado||'');
 const final=query.data?.some(d=>d.documento.tipo==='FINAL');
 function open(tipo:'PARCIAL'|'FINAL'){
  setKind(tipo);setAmounts(Object.fromEntries((manifest.residuos||[]).map(r=>[r.id,tipo==='FINAL'?String(r.cantidadRecibida??''):''])));setSignature('');setError('');
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
 return <section aria-label="Certificados de capacitación" className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
  <h2 className="font-semibold">Certificados de capacitación</h2><p className="text-sm">El operador decide cuándo liberar cada documento y lo firma. Todos llevan la leyenda SIN VALIDEZ OFICIAL.</p>
  {query.isError?<p role="alert">No se pudieron cargar los certificados.</p>:query.isPending?<p>Cargando...</p>:<>
   {!query.data?.length&&<p className="text-sm">El operador todavía no liberó documentos.</p>}
   <ul className="space-y-2">{query.data?.map((d,i)=><li key={d.id} className="rounded border border-neutral-200 p-3"><p className="font-semibold">{d.documento.tipo==='FINAL'?'Disposición final':'Parcial '+(i+1)} · Liberado</p><p className="text-sm">{d.documento.cantidades.map(r=>`${r.corriente}: ${r.cantidad} ${r.unidad}`).join(' · ')}</p><Button variant="outline" onClick={()=>void download(d)}>Descargar {d.documento.tipo==='FINAL'?'final':'parcial '+(i+1)} CAP</Button></li>)}</ul>
  </>}
  {canRelease&&!final&&!kind&&<div className="flex flex-wrap gap-2"><Button onClick={()=>open('PARCIAL')}>Liberar certificado parcial</Button><Button disabled={manifest.estado!=='TRATADO'} onClick={()=>open('FINAL')}>Liberar disposición final</Button></div>}
  {operator&&!canRelease&&!final&&<p className="text-sm">Primero registrá recepción, pesaje y tratamiento. El final requiere Tratado y adendas resueltas.</p>}
  {kind&&<form onSubmit={release} className="space-y-3 border-t pt-3"><h3 className="font-semibold">{kind==='PARCIAL'?'Cantidad efectivamente tratada en este parcial':'Total tratado: incluye los parciales previos'}</h3>
   {(manifest.residuos||[]).map(r=><Input key={r.id} label={`Cantidad a certificar ${r.tipoResiduo?.codigo||r.id} (${r.unidad})`} type="number" min="0.001" step="any" required={kind==='FINAL'} disabled={kind==='FINAL'} value={amounts[r.id]||''} onChange={e=>setAmounts({...amounts,[r.id]:e.target.value})} helperText={`Pesaje recibido: ${r.cantidadRecibida??'pendiente'} ${r.unidad}. En un parcial, dejá vacío lo que no se certifica.`}/>)}
   <Input label="Método de tratamiento certificado" required maxLength={200} value={method} onChange={e=>setMethod(e.target.value)}/>
   <Input label="Observaciones del certificado" required maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
   <p className="font-medium">Firma del operador</p>{signature?<div><img className="max-h-28" src={signature} alt="Firma del operador"/><Button type="button" variant="outline" onClick={()=>setSignature('')}>Volver a firmar</Button></div>:<SignaturePad onConfirm={setSignature}/>}
   <div className="flex gap-2"><Button type="submit" disabled={busy||!signature}>{busy?'Guardando...':'Firmar y liberar documento CAP'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setKind(null)}>Cancelar</Button></div>
  </form>}
  {error&&<p role="alert">{error}</p>}
  <Button size="sm" variant="outline" onClick={()=>void query.refetch()}>Actualizar certificados</Button>
 </section>;
}
