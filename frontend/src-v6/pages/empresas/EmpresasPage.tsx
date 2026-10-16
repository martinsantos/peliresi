import { Activity,useEffect,useRef,useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { useMobilePrefix } from '../../hooks/useMobilePrefix';
import { api } from '../../services/api';
import { companyHeaders,saveCompanyContext,type CompanyChoice } from '../../services/companyContext';
import { clearOfflineSession } from '../../services/offlineSession';
import { catalogoService } from '../../services/catalogo.service';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';
import { NativeSelect } from '../../components/ui/NativeSelect';
import { CompanyPicker,type CompanyPagination } from '../../components/CompanyPicker';

type Company={id:string;cuit:string;razonSocial:string;nombreFantasia?:string;revision:number;domicilioLegal:{calle:string;localidad:string;departamento:string}};
type Details={empresa:Company;contextos:CompanyChoice[];actividades:Array<{id:string;rol:string;actorId:string}>;establecimientos:any[];autorizaciones:any[];responsables:any[];eventos:any[];invitaciones:any[];personas:any[];puedeGestionar:boolean;puedeValidar:boolean};
const labels:Record<string,string>={GENERADOR:'Generador',TRANSPORTISTA:'Transportista',OPERADOR:'Operador'};
const request=async(route:string,method='GET',body?:unknown)=>(await api.request({url:'/empresas'+route,method,data:body})).data.data;
const message=(e:unknown)=>(e as any)?.response?.data?.message||'No se pudo guardar. Tus datos siguen en el formulario.';
export default function EmpresasPage(){
 const {currentUser}=useAuth(),[choice,setChoice]=useState<Company>(),[page,setPage]=useState(1),[search,setSearch]=useState(''),mp=useMobilePrefix();
 const list=useQuery<{empresas:Company[];pagination:CompanyPagination;puedeValidar:boolean}>({queryKey:['empresas',currentUser?.id,page,search],queryFn:()=>request('?'+new URLSearchParams({page:String(page),limit:'25',search})),retry:false,enabled:import.meta.env.VITE_ENTERPRISE_ENABLED==='true'});
 // Pin the initial choice too: editing its name may change the server sort order.
 useEffect(()=>{if(!choice&&list.data?.empresas[0])setChoice(list.data.empresas[0]);},[choice,list.data]);
 if(import.meta.env.VITE_ENTERPRISE_ENABLED!=='true')return <p>Funcionalidad no disponible.</p>;
 const selected=choice||list.data?.empresas[0];
 return <div className="mx-auto w-full max-w-5xl space-y-5 pb-6">
  <div><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to={mp('/mi-perfil')}>Mi perfil</Link><h1 className="text-2xl font-bold text-neutral-900">Empresas y establecimientos</h1></div>
  <CompanyPicker companies={list.data?.empresas||[]} selected={selected} pagination={list.data?.pagination||{page,limit:25,total:0,totalPages:page}} busy={list.isFetching}
   onChoose={id=>setChoice(list.data?.empresas.find(c=>c.id===id)||selected)}
   onPage={next=>{setChoice(selected);setPage(next);}}
   onSearch={value=>{setChoice(selected);setPage(1);setSearch(value);}}/>
  {list.isError&&<div role="alert"><p>No pudimos consultar las empresas.</p><Button onClick={()=>void list.refetch()}>Reintentar</Button></div>}
  {selected&&<CompanyDetail key={selected.id} id={selected.id} reloadList={()=>list.refetch()}/>}
  {list.data?.puedeValidar&&<details className="rounded-xl border border-neutral-200 bg-white p-4"><summary className="min-h-11 cursor-pointer font-semibold">Registrar empresa</summary><CompanyCreate done={async c=>{setChoice(c);await list.refetch();}}/></details>}
 </div>;
}
function CompanyCreate({done}:{done:(c:Company)=>Promise<void>}){
 const [form,setForm]=useState({cuit:'',razonSocial:'',calle:'',localidad:'',departamento:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 return <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const {cuit,razonSocial,...domicilioLegal}=form;const result=await request('','POST',{cuit,razonSocial,domicilioLegal});await done(result.empresa);}catch(e){setError(message(e));}finally{setBusy(false);lock.current=false;}}}>
  {(['cuit','razonSocial','calle','localidad','departamento']as const).map((key,i)=><Input key={key} label={['CUIT de empresa','Razón social','Calle legal','Localidad legal','Departamento legal'][i]} value={form[key]} required={i<2} onChange={e=>setForm({...form,[key]:e.target.value})}/>)}
  {error&&<p role="alert" className="sm:col-span-2 text-error-700">{error}</p>}<Button type="submit" disabled={busy}>Registrar empresa</Button>
 </form>;
}
function CompanyDetail({id,reloadList}:{id:string;reloadList:()=>Promise<unknown>}){
 const {currentUser}=useAuth();const [tab,setTab]=useState('empresa'),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const [openedTabs,setOpenedTabs]=useState<Record<string,boolean>>({empresa:true});
 const query=useQuery<Details>({queryKey:['empresa',currentUser?.id,id],queryFn:()=>request('/'+id),retry:false});
 async function run(action:()=>Promise<unknown>,after?:()=>void){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await action();await Promise.all([query.refetch(),reloadList()]);after?.();setNotice('Cambios guardados');}catch(e){setError(message(e));}finally{setBusy(false);lock.current=false;}}
 if(!query.data)return query.isError?<div role="alert"><p>No pudimos abrir la empresa.</p><Button onClick={()=>void query.refetch()}>Reintentar empresa</Button></div>:<p role="status">Cargando empresa…</p>;
 const d=query.data;
 return <>
  <WorkspaceChoices choices={d.contextos||[]}/>
  <nav className="flex gap-2 overflow-x-auto border-b border-neutral-200" aria-label="Secciones de empresa">{[['empresa','Empresa'],['sedes','Establecimientos'],['personas','Personas autorizadas'],['historial','Historial']].filter(([key])=>d.puedeGestionar||!['personas','historial'].includes(key)).map(([key,title])=><button type="button" key={key} className={'min-h-11 shrink-0 border-b-2 px-3 font-medium '+(tab===key?'border-primary-700 text-primary-800':'border-transparent text-neutral-600')} aria-current={tab===key?'page':undefined} onClick={()=>{setOpenedTabs(opened=>({...opened,[key]:true}));setTab(key);}}>{title}</button>)}</nav>
  {error&&<p role="alert" className="rounded-lg border border-error-200 bg-error-50 p-3 text-error-800">{error}</p>}{notice&&<p role="status" className="text-primary-800">{notice}</p>}
  {/* Keep visited forms mounted; hidden sections pause effects and stay out of keyboard navigation. */}
  <Activity mode={tab==='empresa'?'visible':'hidden'}><CompanyForm key={d.empresa.revision} company={d.empresa} manage={d.puedeGestionar} busy={busy} save={data=>run(()=>request('/'+id,'PUT',data))}/>{d.puedeValidar&&<AuthorityTools id={id} details={d} busy={busy} run={run}/>}</Activity>
  {openedTabs.sedes&&<Activity mode={tab==='sedes'?'visible':'hidden'}><div className="space-y-3">{d.establecimientos.map(s=><Card key={s.id}><h2 className="font-semibold">{s.nombre}</h2><p>{s.domicilio||'Domicilio productivo por completar'}{s.localidad?', '+s.localidad:''}{s.departamento?', '+s.departamento:''}</p><p className="text-sm text-neutral-600">{s.codigo} · {s.activo?'Activo':'Inactivo'}</p>{Array.isArray(s.certificados)&&s.certificados.length>0&&<p className="text-sm">Certificados: {s.certificados.join(', ')}</p>}{d.puedeGestionar&&<details className="mt-2"><summary className="min-h-11 cursor-pointer text-primary-800">Editar establecimiento</summary><SiteForm key={s.revision} site={s} busy={busy} save={data=>run(()=>request('/'+id+'/establecimientos/'+s.id,'PUT',data))}/></details>}</Card>)}</div>
   {!d.establecimientos.length&&<p>No hay establecimientos cargados.</p>}{d.puedeGestionar&&<Card><h2 className="font-semibold">Agregar establecimiento</h2><SiteForm busy={busy} save={data=>run(()=>request('/'+id+'/establecimientos','POST',data))}/></Card>}</Activity>}
  {openedTabs.personas&&d.puedeGestionar&&<Activity mode={tab==='personas'?'visible':'hidden'}><People id={id} details={d} busy={busy} run={run}/></Activity>}
  {tab==='historial'&&d.puedeGestionar&&<Card><h2 className="font-semibold mb-3">Últimos 50 cambios</h2><ol className="divide-y divide-neutral-100">{d.eventos.map(e=><li className="py-3 break-words" key={e.id}><p className="font-medium">{e.tipo.replaceAll('_',' ')}</p><p className="text-sm">{new Date(e.createdAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Mendoza'})} · Persona: {e.usuarioId}</p>{e.datos?.motivo&&<p>{e.datos.motivo}</p>}</li>)}</ol>{!d.eventos.length&&<p>Sin cambios registrados.</p>}</Card>}
 </>;
}
function WorkspaceChoices({choices}:{choices:CompanyChoice[]}){
 const {currentUser}=useAuth(),mp=useMobilePrefix();const [selection,setSelection]=useState(''),[site,setSite]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),lock=useRef(false);
 const choice=choices.find(c=>c.actividadId===selection)||choices[0];
 const siteId=site||choice?.establecimientos[0]?.id||'';
 async function choose(personal=false){if(!currentUser||lock.current)return;lock.current=true;setBusy(true);setError('');try{
  if(personal)saveCompanyContext(String(currentUser.id),null);
  else if(choice){const next={empresaId:choice.empresaId,actividadId:choice.actividadId,...(siteId?{establecimientoId:siteId}:{})};const result=await api.get('/auth/profile',{headers:companyHeaders(next)});if(result.data.data.user.empresaContexto?.empresaId!==next.empresaId)throw new Error('Contexto incompatible');saveCompanyContext(String(currentUser.id),next);}
  clearOfflineSession();window.location.replace((window.location.pathname.startsWith('/app/')?'/app':'')+mp('/dashboard'));
 }catch(e){setError(message(e));setBusy(false);lock.current=false;}}
 return <Card><h2 className="font-semibold mb-3">Actuar por esta empresa</h2>{choice?<div className="grid gap-3 sm:grid-cols-2"><NativeSelect label="Actividad autorizada" value={choice.actividadId} onChange={v=>{setSelection(v);setSite('');}}>{choices.map(c=><option key={c.actividadId} value={c.actividadId}>{labels[c.rol]||c.rol}</option>)}</NativeSelect><NativeSelect label="Establecimiento para operar" value={siteId} onChange={setSite}>{!choice.establecimientos.length&&<option value="">Sin establecimiento cargado</option>}{choice.establecimientos.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.codigo}</option>)}</NativeSelect><Button disabled={busy||!choice.todosEstablecimientos&&!siteId} onClick={()=>void choose()}>Usar empresa y establecimiento</Button></div>:<p>La validación como responsable permite gestionar la empresa. Para operar necesitás una actividad autorizada.</p>}
  {currentUser?.empresaContexto&&<Button className="mt-3" variant="outline" disabled={busy} onClick={()=>void choose(true)}>Volver a mi cuenta personal</Button>}{error&&<p role="alert" className="mt-2 text-error-700">{error}</p>}
 </Card>;
}
function CompanyForm({company,manage,busy,save}:{company:Company;manage:boolean;busy:boolean;save:(data:unknown)=>Promise<void>}){
 const [form,setForm]=useState({razonSocial:company.razonSocial,nombreFantasia:company.nombreFantasia||'',...company.domicilioLegal,motivo:''});
 return <Card><h2 className="font-semibold mb-3">Domicilio legal</h2><p className="mb-3 text-sm text-neutral-600">CUIT {company.cuit}</p><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const {calle,localidad,departamento,razonSocial,nombreFantasia,motivo}=form;void save({revision:company.revision,razonSocial,nombreFantasia,domicilioLegal:{calle,localidad,departamento},motivo});}}>
  {(['razonSocial','nombreFantasia','calle','localidad','departamento'] as const).map((key,i)=><Input key={key} label={['Razón social','Nombre de fantasía','Calle legal','Localidad legal','Departamento legal'][i]} value={form[key]} readOnly={!manage} required={key==='razonSocial'} onChange={e=>setForm({...form,[key]:e.target.value})}/>)}
  {manage&&<><Input label="Motivo del cambio legal" required value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/><Button type="submit" disabled={busy}>Guardar datos legales</Button></>}
 </form></Card>;
}
function SiteForm({site,busy,save}:{site?:any;busy:boolean;save:(data:unknown)=>Promise<void>}){
 const [form,setForm]=useState({codigo:site?.codigo||'',nombre:site?.nombre||'',domicilio:site?.domicilio||'',localidad:site?.localidad||'',departamento:site?.departamento||'',certificados:(site?.certificados||[]).join(', '),motivo:'',activo:site?.activo!==false});
 return <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();const {motivo,activo,certificados,...data}=form;void save({...data,certificados:certificados.split(',').map((s:string)=>s.trim()).filter(Boolean),...(site?{revision:site.revision,activo,motivo}:{})});}}>
  {(['codigo','nombre','domicilio','localidad','departamento','certificados']as const).map((key,i)=><Input key={key} label={['Código de establecimiento','Nombre de establecimiento','Domicilio productivo','Localidad productiva','Departamento productivo','Certificados del establecimiento'][i]} value={form[key]} required={i<2} onChange={e=>setForm({...form,[key]:e.target.value})}/>)}
  {site&&<><Input label="Motivo del cambio productivo" required value={form.motivo} onChange={e=>setForm({...form,motivo:e.target.value})}/><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.activo} onChange={e=>setForm({...form,activo:e.target.checked})}/>Establecimiento activo</label></>}
  <Button type="submit" disabled={busy}>{site?'Guardar establecimiento':'Agregar establecimiento'}</Button>
 </form>;
}
function AuthorityTools({id,details:d,busy,run}:{id:string;details:Details;busy:boolean;run:(fn:()=>Promise<unknown>,after?:()=>void)=>Promise<void>}){
 const [email,setEmail]=useState(''),[reason,setReason]=useState(''),[role,setRole]=useState('GENERADOR'),[actor,setActor]=useState('');
 const catalogs=useQuery({queryKey:['company-role-catalogs',id],queryFn:async()=>{const [g,t,o]=await Promise.all([catalogoService.generadores(),catalogoService.transportistas(),catalogoService.operadores()]);return {GENERADOR:g,TRANSPORTISTA:t,OPERADOR:o};},retry:false});
 const options=(catalogs.data?.[role as 'GENERADOR']||[]).filter(a=>String(a.cuit).replace(/\D/g,'')===d.empresa.cuit);
 return <Card><h2 className="font-semibold mb-3">Validación DGFA</h2><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void run(()=>request('/'+id+'/responsables','POST',{email,motivo:reason}));}}><Input label="Correo del responsable" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Input label="Motivo de validación" required value={reason} onChange={e=>setReason(e.target.value)}/><Button type="submit" disabled={busy}>Validar responsable</Button></form>
  <ul className="my-4 space-y-2">{d.responsables.map(r=><li key={r.id} className="flex flex-wrap items-center gap-2"><span>{d.personas.find(p=>p.id===r.usuarioId)?.email||r.usuarioId} · {r.revocadoAt?'Revocado':'Validado'}</span>{!r.revocadoAt&&<Button variant="outline" disabled={busy||!reason} onClick={()=>void run(()=>request('/'+id+'/responsables','POST',{email:d.personas.find(p=>p.id===r.usuarioId)?.email,motivo:reason,revocar:true}))}>Revocar responsable</Button>}</li>)}</ul>
  <form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void run(()=>request('/'+id+'/actividades','POST',{rol:role,actorId:actor||options[0]?.id}));}}><NativeSelect label="Actividad a vincular" value={role} onChange={v=>{setRole(v);setActor('');}}>{Object.keys(labels).map(r=><option key={r} value={r}>{labels[r]}</option>)}</NativeSelect><NativeSelect label="Ficha del mismo CUIT" value={actor||options[0]?.id||''} onChange={setActor}>{!options.length&&<option value="">No hay ficha activa coincidente</option>}{options.map(a=><option key={a.id} value={a.id}>{a.razonSocial} · {String(a.numeroInscripcion||a.numeroHabilitacion||'')}</option>)}</NativeSelect><Button type="submit" disabled={busy||!options.length}>Vincular actividad existente</Button></form>
  {catalogs.isError&&<p role="alert">No pudimos consultar las fichas. <button className="min-h-11 underline" onClick={()=>void catalogs.refetch()}>Reintentar fichas</button></p>}
  <ul className="mt-3 text-sm">{d.actividades.map(a=><li key={a.id}>{labels[a.rol]} · Ficha vinculada</li>)}</ul>
 </Card>;
}
function People({id,details:d,busy,run}:{id:string;details:Details;busy:boolean;run:(fn:()=>Promise<unknown>,after?:()=>void)=>Promise<void>}){
 const [email,setEmail]=useState(''),[activity,setActivity]=useState(''),[all,setAll]=useState(true),[sites,setSites]=useState<string[]>([]),[reason,setReason]=useState(''),[invitation,setInvitation]=useState('');
 const a=d.actividades.find(a=>a.id===activity)||d.actividades[0];
 const scope={email,actividadId:a?.id,todosEstablecimientos:all,establecimientoIds:all?[]:sites};
 const person=d.personas.find(p=>p.email===email.trim().toLowerCase());
 const previous=d.autorizaciones.find(g=>g.usuarioId===person?.id&&g.actividadId===a?.id);
 return <><Card><h2 className="font-semibold mb-3">Autorizar persona</h2><form className="grid gap-3 sm:grid-cols-2" onSubmit={e=>{e.preventDefault();void run(()=>request('/'+id+'/personas','POST',{...scope,...(previous?{revision:previous.revision}:{})}));}}>
  <Input label="Correo de la persona" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/><NativeSelect label="Rol en esta empresa" value={a?.id||''} onChange={v=>{setActivity(v);setAll(true);setSites([]);}}>{!a&&<option value="">Sin actividad validada</option>}{d.actividades.map(a=><option key={a.id} value={a.id}>{labels[a.rol]}</option>)}</NativeSelect>
  <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={all} disabled={a?.rol!=='GENERADOR'} onChange={e=>setAll(e.target.checked)}/>Todos los establecimientos</label>
  {!all&&<fieldset className="sm:col-span-2"><legend className="font-medium">Establecimientos autorizados</legend>{d.establecimientos.filter(s=>s.activo).map(s=><label key={s.id} className="flex min-h-11 items-center gap-2"><input type="checkbox" value={s.id} checked={sites.includes(s.id)} onChange={e=>setSites(e.target.checked?[...sites,s.id]:sites.filter(id=>id!==s.id))}/>{s.nombre}</label>)}</fieldset>}
  <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy||!a||!all&&!sites.length}>Autorizar cuenta verificada</Button><Button variant="outline" disabled={busy||!a||!email||!all&&!sites.length} onClick={()=>void run(async()=>{const result=await request('/'+id+'/invitaciones','POST',scope);setInvitation(window.location.origin+(window.location.pathname.startsWith('/app/')?'/app':'')+result.ruta);})}>Preparar invitación</Button></div>
 </form>{invitation&&<div className="mt-3"><Input label="Enlace de invitación" readOnly value={invitation}/><p className="mt-1 text-sm text-neutral-600">Vence en 24 horas. No se envió correo.</p></div>}</Card>
 <Card><h2 className="font-semibold mb-3">Accesos e invitaciones</h2><Input label="Motivo de revocación" value={reason} onChange={e=>setReason(e.target.value)}/><ul className="divide-y divide-neutral-100">{d.autorizaciones.map(g=>{const person=d.personas.find(p=>p.id===g.usuarioId);return <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0 break-words"><p className="font-medium">{person?.nombre||g.usuarioId}</p><p className="text-sm">{person?.email} · {labels[d.actividades.find(a=>a.id===g.actividadId)?.rol||'']} · {g.activa?'Autorizada':'Revocada'}</p><p className="text-sm">{g.todosEstablecimientos?'Todos los establecimientos':g.establecimientoIds.map((id:string)=>d.establecimientos.find(s=>s.id===id)?.nombre||'Establecimiento inactivo').join(', ')}</p></div>{g.activa&&<Button variant="outline" disabled={busy||!reason.trim()} onClick={()=>void run(()=>request('/'+id+'/personas/'+g.id+'/revocar','POST',{revision:g.revision,motivo:reason}))}>Revocar acceso</Button>}</li>;})}</ul>
  <ul className="divide-y divide-neutral-100">{d.invitaciones.map(i=><li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><p className="break-all text-sm">{i.email} · {i.aceptadaAt?'Aceptada':i.revocadaAt?'Revocada':new Date(i.venceAt)<new Date()?'Vencida':'Invitación pendiente'}</p>{!i.aceptadaAt&&!i.revocadaAt&&<Button variant="outline" disabled={busy} onClick={()=>void run(()=>request('/'+id+'/invitaciones/'+i.id+'/revocar','POST',{}))}>Revocar invitación</Button>}</li>)}</ul>
 </Card></>;
}
