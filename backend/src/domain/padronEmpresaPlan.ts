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
const canonical=(value:any):string=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
export const sourceHash=(row:PadronRow)=>createHash('sha256').update(canonical(row)).digest('hex');
const originKey=(r:Origin)=>r.sha256+'/'+r.hoja+'/'+r.fila;
/** Pure dry-run. No DB client, no writes, no account creation, no implicit legal status. */
export function planCompanyRegister(rows:PadronRow[], previous:Origin[]=[]) {
 const seen=new Map(previous.map(p=>[originKey(p),p.contenidoHash]));
 const sources:any[]=[],pending:any[]=[],companies=new Map<string,any>();let replayed=0;
 const certs=new Map<string,Set<string>>();
 for(const r of rows)if(r.participant.certificate) {
  const key=r.source.sha256+'/'+r.source.sheet+'/'+r.source.row;
  certs.set(r.participant.certificate,new Set([...(certs.get(r.participant.certificate)||[]),key]));
 }
 for(const row of rows) {
  if(row.apply!==false||row.sourceMarks.legalStatus!==null||!/^[a-f0-9]{64}$/.test(row.source.sha256)||!Number.isInteger(row.source.row)||row.source.row<1)throw new Error('Staging inválido: nunca aplicar ni inferir estado legal');
  const origin={sha256:row.source.sha256,hoja:row.source.sheet,fila:row.source.row,contenidoHash:sourceHash(row)},key=originKey(origin);
  if(seen.has(key)){if(seen.get(key)!==origin.contenidoHash)throw new Error('Origen repetido con contenido distinto: '+key);replayed++;continue;}
  seen.set(key,origin.contenidoHash);sources.push({...origin,archivo:row.source.file,datos:row});
  const cuit=typeof row.participant.cuitNormalized==='string'?verifiedCuit(row.participant.cuitNormalized):null,certificate=row.participant.certificate;
  const reason=!cuit?'CUIT_NO_CONFIRMADO':!certificate||certs.get(certificate)!.size>1?'CERTIFICADO_REPETIDO_O_AUSENTE':!['COINCIDENCIA_CERTIFICADO_Y_CUIT','ESTABLECIMIENTO_NO_REPRESENTADO','ENTIDAD_NUEVA_A_PREPARAR'].includes(row.reconciliation.status)?'CONCILIACION_PENDIENTE':null;
  if(reason){pending.push({origen:key,motivo:reason,datos:row});continue;}
  let company=companies.get(cuit);
  if(!company){company={cuit,razonesSociales:[],domiciliosLegalesCandidatos:[],establecimientos:[],fichasExistentes:[],acciones:['PROPONER_ENTIDAD_POR_CUIT','CONSERVAR_FICHAS_EXISTENTES','REVISAR_DIFERENCIAS'],crearCuentas:false,modificarExistentes:false};companies.set(cuit,company);}
  if(!company.razonesSociales.includes(row.participant.name))company.razonesSociales.push(row.participant.name);
  const legal=row.addresses.legal.map(v=>v.trim());
  if(legal.some(Boolean)&&!company.domiciliosLegalesCandidatos.some((a:string[])=>canonical(a)===canonical(legal)))company.domiciliosLegalesCandidatos.push(legal);
  if(row.reconciliation.actorId&&!company.fichasExistentes.includes(row.reconciliation.actorId))company.fichasExistentes.push(row.reconciliation.actorId);
  company.establecimientos.push({codigo:certificate,domicilioProductivo:row.addresses.productive,origen:key,estadoLegal:null,observacionesConservadas:true});
 }
 return {apply:false,mode:'PREPARACION_SIN_ESCRITURAS',sources,pending,companies:[...companies.values()],replayed,
  summary:{input:rows.length,newSources:sources.length,replayed,pending:pending.length,companies:companies.size,establishments:[...companies.values()].reduce((n,c)=>n+c.establecimientos.length,0),legalAddressConflicts:[...companies.values()].filter(c=>c.domiciliosLegalesCandidatos.length>1).length}};
}
