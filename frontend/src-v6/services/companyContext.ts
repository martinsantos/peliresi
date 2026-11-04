import { activityOwner, clearActorActivity } from './actorActivity';
export interface CompanyChoice {empresaId:string;razonSocial:string;actividadId:string;rol:string;autorizacionId:string;revision:number;todosEstablecimientos:boolean;establecimientos:Array<{id:string;codigo:string;nombre:string;domicilio:string}>}
export interface CompanySelection {empresaId:string;actividadId:string;establecimientoId?:string}
export interface CompanyContext extends CompanySelection {razonSocial:string;rol:string;actorId:string;autorizacionId:string;revision:number;todasSedes:boolean;domicilioLegal:{calle:string;localidad:string;departamento:string};establecimiento?:{id:string;nombre:string;domicilio:string;localidad?:string;departamento?:string;latitud?:number|null;longitud?:number|null}}
const selectionKey=(owner:string)=>'sitrep_company:'+owner;
function selection(raw:string|null):CompanySelection|null {
 try {const v=JSON.parse(raw||'null'),id=(v:unknown)=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
  return v&&id(v.empresaId)&&id(v.actividadId)&&(!v.establecimientoId||id(v.establecimientoId))
   ?{empresaId:v.empresaId,actividadId:v.actividadId,...(v.establecimientoId?{establecimientoId:v.establecimientoId}:{})}:null;
 }catch{return null;}
}
function remember(owner:string,value:CompanySelection|null){
 try {localStorage.setItem(selectionKey(owner),JSON.stringify(value));}catch{/* Current tab still requires server validation. */}
}
export function readCompanyContext(token:string|null):CompanySelection|null {
 if(import.meta.env.VITE_ENTERPRISE_ENABLED!=='true')return null;
 const owner=activityOwner(token);if(!owner)return null;
 try {const key=selectionKey(owner),current=sessionStorage.getItem(key);
  if(current!==null){
   const choice=selection(current);
   try {if(choice&&localStorage.getItem(key)===null)remember(owner,choice);}catch{/* Keep the tab snapshot. */}
   return choice;
  }
  let remembered:CompanySelection|null=null;
  try {remembered=selection(localStorage.getItem(key));}catch{/* Use the personal context. */}
  // Pin once per tab. A different tab must not switch an open form's headers.
  sessionStorage.setItem(key,JSON.stringify(remembered));return remembered;
 }catch{return null;}
}
export function saveCompanyContext(owner:string,value:CompanySelection|null) {
 const clean=selection(JSON.stringify(value));
 if(value&&!clean)throw new Error('Contexto de empresa inválido');
 sessionStorage.setItem(selectionKey(owner),JSON.stringify(clean));remember(owner,clean);
 if(clean)clearActorActivity(owner);
}
export const companyHeaders=(v:CompanySelection)=>({'X-SITREP-Empresa':v.empresaId,'X-SITREP-Empresa-Actividad':v.actividadId,...(v.establecimientoId?{'X-SITREP-Establecimiento':v.establecimientoId}:{})});
export const companyCacheScope=(v:CompanySelection|null)=>v?`${v.empresaId}:${v.actividadId}:${v.establecimientoId||'todos'}`:'personal';
/** Navigation affordance only; the API remains the authority on every request. */
export const canUseCompanySection=(context:CompanyContext|undefined,path:string)=>!context||context.todasSedes
 || /^(?:\/mobile)?\/(?:dashboard|manifiestos|empresas|mi-perfil|notificaciones|requerimientos|mis-inspecciones|soporte|ayuda|escaner-qr)(?:[/?]|$)/.test(path);
