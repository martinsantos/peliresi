import { InvitationPreparationNotice } from '../../components/InvitationPreparationNotice';
import { useInvitationPreparation } from '../../hooks/useInvitationPreparation';
import { CompanyDraftNotice, CompanyRevisionNotice, companyDraftKey, useCompanyRevisionDraft } from '../../components/CompanyRevisionDraft';
import { readPreparedInvitations, writePreparedInvitations, PREPARED_INVITATION_PREFIX, type PreparedCompanyInvitation } from '../../services/preparedCompanyInvitations';
import { CompanyPeopleSummary, type CompanyCapacity } from '../../components/CompanyPeopleSummary';
import ImpersonationContext from '../../contexts/ImpersonationContext';
import { ChevronDown } from 'lucide-react';
import { Activity,useContext,useEffect,useRef,useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { notificationInboxReturnPath } from '../../utils/notificationNavigation';
import { inspectionWorkspaceOwner } from '../../utils/inspectionWorkspace';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { api } from '../../services/api';
import { companyCacheScope,companyHeaders,saveCompanyContext,type CompanyChoice } from '../../services/companyContext';
import { clearOfflineSession } from '../../services/offlineSession';
import { catalogoService } from '../../services/catalogo.service';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { CompanyPicker,type CompanyPagination } from '../../components/CompanyPicker';

type CompanyAction=(fn:()=>Promise<unknown>,after?:()=>void,confirmed?:()=>boolean,failed?:(error:unknown)=>boolean)=>Promise<void>;
type CompanySave=(data:unknown,confirmed:()=>boolean)=>Promise<void>;
type Company={id:string;cuit:string;razonSocial:string;nombreFantasia?:string;revision:number;domicilioLegal:{calle:string;localidad:string;departamento:string}};
type Details={empresa:Company;contextos:CompanyChoice[];actividades:Array<{id:string;rol:string;actorId:string}>;establecimientos:any[];autorizaciones:any[];responsables:any[];eventos:any[];invitaciones:any[];personas:any[];cupoPersonas?:CompanyCapacity;puedeGestionar:boolean;puedeValidar:boolean};
const labels:Record<string,string>={GENERADOR:'Generador',TRANSPORTISTA:'Transportista',OPERADOR:'Operador'};
const request=async(route:string,method='GET',body?:unknown)=>(await api.request({url:'/empresas'+route,method,data:body})).data.data;
const message=(e:unknown)=>(e as any)?.response?.data?.message||'No se pudo guardar. Tus datos siguen en el formulario.';
export default function EmpresasPage(){
 const {currentUser}=useAuth();
 const scope=JSON.stringify([currentUser?.id,currentUser?.rol,currentUser?.actorId,companyCacheScope(currentUser?.empresaContexto||null),currentUser?.empresaContexto?.autorizacionId,currentUser?.empresaContexto?.revision,!!currentUser?.training,!!currentUser?.esInspector]);
 return <CompanyWorkspace key={scope} scope={scope}/>;
}
function CompanyWorkspace({scope}:{scope:string}){
 const {currentUser}=useAuth(),[choice,setChoice]=useState<Company>(),[page,setPage]=useState(1),[search,setSearch]=useState(''),mp=useMobilePrefix();
 const temporary=Boolean(useContext(ImpersonationContext)?.impersonationData);
 const location=useLocation(), params=new URLSearchParams(location.search);
 const fromInbox=params.get('origen')==='avisos';
 const backPath=fromInbox?notificationInboxReturnPath(location.state,inspectionWorkspaceOwner(currentUser)):'/mi-perfil';
 const backLabel=fromInbox?'Volver a Avisos':'Volver a Mi perfil';
 const requestedId=params.get('empresa');
 const requested=requestedId&&/^[a-zA-Z0-9_-]{1,100}$/.test(requestedId)?requestedId:undefined;
 const list=useQuery<{empresas:Company[];pagination:CompanyPagination;puedeValidar:boolean}>({queryKey:['empresas',scope,temporary,page,search],queryFn:()=>request('?'+new URLSearchParams({page:String(page),limit:'25',search})),retry:false,enabled:!!currentUser&&!temporary&&import.meta.env.VITE_ENTERPRISE_ENABLED==='true'});
 // Pin the initial choice too: editing its name may change the server sort order.
 useEffect(()=>{if(!choice&&!requested&&list.data?.empresas[0])setChoice(list.data.empresas.find(c=>c.id===currentUser?.empresaContexto?.empresaId)||list.data.empresas[0]);},[choice,list.data,requested]);
 if(import.meta.env.VITE_ENTERPRISE_ENABLED!=='true')return <p>Funcionalidad no disponible.</p>;
 if(temporary)return <div className="mx-auto max-w-3xl space-y-4"><Link to={mp(backPath)} className="inline-flex min-h-11 items-center text-primary-800 underline">{backLabel}</Link><Card><h2 className="text-lg font-semibold">Gestión desde la cuenta responsable</h2><p className="mt-2 text-sm text-neutral-600">La gestión de empresas se realiza desde la cuenta del responsable. La vista temporal permite consultar la ficha del actor.</p></Card></div>;
 const selected=choice||(requested?list.data?.empresas.find(c=>c.id===requested):list.data?.empresas.find(c=>c.id===currentUser?.empresaContexto?.empresaId)||list.data?.empresas[0]);
 const singleCompany=!search&&page===1&&!list.data?.puedeValidar&&list.data?.pagination.total===1&&list.data.empresas.length===1&&selected?.id===list.data.empresas[0].id;
 return <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">
  <Link className="inline-flex min-h-11 items-center text-primary-800 underline" to={mp(backPath)}>{backLabel}</Link>
  {(!singleCompany && ((list.data?.empresas.length||0)>0 || !!selected || !!search || page>1))&&<CompanyPicker companies={list.data?.empresas||[]} selected={selected} pagination={list.data?.pagination||{page,limit:25,total:0,totalPages:page}} busy={list.isFetching}
   onChoose={id=>setChoice(list.data?.empresas.find(c=>c.id===id)||selected)}
   onPage={next=>{setChoice(selected);setPage(next);}}
   onSearch={value=>{setChoice(selected);setPage(1);setSearch(value);}}/>}
  {list.isPending&&<Card><p role="status">Consultando empresas…</p></Card>}
  {list.isSuccess&&!list.data.empresas.length&&!search&&!selected&&!requested&&<Card><h2 className="font-semibold">No hay empresas vinculadas a esta cuenta</h2><p className="mt-2 text-sm text-neutral-600">Los datos de tu actividad están en Mi perfil.</p></Card>}
  {list.isError&&<div role="alert"><p>No pudimos consultar las empresas.</p><Button onClick={()=>void list.refetch()}>Reintentar</Button></div>}
  {(selected||requested)&&<CompanyDetail key={selected?.id||requested} scope={scope} id={(selected?.id||requested)!} reloadList={()=>list.refetch()}/>}
  {list.data?.puedeValidar&&!list.isError&&<details className="rounded-xl border border-neutral-200 bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold">Registrar empresa</summary><CompanyCreate draftKey={companyDraftKey(scope,'new','identity')} done={async c=>{setChoice(c);await list.refetch();}}/></details>}
 </div>;
}
function CompanyCreate({done,draftKey}:{done:(c:Company)=>Promise<void>;draftKey:string}){
 const draft=useCompanyRevisionDraft({cuit:'',razonSocial:'',calle:'',localidad:'',departamento:''},0,draftKey),form=draft.value;
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 return <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(lock.current||draft.conflict)return;lock.current=true;setBusy(true);setError('');try{const {cuit,razonSocial,...domicilioLegal}=form;const result=await request('','POST',{cuit,razonSocial,domicilioLegal});draft.recovery.acknowledge();await done(result.empresa);draft.recovery.clear();}catch(e){setError(message(e));}finally{setBusy(false);lock.current=false;}}}>
  <div className="sm:col-span-2"><CompanyDraftNotice draft={draft} label="empresa nueva"/></div>
  {(['cuit','razonSocial','calle','localidad','departamento']as const).map((key,i)=><Input key={key} label={['CUIT de empresa','Razón social','Calle legal','Localidad legal','Departamento legal'][i]} value={form[key]} required={i<2} onChange={e=>draft.change({[key]:e.target.value})}/>)}
  {error&&<p role="alert" className="sm:col-span-2 text-error-700">{error}</p>}<Button type="submit" disabled={busy||draft.conflict}>Registrar empresa</Button>
 </form>;
}
function CompanyDetail({id,scope,reloadList}:{id:string;scope:string;reloadList:()=>Promise<unknown>}){
 const [tab,setTab]=useState('empresa'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const confirmedWrite=useRef<{after?:()=>void}|null>(null),[awaitingRead,setAwaitingRead]=useState(false);
 const recoveryNotice=useRef<HTMLDivElement>(null);
 const [openedTabs,setOpenedTabs]=useState<Record<string,boolean>>({empresa:true});
 const [savedForms,setSavedForms]=useState<Record<string,number>>({});
 const resetForm=(key:string)=>setSavedForms(current=>({...current,[key]:(current[key]||0)+1}));
 const query=useQuery<Details & {readStartedAt:number}>({queryKey:['empresa',scope,id],queryFn:async()=>{
  const readStartedAt=Date.now();
  return {...await request('/'+id),readStartedAt};
 },retry:false});
 // Capacity belongs to the server. Expiration invalidates the snapshot; it does
 // not remove a person or grant a place locally. This effect stays active while
 // another company section is open, unlike the hidden People subtree.
 useEffect(()=>{
  const snapshot=query.data;
  if(!query.isSuccess||!snapshot)return;
  const expires=Math.min(...snapshot.invitaciones.filter(i=>!i.aceptadaAt&&!i.revocadaAt)
   .map(i=>new Date(i.venceAt).getTime()).filter(time=>Number.isFinite(time)&&time>snapshot.readStartedAt));
  if(!Number.isFinite(expires))return;
  let requested=false;
  const check=()=>{if(!requested&&Date.now()>=expires){requested=true;void query.refetch();}};
  const timer=window.setTimeout(check,Math.max(1,Math.min(expires-Date.now()+1,2147483647)));
  const visible=()=>{if(document.visibilityState==='visible')check();};
  window.addEventListener('focus',check);document.addEventListener('visibilitychange',visible);
  return ()=>{window.clearTimeout(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',visible);};
 },[query.data,query.isSuccess,query.refetch]);
 useEffect(()=>{
  if(awaitingRead&&query.isError&&!query.isFetching){recoveryNotice.current?.focus();recoveryNotice.current?.scrollIntoView?.({block:'center'});}
 },[awaitingRead,query.isError,query.isFetching]);
 useEffect(()=>{
  if(!busy&&query.isSuccess&&!query.isFetching&&confirmedWrite.current){
   const saved=confirmedWrite.current;confirmedWrite.current=null;setAwaitingRead(false);saved.after?.();setNotice('Cambios guardados');
  }
 },[busy,query.isSuccess,query.isFetching,query.dataUpdatedAt]);
 async function run(action:()=>Promise<unknown>,after?:()=>void,confirmed?:()=>boolean,failed?:(error:unknown)=>boolean){
  if(lock.current||query.isError||confirmedWrite.current)return;
  lock.current=true;setBusy(true);setError('');setNotice('');
  try{await action();if(confirmed&& !confirmed())setError('El cambio se registró, pero no pudimos limpiar su copia en este dispositivo. Al reabrir, revisá lo guardado en SITREP antes de continuar.');confirmedWrite.current={after};setAwaitingRead(true);await Promise.all([query.refetch(),reloadList()]);}
  catch(e){if(!failed?.(e)){setError(message(e));if((e as any)?.response?.status===409)void query.refetch();}}
  finally{setBusy(false);lock.current=false;}
 }
 const unavailable=[401,403,404].includes((query.error as any)?.response?.status);
 if(unavailable)return <Card><p role="alert">Ya no está disponible el acceso a esta empresa en el contexto actual.</p><Button onClick={()=>void query.refetch()}>Reintentar empresa</Button></Card>;
 if(!query.data)return query.isError?<div role="alert"><p>No pudimos abrir la empresa.</p><Button onClick={()=>void query.refetch()}>Reintentar empresa</Button></div>:<p role="status">Cargando empresa…</p>;
 const d=query.data;
 return <>
  {query.isFetching&&!busy&&<p role="status" className="text-sm text-neutral-700">Actualizando datos de la empresa…</p>}
  {query.isError&&<div ref={recoveryNotice} tabIndex={-1} role="alert" className="rounded-lg border border-warning-200 bg-warning-50 p-3 focus:outline-none focus:ring-2 focus:ring-primary-700"><p>{awaitingRead?'El cambio fue registrado, pero no pudimos actualizar la empresa. Reintentá la consulta; no vuelvas a enviar el cambio.':'No pudimos actualizar la empresa. Conservamos lo escrito; reintentá la consulta antes de continuar.'}</p><Button variant="outline" disabled={query.isFetching} onClick={()=>void query.refetch()}>Reintentar empresa</Button></div>}
  <fieldset disabled={busy||query.isError||awaitingRead} className="min-w-0 space-y-5">
  <WorkspaceChoices key={id} choices={d.contextos||[]}/>
  <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200" aria-label="Secciones de empresa">{[['empresa','Empresa'],['sedes','Establecimientos'],['personas','Personas autorizadas'],['historial','Historial']].filter(([key])=>d.puedeGestionar||!['personas','historial'].includes(key)).map(([key,title])=><button type="button" key={key} className={'min-h-11 shrink-0 border-b-2 px-3 font-medium '+(tab===key?'border-primary-700 text-primary-800':'border-transparent text-neutral-600')} aria-current={tab===key?'page':undefined} onClick={()=>{setOpenedTabs(opened=>({...opened,[key]:true}));setTab(key);}}>{title}</button>)}</nav>
  {error&&<p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-error-800">{error}</p>}{notice&&<p role="status" className="text-primary-800">{notice}</p>}
  {/* Keep visited forms mounted; hidden sections pause effects and stay out of keyboard navigation. */}
  <Activity mode={tab==='empresa'?'visible':'hidden'}><CompanyForm key={savedForms.company||0} draftKey={companyDraftKey(scope,id,'legal')} company={d.empresa} manage={d.puedeGestionar} busy={busy} save={(data,confirmed)=>run(()=>request('/'+id,'PUT',data),()=>resetForm('company'),confirmed)}/>{d.puedeValidar&&<AuthorityTools id={id} draftKey={companyDraftKey(scope,id,'authority')} details={d} busy={busy} run={run}/>}</Activity>
  {openedTabs.sedes&&<Activity mode={tab==='sedes'?'visible':'hidden'}><div className="space-y-3">{d.establecimientos.map(s=><Card key={s.id}><h2 className="font-semibold">{s.nombre}</h2><p>{s.domicilio||'Domicilio productivo por completar'}{s.localidad?', '+s.localidad:''}{s.departamento?', '+s.departamento:''}</p><p className="text-sm text-neutral-600">{s.codigo} · {s.activo?'Activo':'Inactivo'}</p>{Array.isArray(s.certificados)&&s.certificados.length>0&&<p className="text-sm">Certificados: {s.certificados.join(', ')}</p>}{d.puedeGestionar&&<details className="mt-2"><summary className="min-h-11 cursor-pointer text-primary-800">Editar establecimiento</summary><SiteForm key={savedForms[s.id]||0} draftKey={companyDraftKey(scope,id,'site:'+s.id)} site={s} busy={busy} save={(data,confirmed)=>run(()=>request('/'+id+'/establecimientos/'+s.id,'PUT',data),()=>resetForm(s.id),confirmed)}/></details>}</Card>)}</div>
   {!d.establecimientos.length&&<p>No hay establecimientos cargados.</p>}{d.puedeGestionar&&<Card><h2 className="font-semibold">Agregar establecimiento</h2><SiteForm key={savedForms.newSite||0} draftKey={companyDraftKey(scope,id,'new-site')} busy={busy} save={(data,confirmed)=>run(()=>request('/'+id+'/establecimientos','POST',data),()=>resetForm('newSite'),confirmed)}/></Card>}</Activity>}
  {openedTabs.personas&&d.puedeGestionar&&<Activity mode={tab==='personas'?'visible':'hidden'}><People id={id} draftKey={companyDraftKey(scope,id,'people')} details={d} refresh={async()=>{const result=await query.refetch();return result.isSuccess?result.data:undefined;}} verified={query.isSuccess&&!query.isFetching&&!busy} busy={busy} run={run}/></Activity>}
  {tab==='historial'&&d.puedeGestionar&&<Card><h2 className="font-semibold mb-3">Últimos 50 cambios</h2><ol className="divide-y divide-neutral-100">{d.eventos.map(e=><li className="py-3 break-words" key={e.id}><p className="font-medium">{e.tipo.replaceAll('_',' ')}</p><p className="text-sm">{new Date(e.createdAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Mendoza'})} · Persona: {e.usuarioId}</p>{e.datos?.motivo&&<p>{e.datos.motivo}</p>}</li>)}</ol>{!d.eventos.length&&<p>Sin cambios registrados.</p>}</Card>}
 </fieldset></>;
}
function WorkspaceChoices({choices}:{choices:CompanyChoice[]}){
 const {currentUser}=useAuth(),mp=useMobilePrefix();const [selection,setSelection]=useState(currentUser?.empresaContexto?.actividadId||''),[site,setSite]=useState(currentUser?.empresaContexto?.establecimientoId||''),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const choice=choices.find(c=>c.actividadId===selection)||choices[0];
 const siteId=choice?.establecimientos.find(s=>s.id===site)?.id||choice?.establecimientos[0]?.id||'';
 async function choose(personal=false){if(!currentUser||lock.current)return;lock.current=true;setBusy(true);setError('');try{
  if(personal)saveCompanyContext(String(currentUser.id),null);
  else if(choice){const next={empresaId:choice.empresaId,actividadId:choice.actividadId,...(siteId?{establecimientoId:siteId}:{})};const result=await api.get('/auth/profile',{headers:companyHeaders(next)});if(result.data.data.user.empresaContexto?.empresaId!==next.empresaId)throw new Error('Contexto incompatible');saveCompanyContext(String(currentUser.id),next);}
  clearOfflineSession();window.location.replace((window.location.pathname.startsWith('/app/')?'/app':'')+mp('/dashboard'));
 }catch(e){setError(message(e));setBusy(false);lock.current=false;}}
 const active=currentUser?.empresaContexto;
 const inThisCompany=choices.some(c=>c.empresaId===active?.empresaId);
 return <details open={!inThisCompany||undefined} className="group rounded-xl border border-neutral-200 bg-white px-4" aria-label="Cambiar contexto de trabajo"><summary className="flex min-h-11 cursor-pointer flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 font-medium text-primary-800"><span className="flex items-center gap-2"><ChevronDown size={16} aria-hidden="true" className="shrink-0 group-open:rotate-180"/>{inThisCompany?'Cambiar actividad o sede':'Actuar por esta empresa'}</span>{inThisCompany&&<span className="text-sm font-normal text-neutral-700">{labels[active!.rol]||active!.rol}{active?.establecimiento?' · '+active.establecimiento.nombre:''}</span>}</summary><div className="border-t border-neutral-200 py-4">{choice?<div className="grid gap-3 sm:grid-cols-2"><NativeSelect label="Actividad autorizada" value={choice.actividadId} onChange={v=>{setSelection(v);setSite('');}}>{choices.map(c=><option key={c.actividadId} value={c.actividadId}>{labels[c.rol]||c.rol}</option>)}</NativeSelect><NativeSelect label="Establecimiento para operar" value={siteId} onChange={setSite}>{!choice.establecimientos.length&&<option value="">Sin establecimiento cargado</option>}{choice.establecimientos.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}</NativeSelect><Button disabled={busy||!choice.todosEstablecimientos&&!siteId} onClick={()=>void choose()}>Usar empresa y establecimiento</Button></div>:<p>La validación como responsable permite gestionar la empresa. Para operar necesitás una actividad autorizada.</p>}
  {currentUser?.empresaContexto&&<Button className="mt-3" variant="outline" disabled={busy} onClick={()=>void choose(true)}>Volver a mi cuenta personal</Button>}{error&&<p role="alert" className="mt-2 text-error-700">{error}</p>}
 </div></details>;
}
type CompanyFormProps={company:Company;manage:boolean;busy:boolean;save:CompanySave;draftKey:string};
function CompanyForm(props:CompanyFormProps){
 if(!props.manage)return <Card><h2 className="font-semibold mb-3">Domicilio legal</h2><p>{props.company.razonSocial} · CUIT {props.company.cuit}</p><p>{props.company.domicilioLegal.calle} · {props.company.domicilioLegal.localidad} · {props.company.domicilioLegal.departamento}</p></Card>;
 return <CompanyEditor {...props}/>;
}
function CompanyEditor({company,manage,busy,save,draftKey}:CompanyFormProps){
 const draft=useCompanyRevisionDraft({razonSocial:company.razonSocial,nombreFantasia:company.nombreFantasia||'',...company.domicilioLegal,motivo:''},company.revision,draftKey),form=draft.value;
 return <Card><h2 className="font-semibold mb-3">Domicilio legal</h2><p className="mb-3 text-sm text-neutral-600">CUIT {company.cuit}</p><CompanyDraftNotice draft={draft} label="domicilio legal"/>{draft.serverConflict&&!draft.recovery.conflict&&<CompanyRevisionNotice fields={[["Razón social en SITREP",company.razonSocial],["Nombre de fantasía en SITREP",company.nombreFantasia||''],["Calle legal en SITREP",company.domicilioLegal.calle],["Localidad en SITREP",company.domicilioLegal.localidad],["Departamento en SITREP",company.domicilioLegal.departamento]]} keep={draft.keep} useServer={draft.useServer}/>}<form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();if(draft.conflict)return;const {calle,localidad,departamento,razonSocial,nombreFantasia,motivo}=form;void save({revision:draft.revision,razonSocial,nombreFantasia,domicilioLegal:{calle,localidad,departamento},motivo},draft.recovery.acknowledge);}}>
  {(['razonSocial','nombreFantasia','calle','localidad','departamento'] as const).map((key,i)=><Input key={key} label={['Razón social','Nombre de fantasía','Calle legal','Localidad legal','Departamento legal'][i]} value={form[key]} readOnly={!manage} required={key==='razonSocial'} onChange={e=>draft.change({[key]:e.target.value})}/>)}
  {manage&&<><Input label="Motivo del cambio legal" required value={form.motivo} onChange={e=>draft.change({motivo:e.target.value})}/><Button type="submit" disabled={busy||draft.conflict}>Guardar datos legales</Button></>}
 </form></Card>;
}
function SiteForm({site,busy,save,draftKey}:{site?:any;busy:boolean;save:CompanySave;draftKey:string}){
 const draft=useCompanyRevisionDraft({codigo:site?.codigo||'',nombre:site?.nombre||'',domicilio:site?.domicilio||'',localidad:site?.localidad||'',departamento:site?.departamento||'',certificados:(site?.certificados||[]).join(', '),motivo:'',activo:site?.activo!==false},site?.revision||0,draftKey),form=draft.value;
 return <><CompanyDraftNotice draft={draft} label={site?'establecimiento '+site.nombre:'establecimiento nuevo'}/><div>{draft.serverConflict&&!draft.recovery.conflict&&<CompanyRevisionNotice fields={[["Establecimiento en SITREP",site.nombre],["Domicilio en SITREP",site.domicilio],["Localidad en SITREP",site.localidad||''],["Departamento en SITREP",site.departamento||''],["Certificados en SITREP",(site.certificados||[]).join(', ')],["Estado en SITREP",site.activo?'Activo':'Inactivo']]} keep={draft.keep} useServer={draft.useServer}/>}</div><form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();if(draft.conflict)return;const {motivo,activo,certificados,...data}=form;void save({...data,certificados:certificados.split(',').map((s:string)=>s.trim()).filter(Boolean),...(site?{revision:draft.revision,activo,motivo}:{})},draft.recovery.acknowledge);}}>
  {(['codigo','nombre','domicilio','localidad','departamento','certificados']as const).map((key,i)=><Input key={key} label={['Código de establecimiento','Nombre de establecimiento','Domicilio productivo','Localidad productiva','Departamento productivo','Certificados del establecimiento'][i]} value={form[key]} required={i<2} onChange={e=>draft.change({[key]:e.target.value})}/>)}
  {site&&<><Input label="Motivo del cambio productivo" required value={form.motivo} onChange={e=>draft.change({motivo:e.target.value})}/><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.activo} onChange={e=>draft.change({activo:e.target.checked})}/>Establecimiento activo</label></>}
  <Button type="submit" disabled={busy||draft.conflict}>{site?'Guardar establecimiento':'Agregar establecimiento'}</Button>
 </form></>;
}
function AuthorityTools({id,details:d,busy,run,draftKey}:{id:string;details:Details;busy:boolean;run:CompanyAction;draftKey:string}){
 const draft=useCompanyRevisionDraft({email:'',reason:'',role:'GENERADOR',actor:''},0,draftKey),{email,reason,role,actor}=draft.value;
 const setEmail=(email:string)=>draft.change({email}),setReason=(reason:string)=>draft.change({reason}),setRole=(role:string)=>draft.change({role}),setActor=(actor:string)=>draft.change({actor});
 const catalogs=useQuery({queryKey:['company-role-catalogs',id],queryFn:async()=>{const [g,t,o]=await Promise.all([catalogoService.generadores(),catalogoService.transportistas(),catalogoService.operadores()]);return {GENERADOR:g,TRANSPORTISTA:t,OPERADOR:o};},retry:false});
 const options=(catalogs.data?.[role as 'GENERADOR']||[]).filter(a=>String(a.cuit).replace(/\D/g,'')===d.empresa.cuit);
 return <Card><h2 className="font-semibold mb-3">Validación DGFA</h2><CompanyDraftNotice draft={draft} label="validación administrativa"/><fieldset disabled={draft.conflict}><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void run(()=>request('/'+id+'/responsables','POST',{email,motivo:reason}),undefined,draft.recovery.acknowledge);}}><Input label="Correo del responsable" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Input label="Motivo de validación" required value={reason} onChange={e=>setReason(e.target.value)}/><Button type="submit" disabled={busy}>Validar responsable</Button></form>
  <ul className="my-4 space-y-2">{d.responsables.map(r=><li key={r.id} className="flex flex-wrap items-center gap-2"><span>{d.personas.find(p=>p.id===r.usuarioId)?.email||r.usuarioId} · {r.revocadoAt?'Revocado':'Validado'}</span>{!r.revocadoAt&&<Button variant="outline" disabled={busy||!reason} onClick={()=>void run(()=>request('/'+id+'/responsables','POST',{email:d.personas.find(p=>p.id===r.usuarioId)?.email,motivo:reason,revocar:true}),undefined,draft.recovery.acknowledge)}>Revocar responsable</Button>}</li>)}</ul>
  <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void run(()=>request('/'+id+'/actividades','POST',{rol:role,actorId:actor||options[0]?.id}),undefined,draft.recovery.acknowledge);}}><NativeSelect label="Actividad a vincular" value={role} onChange={v=>{setRole(v);setActor('');}}>{Object.keys(labels).map(r=><option key={r} value={r}>{labels[r]}</option>)}</NativeSelect><NativeSelect label="Ficha del mismo CUIT" value={actor||options[0]?.id||''} onChange={setActor}>{!options.length&&<option value="">No hay ficha activa coincidente</option>}{options.map(a=><option key={a.id} value={a.id}>{a.razonSocial} · {String(a.numeroInscripcion||a.numeroHabilitacion||'')}</option>)}</NativeSelect><Button type="submit" disabled={busy||!options.length}>Vincular actividad existente</Button></form>
  {catalogs.isError&&<p role="alert">No pudimos consultar las fichas. <button className="min-h-11 underline" onClick={()=>void catalogs.refetch()}>Reintentar fichas</button></p>}
  <ul className="mt-3 text-sm">{d.actividades.map(a=><li key={a.id}>{labels[a.rol]} · Ficha vinculada</li>)}</ul></fieldset>
 </Card>;
}
function People({id,details:d,verified,busy,run,draftKey,refresh}:{id:string;details:Details;verified:boolean;busy:boolean;run:CompanyAction;draftKey:string;refresh:()=>Promise<Details|undefined>}){
 const preparation=useInvitationPreparation(draftKey);

 const draft=useCompanyRevisionDraft({email:'',activity:d.actividades[0]?.id||'',all:true,sites:[] as string[]},0,draftKey),{email,activity,all,sites}=draft.value;
 const reasonDraft=useCompanyRevisionDraft({reason:''},0,draftKey+':revocation'),{reason}=reasonDraft.value;
 const setEmail=(email:string)=>draft.change({email}),setActivity=(activity:string)=>draft.change({activity}),setAll=(all:boolean)=>draft.change({all}),setSites=(sites:string[])=>draft.change({sites}),setReason=(reason:string)=>reasonDraft.change({reason});
 const [invitations,setInvitations]=useState<PreparedCompanyInvitation[]>(()=>readPreparedInvitations(draftKey));
 const [shownInvitation,setShownInvitation]=useState<string>();
 const [storageFailed,setStorageFailed]=useState(false);
 const [now,setNow]=useState(Date.now);
 const usable=invitations.filter(saved=>verified&&saved.expiresAt>now&&d.invitaciones.some(i=>i.id===saved.id&&!i.aceptadaAt&&!i.revocadaAt&&new Date(i.venceAt).getTime()>now));
 useEffect(()=>{
  if(!verified)return;
  const remaining=invitations.filter(saved=>saved.expiresAt>Date.now()&&d.invitaciones.some(i=>i.id===saved.id&&!i.aceptadaAt&&!i.revocadaAt&&new Date(i.venceAt).getTime()>Date.now()));
  if(remaining.length!==invitations.length){setInvitations(remaining);writePreparedInvitations(draftKey,remaining);}
 },[verified,d.invitaciones,draftKey,invitations]);
 useEffect(()=>{
  const expires=Math.min(...invitations.map(i=>i.expiresAt).filter(time=>time>now),...d.invitaciones.map(i=>new Date(i.venceAt).getTime()).filter(time=>time>now));
  if(!Number.isFinite(expires))return;
  const timer=window.setTimeout(()=>setNow(Date.now()),Math.max(1,Math.min(expires-Date.now()+1,2147483647)));
  return ()=>window.clearTimeout(timer);
 },[invitations,d.invitaciones,now]);
 useEffect(()=>{
  const sync=(event:StorageEvent)=>{if(!event.key||event.key===PREPARED_INVITATION_PREFIX+draftKey){setInvitations(readPreparedInvitations(draftKey));setShownInvitation(undefined);setNow(Date.now());}};
  window.addEventListener('storage',sync);return ()=>window.removeEventListener('storage',sync);
 },[draftKey]);
 const a=activity?d.actividades.find(a=>a.id===activity):d.actividades[0];
 const staleSites=!all&&sites.some(id=>!d.establecimientos.some(s=>s.id===id&&s.activo));
 const scope={email:email.trim().toLowerCase(),actividadId:a?.id,todosEstablecimientos:all,establecimientoIds:all?[]:sites};
 const person=d.personas.find(p=>p.email.toLowerCase()===scope.email);
 const alreadyCounted=d.cupoPersonas?.personas.some(p=>p.email.toLowerCase()===scope.email)||d.cupoPersonas?.reservas.includes(scope.email);
 const full=!!d.cupoPersonas&&d.cupoPersonas.ocupados>=d.cupoPersonas.maximo&&!alreadyCounted;
 const previous=d.autorizaciones.find(g=>g.usuarioId===person?.id&&g.actividadId===a?.id);
 const pending=d.invitaciones.some(i=>i.email.toLowerCase()===scope.email&&i.actividadId===a?.id&&!i.aceptadaAt&&!i.revocadaAt&&new Date(i.venceAt)>new Date());

 function prepareInvitation() {
  if (!a || busy || !verified) return;
  const receipt = preparation.begin(scope.email, a.id);
  if (!receipt) return;
  void run(async () => {
   const result = await request('/' + id + '/invitaciones', 'POST', scope);
   if (!preparation.canReceive(receipt)) throw new Error('Invitation context changed before confirmation');
   const saved = { id: result?.invitacion?.id, path: result?.ruta, expiresAt: new Date(result?.invitacion?.venceAt).getTime() };
   if (typeof saved.id !== 'string' || !/^\/empresa-invitacion\/[a-f0-9]{64}$/.test(saved.path || '') || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) throw new Error('Incomplete invitation response');
   const next = [...readPreparedInvitations(draftKey).filter(i => i.id !== saved.id), saved];
   setInvitations(next); setShownInvitation(saved.id);
   setStorageFailed(!writePreparedInvitations(draftKey, next));
   preparation.confirmed(receipt);
  }, undefined, draft.recovery.acknowledge, error => preparation.failed(error, receipt));
 }
 return <><InvitationPreparationNotice preparation={preparation} busy={busy||!verified} activityLabel={labels[d.actividades.find(a=>a.id===(preparation.pending||preparation.checked)?.activityId)?.rol||'']||'Actividad solicitada'} onCheck={()=>void preparation.check(refresh)}/><CompanyPeopleSummary capacity={d.cupoPersonas} canDelegate={!d.puedeValidar} busy={busy||!verified} designate={(email,revocar)=>{if(window.confirm(revocar?'Se retirará la gestión de representantes. Los permisos operativos se conservan hasta revocarlos por separado. ¿Continuar?':'Esta persona podrá gestionar la entidad y sus representantes. No obtiene permisos de administración pública. ¿Designarla responsable?'))void run(()=>request('/'+id+'/responsables','POST',{email,revocar,motivo:revocar?'Revocación por responsable de la entidad':'Designación por responsable de la entidad'}));}}/><Card><h2 className="font-semibold mb-3">Autorizar persona</h2><CompanyDraftNotice draft={draft} label="persona autorizada"/><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();if(busy||!verified||draft.conflict||!a||staleSites||preparation.pending||preparation.checking)return;void run(()=>request('/'+id+'/personas','POST',{...scope,...(previous?{revision:previous.revision}:{})}),undefined,draft.recovery.acknowledge);}}>
  <Input label="Correo de la persona" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><NativeSelect label="Rol en esta empresa" value={a?.id||''} onChange={v=>{setActivity(v);setAll(true);setSites([]);}}>{!a&&<option value="">Sin actividad validada</option>}{d.actividades.map(a=><option key={a.id} value={a.id}>{labels[a.rol]}</option>)}</NativeSelect>
  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={all} disabled={a?.rol!=='GENERADOR'} onChange={e=>setAll(e.target.checked)}/>Todos los establecimientos</label>
  {!all&&<fieldset className="sm:col-span-2"><legend className="font-medium">Establecimientos autorizados</legend>{d.establecimientos.filter(s=>s.activo).map(s=><label key={s.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" value={s.id} checked={sites.includes(s.id)} onChange={e=>setSites(e.target.checked?[...sites,s.id]:sites.filter(id=>id!==s.id))}/>{s.nombre}</label>)}</fieldset>}
  <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy||!verified||!!preparation.pending||preparation.checking||draft.conflict||staleSites||full||!a||!all&&!sites.length}>Autorizar cuenta verificada</Button><Button type="button" variant="outline" disabled={busy||!verified||!!preparation.pending||preparation.checking||draft.conflict||staleSites||full||!!previous||pending||!a||!email||!all&&!sites.length} onClick={prepareInvitation}>Preparar invitación</Button></div>
 {!a&&<p role="alert" className="text-sm text-error-800 sm:col-span-2">El rol guardado en el borrador ya no está disponible. Elegí una actividad validada para continuar.</p>}
 {staleSites&&<p role="alert" className="text-sm text-error-800 sm:col-span-2">Un establecimiento del borrador ya no está activo. Revisá el alcance antes de autorizar.<Button type="button" variant="outline" onClick={()=>setSites(sites.filter(id=>d.establecimientos.some(s=>s.id===id&&s.activo)))}>Quitar establecimientos no disponibles</Button></p>}
 {previous&&<p role="status" className="text-sm text-neutral-700 sm:col-span-2">{previous.activa?'Esta persona ya está autorizada en este rol.':'Este acceso fue revocado.'} Revisá los permisos y usá «Autorizar cuenta verificada» para {previous.activa?'actualizarlos':'reactivarlo'}.</p>}
 {!previous&&pending&&<p role="status" className="text-sm text-neutral-700 sm:col-span-2">Ya hay una invitación vigente para esta persona y rol. Revisala en «Accesos e invitaciones»; no hace falta preparar otra.</p>}
 {full&&<p role="status" className="text-sm text-neutral-700 sm:col-span-2">El cupo está completo. Podés agregar otro rol a una persona actual o revocar todos los accesos y la responsabilidad de quien deja de representar a la entidad. Una invitación vigente también reserva un lugar.</p>}
 </form>{storageFailed&&<p role="alert" className="mt-3 text-sm text-warning-800">La invitación se preparó, pero este dispositivo no pudo guardar el enlace. Copialo antes de salir; no vuelvas a enviar la invitación.</p>}</Card>
 <Card><h2 className="font-semibold mb-3">Accesos e invitaciones</h2><CompanyDraftNotice draft={reasonDraft} label="motivo de revocación"/><Input label="Motivo de revocación" value={reason} onChange={e=>setReason(e.target.value)}/><ul className="divide-y divide-neutral-100">{d.autorizaciones.map(g=>{const person=d.personas.find(p=>p.id===g.usuarioId);return <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0 break-words"><p className="font-medium">{person?.nombre||g.usuarioId}</p><p className="text-sm">{person?.email} · {labels[d.actividades.find(a=>a.id===g.actividadId)?.rol||'']} · {g.activa?'Autorizada':'Revocada'}</p><p className="text-sm">{g.todosEstablecimientos?'Todos los establecimientos':g.establecimientoIds.map((id:string)=>d.establecimientos.find(s=>s.id===id)?.nombre||'Establecimiento inactivo').join(', ')}</p></div>{g.activa&&<Button variant="outline" disabled={busy||!verified||reasonDraft.conflict||!reason.trim()} onClick={()=>void run(()=>request('/'+id+'/personas/'+g.id+'/revocar','POST',{revision:g.revision,motivo:reason}),undefined,reasonDraft.recovery.acknowledge)}>Revocar acceso</Button>}</li>;})}</ul>
  <ul className="divide-y divide-neutral-100">{d.invitaciones.map(i=>{
   const saved=usable.find(item=>item.id===i.id),live=!i.aceptadaAt&&!i.revocadaAt&&new Date(i.venceAt).getTime()>now;
   return <li key={i.id} className="space-y-2 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 text-sm"><span className="block break-all">{i.email}</span><span className="block text-neutral-600">{labels[d.actividades.find(a=>a.id===i.actividadId)?.rol||'']} · {i.aceptadaAt?'Aceptada':i.revocadaAt?'Revocada':live?'Invitación pendiente':'Vencida'}</span></p><div className="flex flex-wrap gap-2">{saved&&<Button variant="outline" disabled={busy||!verified} aria-label={shownInvitation===i.id?'Ocultar enlace':'Ver enlace de '+i.email} aria-expanded={shownInvitation===i.id} onClick={()=>setShownInvitation(shownInvitation===i.id?undefined:i.id)}>{shownInvitation===i.id?'Ocultar enlace':'Ver enlace'}</Button>}{live&&<Button variant="outline" disabled={busy||!verified} onClick={()=>void run(()=>request('/'+id+'/invitaciones/'+i.id+'/revocar','POST',{}))}>Revocar invitación</Button>}</div></div>
   {saved&&shownInvitation===i.id&&<div><Input label="Enlace de invitación" readOnly value={window.location.origin+(window.location.pathname.startsWith('/app/')?'/app':'')+saved.path}/><p className="mt-1 text-sm text-neutral-600">Vence el {new Date(i.venceAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Mendoza'})} (Mendoza). No se envió correo.</p></div>}
   {live&&verified&&!saved&&<p className="text-sm text-neutral-600">El enlace no está guardado en este contexto del dispositivo. Si no conservás una copia, revocá esta invitación antes de preparar otra.</p>}
  </li>;})}</ul>
 </Card></>;
}
