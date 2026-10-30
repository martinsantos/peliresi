import { useCertificateDraft } from '../../../hooks/useCertificateDraft';
import { useImpersonation } from '../../../contexts/ImpersonationContext';
import { useCertificateCommand } from '../../../hooks/useCertificateCommand';
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
type DocumentRow={id:string;numero?:string;pdfSha256?:string;createdAt:string;documento:{tipo:string;cantidades:{residuoId:string;cantidad:number;corriente:string;unidad:string}[]}};
type Finding={id:string;corriente:string;unidad:string;observado:number;adendas:{id:string;version:number}[]};
export function TrainingCertificates({manifest}:{manifest:Partial<Manifiesto>}){
 const {currentUser,isRestricted}=useAuth();const {impersonationData}=useImpersonation();
 const scope=JSON.stringify([currentUser?.id,currentUser?.rol,currentUser?.actorId,currentUser?.empresaContexto?.empresaId,currentUser?.empresaContexto?.actividadId,currentUser?.empresaContexto?.establecimientoId,currentUser?.training,!!isRestricted,!!impersonationData,manifest.id]);
 return currentUser?<CertificateContext key={scope} scope={scope} manifest={manifest}/>:null;
}
function CertificateContext({manifest,scope}:{manifest:Partial<Manifiesto>;scope:string}){
 const {currentUser,isRestricted}=useAuth();const {impersonationData}=useImpersonation();const readOnly=!!isRestricted||!!impersonationData&&!currentUser?.training;const qc=useQueryClient();const id=manifest.id!;const mp=useMobilePrefix();
 const training=!!currentUser?.training;
 const endpoint=`/manifiestos/${id}/${training?'documentos-cap':'certificados'}`;
 const checks=useQuery({queryKey:['certificate-readiness',scope],enabled:training&&currentUser?.rol==='OPERADOR'&&manifest.estado==='TRATADO',queryFn:async()=>(await api.get(`/manifiestos/${id}/adendas`)).data.data.documental as {pendientes:number;observadas:number;rechazadas:number},refetchInterval:5000,staleTime:0});

 const key=[training?'training-certificates':'manifest-certificates',scope];
 const query=useQuery({queryKey:key,queryFn:async()=>{const {data}=await api.get(endpoint);return {documents:data.data as DocumentRow[],enabled:training||data.emisionHabilitada===true,unresolved:data.adendasSinResolver as number,findings:(data.hallazgos||[]) as Finding[],findingProblems:(data.problemasHallazgos||[]) as string[]};},refetchInterval:5000,staleTime:0});
 const unresolved=training?(checks.data?checks.data.pendientes+checks.data.observadas+checks.data.rechazadas:null):(query.data?.unresolved??null);
 const [searchParams]=useSearchParams();const selectedCertificate=searchParams.get('certificado');
 const scrolled=useRef('');
 useEffect(()=>{const target=selectedCertificate||id;if(query.data&&window.location.hash==='#certificaciones'&&scrolled.current!==target){(document.getElementById('certificado-'+selectedCertificate)||document.getElementById('certificaciones'))?.scrollIntoView({block:'start'});scrolled.current=target;}},[query.data,id,selectedCertificate]);
 const [capKind,setCapKind]=useState<'PARCIAL'|'FINAL'|null>(null),[capAmounts,setCapAmounts]=useState<Record<string,string>>({}),[capMethod,setCapMethod]=useState(''),[capNote,setCapNote]=useState(''),[signature,setSignature]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const findings=query.data?.findings||[];
 const priorFindings=query.data?.documents.filter(d=>d.documento.tipo==='PARCIAL').flatMap(d=>d.documento.cantidades).filter(row=>row.residuoId.startsWith('hallazgo:'))||[];
 const priorFindingProblems=priorFindings.some(row=>!findings.some(f=>f.id===row.residuoId))
  ? ['Un hallazgo ya certificado no coincide con las adendas actuales; revisá los parciales y las rectificaciones.']
  : findings.some(f=>priorFindings.filter(row=>row.residuoId===f.id).reduce((n,row)=>n+row.cantidad,0)>f.observado+1e-9)
   ? ['Una cantidad ya certificada supera lo observado en la adenda actual; revisá los parciales y las rectificaciones.'] : [];
 const findingProblems=[...(query.data?.findingProblems||[]),...priorFindingProblems];
 const findingVersion=JSON.stringify(findings);
 const previousFindingVersion=useRef(findingVersion);
 useEffect(()=>{if(previousFindingVersion.current!==findingVersion){previousFindingVersion.current=findingVersion;setSignature('');}},[findingVersion]);
 const lock=useRef(false),request=useRef<{id:string;body:string}|null>(null);
 const operator=currentUser?.rol==='OPERADOR'&&currentUser.actorId===manifest.operadorId&&!readOnly;
 const recovery=useCertificateCommand({userId:String(currentUser!.id),context:scope,manifestId:id},operator&&!training);
 const confirmedReceipt=recovery.command?.status==='confirmed'?recovery.command.receipt:undefined;
 // Only collapse the saved receipt when this exact signed document is actually visible.
 const receiptInList=!!confirmedReceipt?.numero&&!!confirmedReceipt.pdfSha256&&!query.isPending&&!query.isError&&
  query.data?.documents.some(d=>d.id===recovery.command?.key&&d.id===confirmedReceipt.id&&d.numero===confirmedReceipt.numero&&d.pdfSha256===confirmedReceipt.pdfSha256&&d.documento.tipo===recovery.command?.input.tipo);
 const draft=useCertificateDraft({userId:String(currentUser!.id),context:scope,manifestId:id},operator&&!training);
 const [collapsed,setCollapsed]=useState(false),[discarding,setDiscarding]=useState(false);
 const kind=training?capKind:draft.draft?.kind??null, amounts=training?capAmounts:draft.draft?.amounts??{}, method=training?capMethod:draft.draft?.method??'', note=training?capNote:draft.draft?.note??'';
 const canEdit=training||draft.ready&&draft.ownership.status==='owned';
 const setAmounts=(value:Record<string,string>)=>{setSignature('');if(training)setCapAmounts(value);else draft.update({amounts:value});};
 const setMethod=(value:string)=>{setSignature('');if(training)setCapMethod(value);else draft.update({method:value});};
 const setNote=(value:string)=>{setSignature('');if(training)setCapNote(value);else draft.update({note:value});};
 const canRelease=operator&&!query.data?.documents.some(d=>d.documento.tipo==='FINAL')&&!query.isError&&query.data?.enabled&&['EN_TRATAMIENTO','TRATADO'].includes(manifest.estado||'');
 const currentResidues=manifest.residuos||[];
 const staleQuantities=!!kind&&(Object.keys(amounts).some(id=>!currentResidues.some(row=>row.id===id)&&!findings.some(row=>row.id===id))||kind==='FINAL'&&currentResidues.some(row=>String(row.cantidadRecibida??'')!==amounts[row.id]));
 const alreadyCertified=(id:string)=>query.data?.documents.filter(d=>d.documento.tipo==='PARCIAL').flatMap(d=>d.documento.cantidades).filter(row=>row.residuoId===id).reduce((n,row)=>n+row.cantidad,0)??0;
 const validFindings=findings.every(f=>{
  const value=amounts[f.id]||'',previous=alreadyCertified(f.id);
  if(kind==='PARCIAL'&&!value)return true;
  if(kind==='FINAL'&&value==='NO_TRATADO')return false;
  const amount=Number(value);
  return !!value&&value!=='SI'&&Number.isFinite(amount)&&amount>0&&(kind==='PARCIAL'?amount+previous<=f.observado+1e-9:amount+1e-9>=previous&&Math.abs(amount-f.observado)<=1e-9);
 });
 function refreshQuantities(){setAmounts(Object.fromEntries([...currentResidues.map(row=>[row.id,kind==='FINAL'?String(row.cantidadRecibida??''):amounts[row.id]||'']),...findings.map(row=>[row.id,amounts[row.id]||''])]));}
 const final=query.data?.documents.some(d=>d.documento.tipo==='FINAL');
 function open(tipo:'PARCIAL'|'FINAL'){
  if(!canEdit||(!training&&!draft.canWrite()))return;
  const value={kind:tipo,method:(manifest as Partial<Manifiesto> & {tratamientoMetodo?:string}).tratamientoMetodo||'',note:'',amounts:Object.fromEntries([...(manifest.residuos||[]).map(r=>[r.id,String(tipo==='FINAL'?(r.cantidadRecibida??''):Math.max(0,(r.cantidadRecibida??0)-alreadyCertified(r.id))||'')]),...findings.map(f=>[f.id,''])])};
  if(training){setCapKind(tipo);setCapMethod(value.method);setCapNote('');setCapAmounts(value.amounts);}else void draft.replace(value);
  setCollapsed(false);setSignature('');setError('');
 }
 async function release(e:React.FormEvent){
  e.preventDefault();if(recovery.command||!recovery.ready||lock.current||!kind||!signature||staleQuantities||!validFindings||!canEdit||!canRelease||(findingProblems.length>0&&(kind==='FINAL'||findings.some(f=>!!amounts[f.id])))||(kind==='FINAL'&&(manifest.estado!=='TRATADO'||unresolved!==0||checks.isError)))return;lock.current=true;setBusy(true);setError('');
  const excluded=findings.filter(f=>amounts[f.id]==='NO_TRATADO').map(f=>f.id);
  const body={tipo:kind,firma:signature,metodo:method,nota:note,cantidades:Object.entries(amounts).filter(([,v])=>v!==''&&v!=='SI'&&v!=='NO_TRATADO').map(([residuoId,v])=>({residuoId,cantidad:Number(v)})),...(excluded.length?{exclusionesHallazgos:excluded}:{})};
  if(!training){try{if(await draft.flush()&&draft.canWrite())await recovery.submit(body);}finally{lock.current=false;setBusy(false);}return;}
  const content=JSON.stringify(body);if(request.current?.body!==content)request.current={id:crypto.randomUUID(),body:content};
  try{await api.post(endpoint,{id:request.current.id,...body});setCapKind(null);setSignature('');request.current=null;await qc.invalidateQueries({queryKey:key});await qc.invalidateQueries({queryKey:['manifiestos']});await qc.invalidateQueries({queryKey:['training-tasks']});}
  catch(e:any){setError(e.response?.data?.message||'No se pudo liberar. Se conserva la carga para reintentar.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function download(document:DocumentRow){
  try{const {data}=await api.get(`${endpoint}/${document.id}/archivo`,{responseType:'blob'});const url=URL.createObjectURL(data),a=window.document.createElement('a');a.href=url;a.download=`${training?'CAP':'SITREP'}-${document.documento.tipo}-${manifest.numero}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  catch{setError('No se pudo descargar el documento.');}
 }
 return <section id="certificaciones" aria-label="Certificaciones" className="scroll-mt-28 rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
  <CardHeader icon={<Award size={22}/>} title="Certificaciones" subtitle="El operador firma y emite. Las partes vinculadas reciben un aviso y pueden descargarlo."/>
  {readOnly&&<p role="status">Esta vista permite consultar certificados. Para firmar o recuperar un envío, entrá con la cuenta habilitada del operador.</p>}
  {query.isError?<p role="alert">No se pudieron comprobar los certificados. <Button variant="outline" onClick={()=>void query.refetch()}>Reintentar certificados</Button></p>:query.isPending?<p role="status">Comprobando certificados…</p>:<>
   <div className="grid grid-cols-2 gap-2" aria-label="Estado de certificaciones">{(['PARCIAL','FINAL'] as const).map(type=>{
    const issued=query.data?.documents.filter(d=>d.documento.tipo===type).length||0;
    const otherwiseReady=canRelease&&!final&&(type==='PARCIAL'||manifest.estado==='TRATADO'&&unresolved===0&&!checks.isError&&!findingProblems.length);
    const ready=otherwiseReady&&!recovery.command;
    const Icon=issued?CheckCircle2:ready?FileCheck2:LockKeyhole;
    return <div key={type} className={`rounded-lg border p-3 ${issued?'border-emerald-200 bg-emerald-50 text-emerald-900':ready?'border-primary-200 bg-primary-50 text-primary-900':'border-neutral-200 bg-neutral-50 text-neutral-600'}`}><Icon size={22} aria-hidden="true"/><h3 className="mt-2 text-sm font-semibold">{type==='PARCIAL'?'Parcial':'Final total'}</h3><p className="mt-1 text-xs">{issued?`${issued} emitida${issued>1?'s':''}`:otherwiseReady&&recovery.command?(recovery.command.status==='pending'?'Comprobá la emisión':'Continuá para emitir'):ready?'Lista para firmar':!operator?'Pendiente del operador':final?'No emitida':type==='PARCIAL'?'Requiere tratamiento':'Requiere cierre y adendas resueltas'}</p></div>;
   })}</div>
   <ul className="space-y-2">{query.data?.documents.map((d,i)=><li key={d.id} id={`certificado-${d.id}`} data-certificate-id={d.id} className={`scroll-mt-32 rounded border p-3 ${selectedCertificate===d.id?'border-primary-400 bg-primary-50':'border-neutral-200'}`}><p className="font-semibold">{d.documento.tipo==='FINAL'?'Certificación final total':'Certificación parcial '+(i+1)} · Emitida</p><p className="text-xs text-neutral-600 break-words">{d.numero || manifest.numero} · {new Date(d.createdAt).toLocaleString('es-AR')}</p><p className="text-sm">{d.documento.cantidades.map(r=>`${r.corriente}: ${r.cantidad} ${r.unidad}`).join(' · ')}</p><Button variant="outline" leftIcon={<Download size={16}/>} onClick={()=>void download(d)}>Descargar {d.documento.tipo==='FINAL'?'final':'parcial '+(i+1)}{training?' CAP':''}</Button></li>)}</ul>
  </>}
  {canRelease&&canEdit&&recovery.ready&&!recovery.command&&!final&&!kind&&<div className="flex flex-wrap gap-2"><Button variant={manifest.estado==='TRATADO'&&unresolved===0?'outline':'primary'} onClick={()=>open('PARCIAL')}>Emitir certificación parcial</Button><Button disabled={manifest.estado!=='TRATADO'||unresolved!==0||checks.isError||findingProblems.length>0} onClick={()=>open('FINAL')}>Emitir certificación final total</Button></div>}
  {operator&&findingProblems.length>0&&<div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3"><p>Revisá los informes antes de certificar los hallazgos:</p><ul className="list-disc pl-5">{findingProblems.map(problem=><li key={problem}>{problem}</li>)}</ul></div>}
  {operator&&canRelease&&!final&&!(recovery.command&&manifest.estado==='TRATADO'&&unresolved===0&&!checks.isError&&!findingProblems.length&&!findings.length)&&<p className="text-sm text-neutral-700">{manifest.estado!=='TRATADO'?'Para emitir la final total: cerrá el tratamiento cuando corresponda.':unresolved===null?'Comprobando revisiones antes de la certificación final…':unresolved>0?<>{unresolved} {unresolved===1?'adenda':'adendas'} por resolver antes del final. <Link className="font-semibold text-primary-800 underline" to={mp(`/manifiestos/${id}/adendas`)}>Ver qué falta resolver</Link></>:findingProblems.length?'Revisá los informes de hallazgo antes de emitir la final.':findings.length?'Al preparar la final, indicá cuáles corrientes halladas se trataron.':'Todo listo para firmar la certificación final total.'}</p>}
  {checks.isError&&<p role="alert">No pudimos comprobar las adendas. <button onClick={()=>void checks.refetch()} className="underline">Reintentar</button></p>}
  {operator&&query.data&&!query.data.enabled&&<p className="text-sm">La emisión está deshabilitada. Los documentos emitidos siguen disponibles.</p>}
  {operator&&query.data?.enabled&&!canRelease&&!final&&<p className="text-sm">Primero: recepción → pesaje → tratamiento.</p>}
  {operator&&!training&&draft.ownership.status==='blocked'&&<div role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-3 space-y-2"><p>La certificación se está preparando en otra pestaña. Cerrala para continuar aquí con su borrador.</p><Button variant="outline" onClick={draft.ownership.retry}>Retomar edición aquí</Button></div>}
  {operator&&!training&&draft.ownership.status==='unavailable'&&<div role="alert"><p>Este navegador no pudo proteger el borrador. Reintentá o usá un navegador actualizado.</p><Button variant="outline" onClick={draft.ownership.retry}>Reintentar protección</Button></div>}
  {operator&&!training&&draft.ownership.status==='owned'&&!draft.ready&&<p role="status">Comprobando borrador… <Button variant="outline" onClick={()=>void draft.reload()}>Reintentar borrador</Button></p>}
  {!training&&draft.error&&<div role="alert"><p>{draft.error}</p>{draft.ready&&<Button variant="outline" onClick={()=>void draft.flush()}>Reintentar guardado</Button>}</div>}
  {kind&&canEdit&&!recovery.command&&!training&&<div className="max-w-[960px] rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
   <p role="status">{draft.saving?'Guardando borrador…':draft.error?'Borrador sin guardar':draft.restored?'Borrador recuperado en este dispositivo':'Borrador guardado en este dispositivo'}</p>
   <p className="text-sm">Revisá las cantidades antes de firmar. La firma se pide de nuevo al reabrir; todavía no se emitió un documento.</p>
   <div className="flex flex-wrap gap-2">{collapsed&&<Button onClick={()=>setCollapsed(false)}>Continuar borrador</Button>}<Button variant="ghost" disabled={busy||recovery.busy} onClick={()=>setDiscarding(true)}>Descartar borrador</Button></div>
   {discarding&&<div className="space-y-2"><p>¿Descartar estas cantidades y observaciones guardadas? Los certificados emitidos se conservan.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>setDiscarding(false)}>Conservar borrador</Button><Button disabled={busy||recovery.busy} onClick={()=>void draft.replace(null).then(ok=>{if(ok){setDiscarding(false);setSignature('');setCollapsed(false);}})}>Sí, descartar borrador</Button></div></div>}
  </div>}
  {kind&&!recovery.command&&final&&<p role="status">Ya existe una certificación final total. El borrador se conserva para consulta; no se puede emitir otro documento.</p>}
  {kind&&canEdit&&!recovery.command&&staleQuantities&&<div role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 space-y-2"><p>El pesaje o los residuos cambiaron desde este borrador. Revisá y actualizá las cantidades antes de firmar; conservamos método y observaciones.</p><Button variant="outline" onClick={refreshQuantities}>Actualizar cantidades del borrador</Button></div>}
  {kind&&canEdit&&!collapsed&&!recovery.command&&<form onSubmit={release} className="max-w-[960px] space-y-3 border-t pt-3"><fieldset disabled={busy||recovery.busy} className="min-w-0 space-y-3"><h3 className="font-semibold">{kind==='PARCIAL'?'Cantidad efectivamente tratada en este parcial':'Total tratado: incluye los parciales previos'}</h3>
   {(manifest.residuos||[]).map(r=><Input key={r.id} label={`Cantidad a certificar ${r.tipoResiduo?.codigo||r.id} (${r.unidad})`} type="number" min="0.001" step="any" required={kind==='FINAL'} disabled={kind==='FINAL'} value={amounts[r.id]||''} onChange={e=>setAmounts({...amounts,[r.id]:e.target.value})} helperText={`Pesaje recibido: ${r.cantidadRecibida??'pendiente'} ${r.unidad}. En un parcial, dejá vacío lo que no se certifica.`}/>)}
   {findings.length>0&&<fieldset className="space-y-3 rounded-lg border border-neutral-200 p-3">
    <legend className="px-1 font-semibold">Corrientes halladas en adendas aprobadas</legend>
    <p className="text-sm text-neutral-700">Un hallazgo aprobado registra lo observado; sólo certificá lo que efectivamente trataste. La declaración original no cambia.</p>
    {findings.map(f=>{
     const value=amounts[f.id]||'',previous=alreadyCertified(f.id);
     const choice=!value?'':value==='NO_TRATADO'?'no':'si';
     return <div key={f.id} className="space-y-2 border-t border-neutral-200 pt-3">
      <p className="font-medium">{f.corriente} · observado {f.observado} {f.unidad}{previous>0&&` · ya certificado ${previous} ${f.unidad}`}</p>
      {kind==='FINAL'&&<label className="block text-sm font-medium">¿Se trató {f.corriente}?
       <select aria-label={`Tratamiento de ${f.corriente} (${f.unidad})`} className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3" value={choice} onChange={e=>setAmounts({...amounts,[f.id]:e.target.value==='no'?'NO_TRATADO':e.target.value==='si'?(previous?String(previous):'SI'):''})}>
        <option value="">Seleccioná una opción</option><option value="si">Sí, fue tratada</option><option value="no" disabled={previous>0}>No fue tratada</option>
       </select>
      </label>}
      {(kind==='PARCIAL'||choice==='si')&&<Input label={`Cantidad tratada ${f.corriente} (${f.unidad})`} type="number" min="0.001" max={f.observado} step="any" required={kind==='FINAL'} value={value==='SI'||value==='NO_TRATADO'?'':value} onChange={e=>setAmounts({...amounts,[f.id]:e.target.value||(kind==='FINAL'?'SI':'')})} helperText={kind==='FINAL'?'Incluí los parciales previos.':'Dejá vacío si no se trata en este parcial.'}/>}
     </div>;
    })}
    {!validFindings&&kind==='FINAL'&&<p className="text-sm text-neutral-700">Para emitir el final, completá el tratamiento de cada corriente hallada e indicá el total observado, incluidos los parciales previos.</p>}
   </fieldset>}
   <p className="text-sm">Datos del manifiesto y pesaje ya incorporados. Revisá el método registrado y firmá.</p><Input label="Método de tratamiento certificado" required maxLength={200} value={method} onChange={e=>setMethod(e.target.value)}/>
   <Input label="Observaciones del certificado (opcional)" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/>
   <p className="font-medium">Firma del operador</p>{signature?<div><img className="max-h-28" src={signature} alt="Firma del operador"/><Button type="button" variant="outline" onClick={()=>setSignature('')}>Volver a firmar</Button></div>:<SignaturePad onConfirm={setSignature}/>}
   <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy||recovery.busy||!recovery.ready||!signature||staleQuantities||!validFindings||!canRelease||(findingProblems.length>0&&(kind==='FINAL'||findings.some(f=>!!amounts[f.id])))||(kind==='FINAL'&&(manifest.estado!=='TRATADO'||unresolved!==0||checks.isError))}>{busy?'Guardando...':'Firmar y publicar certificación'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>{if(training)setCapKind(null);else setCollapsed(true);}}>{training?'Cancelar':'Cerrar formulario'}</Button></div>
  </fieldset></form>}
  {operator&&!training&&!recovery.ready&&<p role="status">Comprobando solicitudes guardadas… <Button variant="outline" onClick={()=>void recovery.reload()}>Reintentar copia local</Button></p>}
  {recovery.command&&<div className={receiptInList?'flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3':'rounded-lg border border-primary-200 bg-primary-50 p-3 space-y-3'} aria-label="Recuperación de certificación">
   <p role="status" className="font-semibold">{recovery.command.status==='confirmed'?'Certificación emitida':recovery.command.status==='withdrawn'?'Solicitud retirada sin emitir':'Emisión pendiente de confirmación'}</p>
   <div hidden={!!receiptInList&&!recovery.command.input.exclusionesHallazgos?.length} className={`space-y-3 ${receiptInList?'basis-full':''}`}>
    <p hidden={!!receiptInList} className="text-sm">{recovery.command.input.tipo==='FINAL'?'Final total':'Parcial'} · {recovery.command.input.cantidades.map(row=>{const r=manifest.residuos?.find(r=>r.id===row.residuoId),f=findings.find(f=>f.id===row.residuoId);return (r?.tipoResiduo?.codigo||f?.corriente||row.residuoId)+': '+row.cantidad+' '+(r?.unidad||f?.unidad||'');}).join(' · ')}</p>
    {!!recovery.command.input.exclusionesHallazgos?.length&&<p className="text-sm">No tratadas: {recovery.command.input.exclusionesHallazgos.map(id=>findings.find(f=>f.id===id)?.corriente||id).join(', ')}</p>}
    <p hidden={!!receiptInList} className="text-sm">{recovery.command.status==='pending'?'Conservamos el contenido firmado. Reintentar usa la misma solicitud; no genera otro certificado. Comprobar resultado confirma la emisión o retira el envío para poder corregirlo.':recovery.command.status==='confirmed'?recovery.command.receipt?.numero:'Podés corregir los datos y volver a firmar. El envío anterior ya no podrá emitir.'}</p>
   </div>
   <div className="flex flex-wrap gap-2">{recovery.command.status==='pending'?<>
    <Button disabled={recovery.busy||!canRelease||!canEdit} onClick={()=>void recovery.retry()}>Reintentar misma emisión</Button>
    <Button variant="outline" disabled={recovery.busy||!canEdit} onClick={()=>void recovery.recover()}>Comprobar resultado</Button>
   </>:<Button disabled={recovery.busy||!canEdit} onClick={()=>void recovery.release(async saved=>{
    await draft.finish(saved);setCollapsed(false);setSignature('');
    if(saved.status==='confirmed'){await qc.invalidateQueries({queryKey:key});await qc.invalidateQueries({queryKey:['manifiestos']});}
   })}>{recovery.command.status==='confirmed'?'Continuar con certificados':'Corregir y volver a firmar'}</Button>}</div>
  </div>}
  {recovery.error&&<p role="alert">{recovery.error}</p>}
  {error&&<p role="alert">{error}</p>}
  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-neutral-600">{training?'Capacitación · sin validez oficial':'Cada documento emitido conserva su firma y contenido.'}</span><Button size="sm" variant="ghost" onClick={()=>void query.refetch()}>Actualizar certificados</Button></div>
 </section>;
}
