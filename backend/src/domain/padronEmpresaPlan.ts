import { createHash } from 'node:crypto';
import { verifiedCuit } from './conciliacionExterna';
export interface PadronRow {
 source:{file:string;sha256:string;sheet:string;row:number;hidden?:boolean};
 participant:{cuitOriginal?:unknown;cuitNormalized:string|null;certificate:string;name:string};
 addresses:{legal:string[];productive:string[]};
 fields:unknown[];sourceMarks:{legalStatus:null;[key:string]:unknown};
 reconciliation:{status:string;actorId?:string|null;[key:string]:unknown};
 apply:false;
}
export interface Origin {sha256:string;hoja:string;fila:number;contenidoHash:string}
export interface RegisterActor {
 id:string;cuit:string;activo?:boolean;numeroInscripcion?:string|null;numeroHabilitacion?:string|null;
 [key:string]:unknown;
}
export interface RegisterSnapshot {
 readOnly:'on';capturedAt:string;generators:RegisterActor[];operators:RegisterActor[];transports:RegisterActor[];
}
const canonical=(value:any):string=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
export const sourceHash=(row:PadronRow)=>createHash('sha256').update(canonical(row)).digest('hex');
const originKey=(r:Origin)=>r.sha256+'/'+r.hoja+'/'+r.fila;
const certificateKey=(value:unknown)=>String(value??'').trim().toUpperCase().replace(/\s+/g,'');
const normalized=(value:string)=>value.trim().toLocaleUpperCase('es-AR').replace(/\s+/g,' ');
function append<K,V>(map:Map<K,V[]>,key:K,value:V){const list=map.get(key)||[];list.push(value);map.set(key,list);}
/** Pure dry-run. No DB client, no writes, no account creation, no implicit legal status. */
export function planCompanyRegister(rows:PadronRow[], previous:Origin[]=[],snapshot?:RegisterSnapshot) {
 if(snapshot&&(snapshot.readOnly!=='on'||!snapshot.capturedAt||!Number.isFinite(Date.parse(snapshot.capturedAt))))throw new Error('Snapshot de sólo lectura con fecha verificable requerido');
 const seen=new Map(previous.map(p=>[originKey(p),p.contenidoHash]));
 const sources:any[]=[],pending:any[]=[],reconciliation:any[]=[],companies=new Map<string,any>();let replayed=0;
 const existingByCuit=new Map<string,Array<{rol:string;actor:RegisterActor}>>(),existingByCertificate=new Map<string,RegisterActor[]>();
 if(snapshot)for(const [rol,actors]of [['GENERADOR',snapshot.generators],['OPERADOR',snapshot.operators],['TRANSPORTISTA',snapshot.transports]] as const)for(const actor of actors){
  const tax=verifiedCuit(actor.cuit);if(tax)append(existingByCuit,tax,{rol,actor});
  if(rol==='GENERADOR'&&certificateKey(actor.numeroInscripcion))append(existingByCertificate,certificateKey(actor.numeroInscripcion),actor);
 }
 const certs=new Map<string,Set<string>>();
 for(const r of rows)if(r.participant.certificate) {
  const key=r.source.sha256+'/'+r.source.sheet+'/'+r.source.row;
  const cert=certificateKey(r.participant.certificate);
  certs.set(cert,new Set([...(certs.get(cert)||[]),key]));
 }
 for(const row of rows) {
  if(row.apply!==false||row.sourceMarks.legalStatus!==null||!/^[a-f0-9]{64}$/.test(row.source.sha256)||!Number.isInteger(row.source.row)||row.source.row<1)throw new Error('Staging inválido: nunca aplicar ni inferir estado legal');
  const origin={sha256:row.source.sha256,hoja:row.source.sheet,fila:row.source.row,contenidoHash:sourceHash(row)},key=originKey(origin);
  if(seen.has(key)){if(seen.get(key)!==origin.contenidoHash)throw new Error('Origen repetido con contenido distinto: '+key);replayed++;continue;}
  seen.set(key,origin.contenidoHash);sources.push({...origin,archivo:row.source.file,datos:row});
  const cuit=typeof row.participant.cuitNormalized==='string'?verifiedCuit(row.participant.cuitNormalized):null,certificate=certificateKey(row.participant.certificate);
  const activities=cuit?existingByCuit.get(cuit)||[]:[],generators=activities.filter(a=>a.rol==='GENERADOR').map(a=>a.actor),certMatches=existingByCertificate.get(certificate)||[];
  let reason=!cuit?'CUIT_NO_CONFIRMADO':!certificate||certs.get(certificate)!.size>1?'CERTIFICADO_REPETIDO_O_AUSENTE':!['COINCIDENCIA_CERTIFICADO_Y_CUIT','ESTABLECIMIENTO_NO_REPRESENTADO','ENTIDAD_NUEVA_A_PREPARAR'].includes(row.reconciliation.status)?'CONCILIACION_PENDIENTE':null;
  if(!reason&&snapshot){
   if(certMatches.some(a=>verifiedCuit(a.cuit)!==cuit))reason='CERTIFICADO_CON_OTRO_CUIT';
   else if(certMatches.length>1||generators.length>1)reason='FICHA_EXISTENTE_AMBIGUA';
   else if(row.reconciliation.actorId&&row.reconciliation.actorId!==(certMatches[0]||generators[0])?.id)reason='VINCULO_ANTERIOR_NO_CONFIRMADO';
   else if(row.reconciliation.status==='COINCIDENCIA_CERTIFICADO_Y_CUIT'&&!certMatches.length)reason='CERTIFICADO_NO_CONFIRMADO_EN_SNAPSHOT';
   else if(row.reconciliation.status==='ENTIDAD_NUEVA_A_PREPARAR'&&activities.length)reason='ENTIDAD_YA_EXISTENTE_REVISAR';
   const actor=certMatches[0]||generators[0],differences=row.reconciliation.proposedDifferences;
   if(!reason&&actor&&Array.isArray(differences)&&differences.some(d=>typeof d?.field!=='string'||canonical(actor[d.field]??null)!==canonical(d.existing??null)))reason='DIFERENCIAS_CON_SNAPSHOT_NO_CONFIRMADAS';
  }
  if(reason||!cuit){pending.push({origen:key,motivo:reason||'CUIT_NO_CONFIRMADO',datos:row});reconciliation.push({origen:key,destino:'PENDIENTE',motivo:reason});continue;}
  const existing=certMatches[0]||generators[0],differences=Array.isArray(row.reconciliation.proposedDifferences)?row.reconciliation.proposedDifferences:[];
  const disposition=snapshot?(certMatches.length?'CONSERVAR_FICHA_EXISTENTE':activities.length?'REVISAR_CERTIFICADO_DE_ENTIDAD_EXISTENTE':'PROPONER_ENTIDAD_SIN_CUENTA'):'SIN_CONCILIACION_CON_SNAPSHOT';
  reconciliation.push({origen:key,destino:disposition,actorId:existing?.id||null,diferenciasSinAplicar:differences,observaciones:'CONSERVADAS_EN_FUENTE',actualizarExistentes:false});
  let company=companies.get(cuit);
  if(!company){company={cuit,razonesSociales:[],domiciliosLegalesCandidatos:[],establecimientos:[],fichasExistentes:[],actividadesExistentesCandidatas:activities.map(({rol,actor})=>({rol,actorId:actor.id,activa:actor.activo===true,requiereValidacionDGFA:true})),revisiones:[],acciones:['PROPONER_ENTIDAD_POR_CUIT','CONSERVAR_FICHAS_EXISTENTES','REVISAR_DIFERENCIAS'],crearCuentas:false,modificarExistentes:false};companies.set(cuit,company);}
  if(!company.razonesSociales.includes(row.participant.name))company.razonesSociales.push(row.participant.name);
  const legal=row.addresses.legal.map(v=>v.trim());
  if(legal.some(Boolean)&&!company.domiciliosLegalesCandidatos.some((a:string[])=>canonical(a)===canonical(legal)))company.domiciliosLegalesCandidatos.push(legal);
  const actorId=existing?.id||row.reconciliation.actorId;
  if(actorId&&!company.fichasExistentes.includes(actorId))company.fichasExistentes.push(actorId);
  company.establecimientos.push({codigo:certificate,domicilioProductivo:row.addresses.productive,origen:key,estadoLegal:null,observacionesConservadas:true,accion:'REVISAR_SEDE_O_CERTIFICADO_HISTORICO',crearAutomaticamente:false});
 }
 for(const company of companies.values()){
  if(company.domiciliosLegalesCandidatos.length>1)company.revisiones.push('DOMICILIOS_LEGALES_CONTRADICTORIOS');
  if(!company.domiciliosLegalesCandidatos.length)company.revisiones.push('DOMICILIO_LEGAL_A_COMPLETAR');
  if(new Set(company.razonesSociales.map(normalized)).size>1)company.revisiones.push('RAZONES_SOCIALES_DIFERENTES');
  if(company.establecimientos.length>1)company.revisiones.push('DISTINGUIR_SEDES_DE_CERTIFICADOS_SUCESIVOS');
  if(company.establecimientos.some((s:any)=>!s.domicilioProductivo.some((v:string)=>v.trim())))company.revisiones.push('DOMICILIO_PRODUCTIVO_A_COMPLETAR');
  const roles=new Map<string,number>();for(const a of company.actividadesExistentesCandidatas)roles.set(a.rol,(roles.get(a.rol)||0)+1);
  if([...roles.values()].some(n=>n>1))company.revisiones.push('VARIAS_FICHAS_PARA_MISMO_ROL');
  if(company.actividadesExistentesCandidatas.some((a:any)=>!a.activa))company.revisiones.push('ACTIVIDAD_INACTIVA_NO_HABILITAR');
 }
 return {apply:false,mode:'PREPARACION_SIN_ESCRITURAS',snapshotAt:snapshot?.capturedAt||null,snapshotVerified:!!snapshot,sources,pending,reconciliation,companies:[...companies.values()],replayed,
  summary:{input:rows.length,newSources:sources.length,replayed,pending:pending.length,companies:companies.size,establishments:[...companies.values()].reduce((n,c)=>n+c.establecimientos.length,0),legalAddressConflicts:[...companies.values()].filter(c=>c.domiciliosLegalesCandidatos.length>1).length,
   matchedExistingRows:reconciliation.filter(r=>r.destino==='CONSERVAR_FICHA_EXISTENTE').length,existingEntityOtherCertificate:reconciliation.filter(r=>r.destino==='REVISAR_CERTIFICADO_DE_ENTIDAD_EXISTENTE').length,newEntityRows:reconciliation.filter(r=>r.destino==='PROPONER_ENTIDAD_SIN_CUENTA').length,
   fieldDifferencesToReview:reconciliation.reduce((n,r)=>n+(r.diferenciasSinAplicar?.length||0),0),companiesToReview:[...companies.values()].filter(c=>c.revisiones.length).length,automaticWrites:0,automaticSiteCreations:0}};
}
