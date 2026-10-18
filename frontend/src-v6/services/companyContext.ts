import { activityOwner } from './actorActivity';
export interface CompanyChoice {empresaId:string;razonSocial:string;actividadId:string;rol:string;autorizacionId:string;revision:number;todosEstablecimientos:boolean;establecimientos:Array<{id:string;codigo:string;nombre:string;domicilio:string}>}
export interface CompanySelection {empresaId:string;actividadId:string;establecimientoId?:string}
export interface CompanyContext extends CompanySelection {razonSocial:string;rol:string;actorId:string;autorizacionId:string;revision:number;todasSedes:boolean;domicilioLegal:{calle:string;localidad:string;departamento:string};establecimiento?:{id:string;nombre:string;domicilio:string;localidad?:string;departamento?:string;latitud?:number|null;longitud?:number|null}}
export function readCompanyContext(token:string|null):CompanySelection|null {
 if(import.meta.env.VITE_ENTERPRISE_ENABLED!=='true')return null;
 const owner=activityOwner(token);if(!owner)return null;
 try {const v=JSON.parse(sessionStorage.getItem('sitrep_company:'+owner)||'null');
  return v&&typeof v.empresaId==='string'&&v.empresaId.length>0&&v.empresaId.length<=100&&typeof v.actividadId==='string'&&v.actividadId.length>0&&v.actividadId.length<=100&&(!v.establecimientoId||typeof v.establecimientoId==='string'&&v.establecimientoId.length<=100)?v:null;
 }catch{return null;}
}
export function saveCompanyContext(owner:string,value:CompanySelection|null) {
 if(value){sessionStorage.setItem('sitrep_company:'+owner,JSON.stringify(value));sessionStorage.removeItem('sitrep_activity:'+owner);}
 else sessionStorage.removeItem('sitrep_company:'+owner);
}
export const companyHeaders=(v:CompanySelection)=>({'X-SITREP-Empresa':v.empresaId,'X-SITREP-Empresa-Actividad':v.actividadId,...(v.establecimientoId?{'X-SITREP-Establecimiento':v.establecimientoId}:{})});
export const companyCacheScope=(v:CompanySelection|null)=>v?`${v.empresaId}:${v.actividadId}:${v.establecimientoId||'todos'}`:'personal';
/** Navigation affordance only; the API remains the authority on every request. */
export const canUseCompanySection=(context:CompanyContext|undefined,path:string)=>!context||context.todasSedes
 || /^(?:\/mobile)?\/(?:dashboard|manifiestos|empresas|mi-perfil|notificaciones|soporte|ayuda|escaner-qr)(?:[/?]|$)/.test(path);
