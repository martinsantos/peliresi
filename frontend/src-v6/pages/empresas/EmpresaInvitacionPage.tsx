import { useEffect,useRef,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import axios from 'axios';
import api from '../../services/api';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/ButtonV2';
import { Card } from '../../components/ui/CardV2';

// Public one-time capability. Never attach, replace or clear a different session.
export default function EmpresaInvitacionPage() {
 const {token}=useParams();const [invitation,setInvitation]=useState<any>(),[error,setError]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false);
 const [password,setPassword]=useState(''),[name,setName]=useState(''),[register,setRegister]=useState(false),[created,setCreated]=useState(false),lock=useRef(false);
 const request=async(method:string,route:string,data?:unknown)=>(await axios.request({baseURL:api.defaults.baseURL,timeout:15000,method,url:route,data})).data;
 useEffect(()=>{let active=true;if(import.meta.env.VITE_ENTERPRISE_ENABLED!=='true'){setError('Funcionalidad no disponible.');return;}
  void request('GET','/empresas/invitaciones/'+token).then(r=>{if(active)setInvitation(r.data);}).catch(()=>{if(active)setError('Esta invitación venció, fue utilizada o ya no está disponible.');});
  return()=>{active=false;};
 },[token]);
 async function submit() {
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try {
   if(register){await request('POST','/auth/register',{email:invitation.email,password,nombre:name,rol:invitation.rol});setCreated(true);setRegister(false);setPassword('');}
   else {await request('POST','/empresas/invitaciones/'+token+'/aceptar',{email:invitation.email,password});setDone(true);setPassword('');}
  }catch(e){setError((e as any)?.response?.data?.message||'No se pudo completar. Podés volver a intentarlo.');}
  finally{setBusy(false);lock.current=false;}
 }
 return <div className="mx-auto w-full max-w-lg p-4"><Card><h1 className="text-2xl font-bold text-neutral-900">Acceso a empresa</h1>
  {error&&<p role="alert" className="my-3 text-error-800">{error}</p>}
  {done?<><p role="status" className="my-4">Acceso autorizado. Tu sesión anterior no se modificó.</p><Link className="inline-flex min-h-11 items-center text-primary-800 underline" to="/empresas">Elegir empresa</Link><Link className="ml-4 inline-flex min-h-11 items-center text-primary-800 underline" to="/login">Iniciar sesión</Link></>:invitation?<form className="mt-4 space-y-4" onSubmit={e=>{e.preventDefault();void submit();}}>
   <p className="font-semibold">{invitation.empresa}</p><p>{invitation.rol} · {invitation.email}</p>
   {created&&<p role="status">Cuenta creada. Verificá tu correo y volvé a este enlace para aceptar.</p>}
   {register&&<Input label="Tu nombre" required value={name} autoComplete="name" onChange={e=>setName(e.target.value)}/>}
   <Input label={register?'Crear contraseña':'Contraseña de tu cuenta'} type="password" autoComplete={register?'new-password':'current-password'} required value={password} onChange={e=>setPassword(e.target.value)}/>
   <Button type="submit" disabled={busy}>{register?'Crear cuenta personal':'Aceptar acceso a empresa'}</Button>
   <Button variant="outline" disabled={busy} onClick={()=>{setRegister(!register);setPassword('');}}>{register?'Ya tengo cuenta':'No tengo cuenta'}</Button>
   <p className="text-sm text-neutral-600">La autorización no modifica tu cuenta ni aprueba actividades regulatorias nuevas.</p>
  </form>:!error&&<p role="status" className="mt-4">Consultando invitación…</p>}
 </Card></div>;
}
