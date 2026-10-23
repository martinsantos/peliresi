import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const root=process.cwd(), out=path.join(process.env.QA_ARTIFACTS!,'gallery');fs.mkdirSync(out,{recursive:true});
const req=createRequire(path.join(root,'frontend/package.json')), ts=req('typescript'), React=req('react'), {renderToStaticMarkup}=req('react-dom/server');
const sources=new Map<string,string>(), cache=new Map<string,any>();
const env={FRONTEND_URL:'https://sitrep.example.invalid',DISABLE_EMAILS:'true',MANIFEST_EXCEPTIONAL_REVIEWERS:'admin',MANIFEST_PARTY_REVIEW_ENABLED:'true'};
let capture:any[]=[], currentNotice:any, currentRole='GENERADOR';
const actor=(role:string)=>({id:role.toLowerCase(),usuarioId:role,activo:true,razonSocial:role==='GENERADOR'?'Taller del Oeste · ejemplo':role==='OPERADOR'?'Planta Andina · ejemplo':'Transporte Cuyo · ejemplo',domicilio:'Calle de ejemplo 123',usuario:{id:role,activo:true}});
let manifest:any={id:'MUESTRA-001',numero:'M-2026-000123',generadorId:'generador',transportistaId:'transportista',operadorId:'operador',creadoPorId:'OPERADOR',fechaEstimadaRetiro:new Date('2026-10-23T15:00:00Z'),generador:actor('GENERADOR'),transportista:actor('TRANSPORTISTA'),operador:actor('OPERADOR')};
const db:any={notificacion:{create:async({data}:any)=>{capture.push(data);return data;},createMany:async({data}:any)=>{capture.push(...data);return {count:data.length};}},usuario:{findMany:async()=>[{id:'ADMIN'}]},manifiesto:{findUnique:async()=>manifest}};
for(const role of ['GENERADOR','TRANSPORTISTA','OPERADOR'])db[role.toLowerCase()]={findUnique:async()=>actor(role)};
const dummyMutation=()=>({isPending:false,isError:false,reset(){},mutate(){}});
function read(rel:string){const s=fs.readFileSync(path.join(root,rel),'utf8');sources.set(rel,crypto.createHash('sha256').update(s).digest('hex'));return s;}
function evaluate(code:string,context:any={}){return vm.runInNewContext(code,{...context,Date,JSON,URL,URLSearchParams,Buffer,console,process:{env}},{timeout:3000});}
function moduleLoad(rel:string):any {
 if(cache.has(rel))return cache.get(rel);
 const mod={exports:{}};cache.set(rel,mod.exports);
 let src=read(rel);if(rel.endsWith('/Toast.tsx'))src+='\nexport {ToastItem};';
 const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
 function localRequire(id:string):any {
  if(['react','react/jsx-runtime','lucide-react','clsx','tailwind-merge'].includes(id))return req(id);
  if(id==='node:crypto')return crypto;
  if(id==='@prisma/client')return {};
  if(id.endsWith('/prisma'))return db;
  if(id.includes('errorHandler'))return {AppError:class extends Error{}};
  if(id.includes('logger'))return {info(){},error(){}};
  if(id.includes('push.service'))return {enviarPushAlUsuario(){throw Error('External delivery forbidden');}};
  if(id.includes('manifestTraining'))return {manifestFeatureEnabled:()=>true};
  if(id.includes('trainingScope'))return {isTrainingSession:()=>false};
  if(id.includes('inspectionExchange.service'))return {PARTICIPANT_VISIBLE_STATES:[]};
  if(id.includes('manifiestoExcepcional'))return {exceptionalApproval:()=>({estado:'PENDIENTE'})};
  if(id.includes('roleFilter'))return {isFullAccess:()=>false};
  if(id==='pdfkit')return function(){throw Error('PDF not needed');};
  // The gallery executes notification producers, never document generation or file I/O.
  if(id==='./institutionalPdf.service')return {PDF_STYLE:{},institutionalPdf(){throw Error('PDF generation forbidden in mail gallery');}};
  if(id==='react-router-dom')return {useNavigate:()=>()=>{},useSearchParams:()=>[new URLSearchParams(),()=>{}]};
  if(id==='@tanstack/react-query')return {useQueryClient:()=>({invalidateQueries(){}})};
  if(id.includes('hooks/useNotificaciones'))return {useNotificaciones:()=>({data:{items:[currentNotice],noLeidas:currentNotice.leida?0:1,total:1,totalPages:1},isSuccess:true}),useMarcarLeida:dummyMutation,useMarcarTodasLeidas:dummyMutation,useEliminarNotificacion:dummyMutation};
  if(id.includes('hooks/useMobilePrefix'))return {useMobilePrefix:()=>((p:string)=>p)};
  if(id.includes('contexts/AuthContext'))return {useAuth:()=>({currentUser:{id:'example',rol:currentRole}})};
  if(id.includes('DeviceNotificationControl'))return {DeviceNotificationControl:()=>null};
  if(id.includes('utils/formatters'))return {formatRelativeTime:()=> 'Ahora · muestra'};
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(rel),id));
  for(const ext of ['.ts','.tsx'])if(fs.existsSync(path.join(root,target+ext)))return moduleLoad(target+ext);
  throw Error('Import not allowed: '+id+' from '+rel);
 }
 evaluate('(function(require,module,exports){'+code+'\n})',{setImmediate:()=>{},setTimeout:()=>0,clearTimeout:()=>{}})(localRequire,mod,mod.exports);
 cache.set(rel,mod.exports);return mod.exports;
}
function ast(rel:string){return ts.createSourceFile(rel,read(rel),ts.ScriptTarget.Latest,true,rel.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
function variable(rel:string,name:string,ctx:any={}){const tree=ast(rel);let found:any;function visit(n:any){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)found=n.initializer;ts.forEachChild(n,visit);}visit(tree);if(!found)throw Error('Variable absent '+name);return evaluate(ts.transpileModule('('+found.getText(tree)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);}
function inlineNotice(rel:string,title:string,ctx:any={}){const tree=ast(rel);let found:any;function visit(n:any){if(ts.isObjectLiteralExpression(n)&&n.properties.some((p:any)=>p.name?.getText(tree)==='titulo'&&p.initializer&&ts.isStringLiteral(p.initializer)&&p.initializer.text===title))found=n;ts.forEachChild(n,visit);}visit(tree);if(!found)throw Error('Notice absent '+title);const data:any={};for(const p of found.properties){if(['titulo','mensaje','tipo','prioridad'].includes(p.name?.getText(tree)))data[p.name.getText(tree)]=evaluate(ts.transpileModule('('+p.initializer.getText(tree)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,ctx);}return data;}
const mails=moduleLoad('backend/src/services/email-templates.ts'), relay=moduleLoad('backend/src/services/notification-mail.service.ts'), account=moduleLoad('backend/src/services/account-mail.service.ts');
const labels={exchange:moduleLoad('backend/src/services/inspectionExchangeNotice.service.ts').INSPECTION_EXCHANGE_LABELS,agenda:moduleLoad('backend/src/services/inspectionAgendaNotice.service.ts').INSPECTION_AGENDA_LABELS,eventual:moduleLoad('backend/src/services/eventualNotice.service.ts').EVENTUAL_NOTICE_LABELS};
const allRoles=['GENERADOR','TRANSPORTISTA','OPERADOR','ADMIN','ADMIN_GENERADOR','ADMIN_TRANSPORTISTA','ADMIN_OPERADOR','INSPECTOR'];
const parties=allRoles.slice(0,3), staff=['ADMIN','ADMIN_GENERADOR','ADMIN_TRANSPORTISTA','ADMIN_OPERADOR','INSPECTOR'];
const cases:any[]=[];
function add(id:string,family:string,roles:string[],source:string,notice?:any,email?:any,note='',gate='Disponible en código'){
 const item:any={id,family,roles,source,note,gate};
 if(notice){item.notice={id,createdAt:'2026-10-21T15:00:00Z',leida:false,prioridad:'NORMAL',tipo:'INFO_GENERAL',...notice,datos:typeof notice.datos==='string'?notice.datos:JSON.stringify(notice.datos||{})};
  item.mailByRole={};for(const role of roles){const mail=relay.notificationMailContent({...item.notice,rol:role==='INSPECTOR'?'GENERADOR':role,esInspector:role==='INSPECTOR'});if(mail)item.mailByRole[role]=mail;}
 }
 if(email)item.email=email;
 cases.push(item);
}
const mailIds=['verify','pending','approved','newAccount','reset','application','observed','response','rejected','modification','modificationApproved','modificationRejected'];
for(const id of mailIds){
 const staffTemplate=['newAccount','application','response','modification'].includes(id);
 const roleField=['pending','newAccount','application','modification'].includes(id);
 for(const actorRole of roleField?parties:['']){
  const roles=staffTemplate?staff.filter(r=>r!=='INSPECTOR'):actorRole?[actorRole]:['observed','rejected','modificationApproved','modificationRejected'].includes(id)?parties:allRoles;
  const roleLabel=({GENERADOR:'Generador',TRANSPORTISTA:'Transportista',OPERADOR:'Operador'} as Record<string,string>)[actorRole];
  add('cuenta-'+id+(actorRole?'-'+actorRole:''),'Cuentas e inscripción',roles,'backend/src/services/email-templates.ts',undefined,mails.renderMail(id,{name:'María Ejemplo',...(roleField?{role:roleLabel}:{}),...(['observed','rejected','modificationRejected'].includes(id)?{message:'Adjuntá el comprobante legible y revisá el domicilio declarado.'}:{}),...(['verify','reset'].includes(id)?{token:'MUESTRA-SIN-VALIDEZ'}:{})}),'Campos variables: nombre, perfil, observación y enlace. No son credenciales válidas.'+(actorRole?' Perfil del trámite: '+roleLabel+'.':''));
 }
}
for(const event of ['created','enabled','disabled','deleted','roleChanged','emailChanged','passwordChanged'])add('seguridad-'+event,'Seguridad',allRoles,'backend/src/services/account-mail.service.ts',undefined,account.renderAccountMail(event));
const proposal=moduleLoad('backend/src/services/manifestProposal.service.ts');
for(const phase of ['creada','aprobacion-GENERADOR','aprobacion-TRANSPORTISTA','aprobacion-OPERADOR','aprobada','iniciada','rechazada']){
 capture=[];await proposal.notifyManifestParties(db,manifest,phase,'OPERADOR');add('propuesta-'+phase,'Manifiestos · aprobaciones',parties,'backend/src/services/manifestProposal.service.ts',capture[0],undefined,'Cuentas activas vinculadas y creador. Las decisiones no se completan leyendo el aviso.','Propuestas habilitadas');
}
capture=[];await proposal.notifyManifestParties(db,{...manifest,creadoPorId:'ADMIN'},'creada','ADMIN');add('propuesta-creador-administrador','Manifiestos · aprobaciones',['ADMIN'],'backend/src/services/manifestProposal.service.ts',capture.find(n=>n.usuarioId==='ADMIN'),undefined,'Variante del creador que no es una de las tres partes.','Propuestas habilitadas');
const dispatcher=moduleLoad('backend/src/services/notification-dispatcher.service.ts').notificationService;
for(const state of ['APROBADO','EN_TRANSITO','ENTREGADO','RECIBIDO','EN_TRATAMIENTO','TRATADO','RECHAZADO','CANCELADO']){
 capture=[];await dispatcher.notificarCambioEstado(manifest.id,state);
 const groups=new Map<string,any>();for(const n of capture){const k=n.titulo+'|'+n.mensaje;if(!groups.has(k))groups.set(k,{n,roles:[]});groups.get(k).roles.push(n.usuarioId);}
 let index=0;for(const {n,roles} of groups.values())add('estado-'+state+'-'+index++,'Manifiestos · operación',roles,'backend/src/services/notification-dispatcher.service.ts',n,undefined,'El autor normalmente no recibe su propio aviso.');
}
manifest={...manifest,modalidad:'IN_SITU',transportista:null};capture=[];await dispatcher.notificarCambioEstado(manifest.id,'APROBADO');add('estado-insitu','Manifiestos · operación',['OPERADOR'],'backend/src/services/notification-dispatcher.service.ts',capture.find(n=>n.usuarioId==='OPERADOR'),undefined,'Variante sin transporte.');manifest={...manifest,modalidad:'CON_TRANSPORTE',transportista:actor('TRANSPORTISTA')};
const addenda=moduleLoad('backend/src/services/manifiestoAddendumNotice.service.ts');
for(const event of ['CREADA','APROBADA','OBSERVADA','RECHAZADA'])for(const author of [...parties,'Revisor designado']){capture=[];await addenda.notifyAddendumParties(db,manifest,'ADENDA-001',1,event,author);add('adenda-'+event+'-'+author.replaceAll(' ','-'),'Adendas',parties.filter(r=>r!==author),'backend/src/services/manifiestoAddendumNotice.service.ts',capture[0],undefined,'Autor variable: '+author+'. Aprobación individual, no unanimidad.','Adendas y revisión apagadas');}
for(const [event,pair]of Object.entries(labels.eventual) as any)add('eventual-'+event,'Eventuales',event==='SOLICITAR_REVISION'?[...parties,'ADMIN']:parties,'backend/src/services/eventualNotice.service.ts',{titulo:pair[0],mensaje:'BI-MUESTRA-001 · '+pair[1],prioridad:['CREADO','SOLICITAR_REVISION','OBSERVADA_POST_FACTO'].includes(event)?'ALTA':'NORMAL',datos:{tipo:'manifiesto_eventual',version:1,correoVersion:1,registroId:'MUESTRA-001',eventoId:'evento-muestra',evento:event}},undefined,'Sólo participantes registrados con acceso. El externo sin cuenta no recibe este aviso; la autoridad debe estar designada.','Eventuales apagados');
const cert=moduleLoad('backend/src/services/manifestCertificate.service.ts');
for(const tipo of ['PARCIAL','FINAL']){capture=[];await cert.notifyCertificateParties(db,manifest,{id:'CERT-MUESTRA-001',tipo,numero:tipo==='PARCIAL'?'CP-2026-000123':'CF-2026-000123'},'OPERADOR');add('certificado-'+tipo,'Certificados',['GENERADOR','TRANSPORTISTA'],'backend/src/services/manifestCertificate.service.ts',capture[0],undefined,'El operador emite; las otras partes activas reciben. In situ: sólo generador.','Certificados habilitados');}
for(const role of parties)add('ambiental-'+role,'Certificados',[role],'backend/src/controllers/documento.controller.ts',{...inlineNotice('backend/src/controllers/documento.controller.ts','Certificado ambiental disponible'),datos:{tipo:'certificado_ambiental',documentoId:'DOC-MUESTRA',actorId:'ACTOR-MUESTRA',actorTipo:role.toLowerCase()}},undefined,'Certificado ambiental anual cargado por DGFA; distinto de los certificados del manifiesto.');
for(const [event,pair]of Object.entries(labels.exchange) as any){const participant=['REQUERIMIENTO','PRONUNCIAMIENTO','CIERRE_CONFORME','DERIVACION_LEGALES'].includes(event);add('psip-'+event,'PSIP · intercambio',participant?parties:staff,'backend/src/services/inspectionExchangeNotice.service.ts',{titulo:'PSIP · '+pair[0],mensaje:'GRP-MUESTRA-001 · Actuación #2. '+pair[1],datos:{tipo:'intercambio_inspeccion',version:1,correoVersion:1,inspeccionId:'PSIP-MUESTRA-001',intercambioId:'INTERCAMBIO-001',secuencia:2,...(event==='REQUERIMIENTO'?{plazoRespuestaAt:'2026-10-29T21:00:00Z'}:{}),evento:event,parte:participant?'AUTORIDAD':'INSPECCIONADO',destino:participant?'participacion':'inspeccion'}},undefined,participant?'Destinatario: actor inspeccionado vinculado.':'Destinatarios: inspector asignado y administración competente, excluido autor.');}
for(const [event,pair]of Object.entries(labels.agenda) as any)for(const audience of ['inspeccion',...(['NOTIFICADA','EN_TRAMITE_LEGAL','FINALIZADA'].includes(event)?['participacion']:[])])add('agenda-'+event+'-'+audience,'PSIP · agenda',audience==='inspeccion'?staff:parties,'backend/src/services/inspectionAgendaNotice.service.ts',{titulo:'PSIP · '+pair[0],mensaje:'GRP-MUESTRA-001 · '+pair[1],datos:{tipo:'agenda_inspeccion',version:1,correoVersion:1,inspeccionId:'PSIP-MUESTRA-001',eventoId:'EVENTO-001',evento:event,destino:audience}},undefined,audience==='inspeccion'?'Inspector asignado y administración del sector.':'Actor vinculado al expediente.');
for(const role of parties)add('antecedente-'+role,'PSIP · antecedentes',['ADMIN','ADMIN_'+role],'backend/src/services/inspectionIntake.service.ts',{...inlineNotice('backend/src/services/inspectionIntake.service.ts','Nuevo antecedente para evaluar en PSIP',{input:{referencia:'M-2026-000123',actorNombre:actor(role).razonSocial}}),datos:{tipo:'antecedente_fiscalizacion',version:1,correoVersion:1,antecedenteId:'ANTECEDENTE-001',url:'/inspecciones?vista=antecedentes'}},undefined,'Fuentes: hallazgo de adenda, participante sin alta o relevo externo. El texto del aviso es compartido; no prueba una infracción.');
add('corriente-postfacto','Adendas',['ADMIN','ADMIN_GENERADOR','ADMIN_OPERADOR','ADMIN_TRANSPORTISTA'],'backend/src/services/postFactoNotice.service.ts',{...inlineNotice('backend/src/services/postFactoNotice.service.ts','Nueva corriente aprobada post facto',{adenda:{numero:manifest.numero,version:1},added:['Y8','Y9']}),manifiestoId:manifest.id,datos:{tipo:'ADENDA_POST_FACTO',correoVersion:1,adendaId:'ADENDA-MUESTRA',url:'/manifiestos/'+manifest.id+'/adendas'}},undefined,'Sólo autoridad activa según política vigente. Correo por consentimiento/familia y nuevo contrato; históricos internos excluidos.','Requiere revisión habilitada');
for(const event of ['CREADO','EN_NOMBRE','RESPONDER','DERIVAR','TOMAR','ESPERAR','CERRAR','REABRIR','CLASIFICAR'])add('soporte-'+event,'Soporte',allRoles,'backend/src/controllers/support.controller.ts',{titulo:event==='CREADO'?'Nuevo ticket de soporte':event==='EN_NOMBRE'?'Ticket registrado a tu nombre':event==='DERIVAR'?'Ticket derivado a tu atención':'Actualización de soporte',mensaje:'SOP-000123 · Consultá el ticket en Soporte.',datos:{tipo:'soporte',ticketId:'SOP-MUESTRA-001',evento:event,url:'/soporte/SOP-MUESTRA-001'}},undefined,'Según evento: autor del ticket, responsable y equipo habilitado. No todos los perfiles reciben cada ticket; notas internas excluidas del correo.');
const solicitation='backend/src/controllers/solicitud.controller.ts';
for(const [key,title,type,roles]of [
 ['enviada','Nueva solicitud de inscripcion','SOLICITUD_ENVIADA',staff.filter(r=>r!=='INSPECTOR')],['mensaje-actor','Nuevo mensaje en tu solicitud','SOLICITUD_MENSAJE',parties],['mensaje-admin','Nuevo mensaje en solicitud','SOLICITUD_MENSAJE',staff.filter(r=>r!=='INSPECTOR')],['observada','Solicitud observada','SOLICITUD_OBSERVADA',parties],['aprobada','Solicitud aprobada','SOLICITUD_APROBADA',parties],['rechazada','Solicitud rechazada','SOLICITUD_RECHAZADA',parties]] as any){const n=inlineNotice(solicitation,title,{solicitud:{usuario:{nombre:'María Ejemplo'},tipoActor:'GENERADOR'},motivoRechazo:'Falta el comprobante solicitado.'});add('solicitud-'+key,'Cuentas e inscripción',roles,solicitation,{...n,tipo:type,datos:{solicitudId:'SOLICITUD-MUESTRA'}},undefined,'El texto de ejemplo conserva el tono y la ortografía del código. Destinatario según solicitud y competencia.');}
add('registro-admin','Cuentas e inscripción',['ADMIN','ADMIN_GENERADOR','ADMIN_TRANSPORTISTA','ADMIN_OPERADOR'],'backend/src/controllers/auth.controller.ts',{...inlineNotice('backend/src/controllers/auth.controller.ts','Nuevo usuario pendiente de aprobación',{user:{nombre:'María Ejemplo',rol:'GENERADOR'}}),datos:{tipo:'nuevo_registro'}},undefined,'Correo directo de registro representado en «Registro pendiente de revisión».');
const renew=moduleLoad('backend/src/services/renovacion-notification.service.ts');
for(const tipo of ['MODIFICACION_SOLICITADA','MODIFICACION_APROBADA','MODIFICACION_RECHAZADA']){capture=[];await renew.notifyRenovacion(db,{id:'RENOVACION-001',tipoActor:'GENERADOR',generadorId:'generador',motivoRechazo:'Falta respaldo del cambio de domicilio.'},tipo);add('padron-'+tipo,'Padrón',tipo==='MODIFICACION_SOLICITADA'?['ADMIN','ADMIN_GENERADOR','ADMIN_OPERADOR']:['GENERADOR','OPERADOR'],'backend/src/services/renovacion-notification.service.ts',capture[0]);}
add('atm-repetido','Documentación y ATM',parties,'backend/src/services/documentAnalysis.service.ts',{...inlineNotice('backend/src/services/documentAnalysis.service.ts','Comprobante repetido'),datos:{tipo:'comprobante_repetido',solicitudId:'SOLICITUD-MUESTRA',ruta:'/mi-solicitud'}},undefined,'Alerta al titular que carga el comprobante; abre la inscripción exacta y no acredita un pago nuevo.');
for(const actorType of ['solicitud','perfil'])if(actorType==='perfil')add('atm-repetido-perfil','Documentación y ATM',parties,'backend/src/services/documentAnalysis.service.ts',{...inlineNotice('backend/src/services/documentAnalysis.service.ts','Comprobante repetido'),datos:{tipo:'comprobante_repetido',ruta:'/mi-perfil'}});
add('recordatorio-fiscal','Padrón',['GENERADOR'],'backend/src/controllers/actor.controller.ts',{titulo:'Recordatorio fiscal 2026',mensaje:'Revisá la documentación del período 2026 en tu ficha.',prioridad:'ALTA',datos:{tipo:'recordatorio_fiscal',url:'/perfil'}},undefined,'Título parametrizado por año. El motivo lo escribe administración: este texto es un ejemplo artificial, no una plantilla fija.');
for(const type of ['mismo-transporte','registrado','externo'])add('relevo-'+type,'Transporte · relevos',[...parties,'ADMIN'],'backend/src/controllers/transport-handoff.controller.ts',{titulo:'Cambio de transporte en tránsito',mensaje:manifest.numero+': '+({ 'mismo-transporte':'Transporte Cuyo · ejemplo',registrado:'Auxilio Andino · ejemplo',externo:'Transporte externo declarado · ejemplo'}[type])+'. La transportista de origen registró el traspaso.',manifiestoId:manifest.id,datos:{tipo:'relevo_transporte',tramoId:'TRAMO-MUESTRA',url:'/manifiestos/'+manifest.id}},undefined,'Descriptor variable del reemplazo. Participantes y transportista registrado vinculado al tramo; el externo sin cuenta no recibe una comunicación.','Relevos habilitados');
add('relevo-registrado-receptor','Transporte · relevos',['TRANSPORTISTA'],'backend/src/controllers/transport-handoff.controller.ts',{titulo:'Cambio de transporte en tránsito',mensaje:manifest.numero+': Auxilio Andino · ejemplo. La transportista de origen registró el traspaso.',manifiestoId:manifest.id,datos:{tipo:'relevo_transporte',tramoId:'TRAMO-MUESTRA',url:'/transporte/perfil'}},undefined,'Transportista registrado que recibe o entrega el tramo, distinto del autor del traspaso. El enlace lleva a Mi transporte.','Relevos habilitados');

const reminder='backend/src/jobs/recordatorio.job.ts';
add('retiro-manana-transporte','Transporte · recordatorios',['TRANSPORTISTA'],reminder,{...inlineNotice(reminder,'Recordatorio: retiro manana',{m:manifest,fecha:'23/10/2026',gen:manifest.generador}),manifiestoId:manifest.id,datos:{tipo:'recordatorio_retiro',fechaRetiro:'23/10/2026'}},undefined,'Retiro previsto para mañana.');
for(const insitu of [false,true])add('retiro-manana-generador-'+insitu,'Transporte · recordatorios',['GENERADOR'],reminder,{...inlineNotice(reminder,'Recordatorio: retiro programado manana',{m:manifest,fecha:'23/10/2026',trans:insitu?null:manifest.transportista}),manifiestoId:manifest.id,datos:{tipo:'recordatorio_retiro',fechaRetiro:'23/10/2026'}},undefined,insitu?'Variante in situ.':'Variante con transporte.');
const sub='backend/src/subscribers/alerta.subscriber.ts';
for(const [id,title,roles,event]of [
 ['incidente','⚠️ Incidente en Tránsito',['OPERADOR','ADMIN'],{descripcion:'Rotura de una manguera; vehículo detenido.'}],
 ['incidente-sin-descripcion','⚠️ Incidente en Tránsito',['OPERADOR','ADMIN'],{}],
 ['rechazo','❌ Carga Rechazada',['GENERADOR','ADMIN'],{}],
 ['peso','⚖️ Diferencia de Peso Detectada',['GENERADOR','ADMIN'],{delta:'12%'}],
] as any)add('alerta-'+id,'Alertas operativas',roles,sub,{...inlineNotice(sub,title,{m:manifest,event}),manifiestoId:manifest.id});
for(const severity of ['ALTA','NORMAL'])add('gps-'+severity,'Alertas operativas',['ADMIN'],sub,{tipo:'ANOMALIA_DETECTADA',titulo:'⚠️ Anomalía GPS Detectada',mensaje:'La ubicación informada requiere verificación · ejemplo artificial.',prioridad:severity==='ALTA'?'URGENTE':'ALTA',manifiestoId:manifest.id},undefined,'Descripción libre del evento. El diseño refleja la prioridad '+(severity==='ALTA'?'urgente':'alta')+'.');
add('transito-tiempo','Alertas operativas',['ADMIN'],sub,{tipo:'ANOMALIA_DETECTADA',titulo:'⏰ Tiempo de Tránsito Excesivo',mensaje:'El manifiesto '+manifest.numero+' lleva 8.5 horas en tránsito',prioridad:'URGENTE',manifiestoId:manifest.id},undefined,'Muestra de alerta técnica existente; no equivale a un plazo legal.');
add('desvio','Alertas operativas',['ADMIN'],sub,{tipo:'ANOMALIA_DETECTADA',titulo:'🗺️ Desvío de Ruta Detectado',mensaje:'El manifiesto '+manifest.numero+' está a 6.2 km fuera del corredor',prioridad:'ALTA',manifiestoId:manifest.id});
for(const entity of ['transportista','vehículo','conductor'])for(const days of [3,20])add('vencimiento-legado-'+entity+'-'+days,'Vencimientos',['ADMIN'],sub,{tipo:'ALERTA_SISTEMA',titulo:'📋 Vencimiento Próximo — '+entity+' de ejemplo',mensaje:'El '+entity+' "'+entity+' de ejemplo" vence en '+days+' días (24/10/2026)',prioridad:days<=7?'URGENTE':'ALTA'},undefined,'Variante del recordatorio histórico. El nombre y la fecha se reemplazan por los del documento.');
for(const entity of ['TRANSPORTISTA','OPERADOR','VEHICULO','CHOFER'])for(const state of ['PROXIMO','VENCIDO']){
 const role=entity==='OPERADOR'?'OPERADOR':'TRANSPORTISTA',name=entity==='VEHICULO'?'AB123CD · ejemplo':entity==='CHOFER'?'Juan Ejemplo':actor(role).razonSocial;
 add('vencimiento-'+entity+'-'+state,'Vencimientos',[role,'ADMIN','ADMIN_'+role],'backend/src/jobs/alertCatalogue.job.ts',{titulo:'Vigencia documental · regla de ejemplo',mensaje:name+' · '+(entity==='CHOFER'?'Licencia':'Habilitación')+': fecha límite registrada 24/10/2026, hasta finalizar ese día en Mendoza. '+(state==='VENCIDO'?'Fecha registrada superada; revisar vigencia y renovación.':'Próxima a vencer; revisar renovación.')+' No determina una sanción automáticamente.',datos:{familia:'catalogo_verificable',version:1,tipo:'vencimiento_documental',entidad:entity,entidadId:'FUENTE-MUESTRA',tipoActor:role,actorId:'ACTOR-MUESTRA',casoId:'CASO-MUESTRA',estadoDetectado:state,destino:'perfil'}},undefined,'El nombre de la regla es configurable. Titular y administradores del sector según destinatarios de la regla.');
}
for(const status of ['PENDIENTE','EN_REVISION','RESUELTA','DESCARTADA'])add('requerimiento-'+status,'PSIP · plazos',[...parties,...staff],'backend/src/jobs/alertCatalogue.job.ts',{titulo:'Requerimiento sin respuesta · regla de ejemplo',mensaje:'GRP-MUESTRA-001 · Adjuntar respaldo de la subsanación. Plazo registrado: 20/10/2026, 18:00:00 (Mendoza). Sin respuesta del inspeccionado vinculada a este requerimiento. Responder no equivale a subsanación aceptada.',seguimientoEstado:status,datos:{familia:'catalogo_verificable',version:1,tipo:'requerimiento_inspeccion',entidad:'REQUERIMIENTO',entidadId:'REQ-MUESTRA',casoId:'CASO-MUESTRA',inspeccionId:'PSIP-MUESTRA',estadoDetectado:'SIN_RESPUESTA',destino:'participacion'}},undefined,'El título lo define la regla. Resolver/descartar actualiza el seguimiento de un aviso existente, no implica un nuevo envío. Inspector y administración: enlace al expediente interno.');
for(const state of ['RECIBIDO','EN_TRATAMIENTO'])for(const days of [null,1,7])add('seguimiento-'+state+'-'+days,'Seguimiento de cierre',['OPERADOR','ADMIN','ADMIN_OPERADOR'],'backend/src/jobs/seguimientoCierre.job.ts',{titulo:'Seguimiento de manifiesto',mensaje:manifest.numero+' · Evaluado el 21/10/2026. '+(days===null?'Sin fecha de recepción válida registrada.':`Recibido hace ${days} día${days===1?'':'s'}.`)+(state==='RECIBIDO'?' Revisá el pesaje y registrá el tratamiento o el cierre permitido.':' Completá el tratamiento y el cierre cuando corresponda.'),manifiestoId:manifest.id,manifiesto:{estado:state},datos:{tipo:'seguimiento_cierre',version:1,estadoDetectado:state,casoId:'CASO-MUESTRA'}},undefined,'Seguimiento operativo; no determina mora ni plazo legal. Administradores sólo si la regla los incluye.');
for(const state of ['RESUELTA','DESCARTADA'])add('seguimiento-'+state,'Seguimiento de cierre',['OPERADOR','ADMIN','ADMIN_OPERADOR'],'frontend/src-v6/utils/notificationFollowup.ts',{titulo:'Seguimiento de manifiesto',mensaje:manifest.numero+' · Evaluado el 21/10/2026. Recibido hace 7 días. Completá el tratamiento y el cierre cuando corresponda.',manifiestoId:manifest.id,seguimientoEstado:state,manifiesto:{estado:'TRATADO'},datos:{tipo:'seguimiento_cierre',version:1,casoId:'CASO-MUESTRA'}},undefined,'Estado visual del aviso conservado. No es una plantilla de nuevo envío.');
for(const event of ['CAMBIO_ESTADO','INCIDENTE','DESVIO_RUTA','TIEMPO_EXCESIVO','DIFERENCIA_PESO','RECHAZO_CARGA','VENCIMIENTO','ANOMALIA_GPS'])add('regla-'+event,'Reglas configurables',allRoles.filter(r=>r!=='INSPECTOR'),sub,{titulo:'Regla de ejemplo · '+event.toLowerCase().replaceAll('_',' '),mensaje:'Regla activada: Regla de ejemplo · '+event.toLowerCase().replaceAll('_',' '),tipo:'ALERTA_SISTEMA',prioridad:'ALTA',manifiestoId:manifest.id,datos:{evento:event,reglaId:'REGLA-MUESTRA'}},undefined,'Los destinatarios y el nombre se configuran. Es una muestra del molde común, no una regla activa consultada en producción.');
// Render the production digest function without importing its transport/queue module.
const emailTree=ast('backend/src/services/email.service.ts');
const pureFunctions=emailTree.statements.filter((n:any)=>ts.isFunctionDeclaration(n)&&['baseTemplate','digestTemplate'].includes(n.name?.text)).map((n:any)=>n.getText(emailTree).replace(/^export /,'')).join('\n');
const digest=evaluate(ts.transpileModule(pureFunctions+'\ndigestTemplate;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{...mails});
const samples=[{subject:'Habilitación próxima a vencer · ejemplo',html:mails.mailAction('/notificaciones/AVISO-MUESTRA','Abrir aviso')},{subject:'Seguimiento de manifiesto · ejemplo',html:mails.mailAction('/manifiestos/'+manifest.id,'Abrir manifiesto')}];
for(const count of [1,2])add('resumen-'+count,'Resúmenes',allRoles,'backend/src/services/email.service.ts',undefined,{subject:'[SITREP] Resumen de alertas',html:digest(samples.slice(0,count),'21/10/2026 12:00 (Mendoza)')},'Resumen horario, singular/plural. Destinatarios habilitados para este canal.');
add('resumen-helper','Resúmenes',allRoles,'backend/src/services/email-templates.ts',undefined,{subject:'[SITREP] Resumen de alertas',html:mails.renderDigest(samples)},'Renderizador auxiliar disponible; no se presenta como envío activo del job.','Auxiliar, sin emisor productivo identificado');
// One extra relay fallback covers the explicit notification type even when no fixed producer exists.
add('correo-vencimiento-tipo','Vencimientos',['ADMIN'],'backend/src/services/notification-mail.service.ts',undefined,relay.notificationMailContent({id:'MUESTRA-VENCIMIENTO',tipo:'VENCIMIENTO_PROXIMO',datos:'{}',rol:'ADMIN'}),'Molde del relay para este tipo. Los productores actuales de vencimientos usan ALERTA_SISTEMA o catálogo verificable.','Contrato de correo');

for(const fase of ['SEMANA','TREINTA_DIAS']) add('firma-'+fase,'Vencimientos',parties,'backend/src/jobs/manifestSignatureReminder.job.ts',{tipo:'VENCIMIENTO_PROXIMO',titulo:fase==='SEMANA'?'Se acercan los 30 días desde la firma':'30 días desde la firma',mensaje:'M-2026-000123 · Referencia: 30 días desde la firma. Revisá el estado actual; no determina infracción.',manifiestoId:manifest.id,datos:{tipo:'recordatorio_firma',version:1,fase,fechaFirma:'2026-09-22T12:00:00Z',fechaReferencia:'2026-10-22T12:00:00Z'}},undefined,'Días 23 y 30 desde firma. Sin reenvío de fase ni recordatorio tras cierre/cancelación/rechazo.');
const company=moduleLoad('backend/src/services/companyNotice.service.ts');
for(const [evento,pair] of Object.entries(company.COMPANY_NOTICE_LABELS) as any)add('representacion-'+evento,'Representación',parties,'backend/src/services/companyNotice.service.ts',{titulo:pair[0],mensaje:pair[1],datos:{tipo:'representacion_empresa',version:1,empresaId:'EMPRESA-MUESTRA',eventoId:'EVENTO-MUESTRA',evento}},undefined,'Personas autorizadas y responsables según el evento; no multiplica accesos por roles.');
// Every rendered notice is the actual React inbox and toast, with inert hooks.
const Inbox=moduleLoad('frontend/src-v6/pages/notificaciones/NotificacionesPage.tsx').default;
const Toast=moduleLoad('frontend/src-v6/components/ui/Toast.tsx').ToastItem;
const blobs:Record<string,string>={};
function blob(html:string){const id=crypto.createHash('sha256').update(html).digest('hex').slice(0,20);blobs[id]=html;return id;}
const logos=['mendoza-marca-horizontal-transparente.png','mail-sitrep-rotonda.png'];
function offline(html:string){for(const name of logos)html=html.replaceAll('https://sitrep.example.invalid/'+name,'data:image/png;base64,'+fs.readFileSync(path.join(root,'frontend/public',name)).toString('base64'));return html;}
const navigation=moduleLoad('frontend/src-v6/utils/notificationNavigation.ts');
for(const c of cases){
 if(c.email){c.subject=c.email.subject;c.emailRef=blob(offline(c.email.html));delete c.email;}
 if(c.mailByRole){c.mailRefs={};for(const [role,mail]of Object.entries(c.mailByRole) as any){c.mailRefs[role]={ref:blob(offline(mail.html)),subject:mail.subject,family:mail.family};}delete c.mailByRole;}
 if(c.notice){c.inboxRefs={};c.inboxReadRefs={};c.paths={};for(const role of c.roles){currentRole=role==='INSPECTOR'?'GENERADOR':role;currentNotice={...c.notice};if(c.notice.datos.includes('catalogo_verificable')&&c.notice.datos.includes('"destino":"participacion"')&&(role.startsWith('ADMIN')||role==='INSPECTOR'))currentNotice.datos=c.notice.datos.replace('"destino":"participacion"','"destino":"inspeccion"');if(c.notice.datos.includes('vencimiento_documental')&&role.startsWith('ADMIN'))currentNotice.datos=c.notice.datos.replace('"destino":"perfil"','"destino":"actor"');
   c.inboxRefs[role]=blob(renderToStaticMarkup(React.createElement(Inbox)));currentNotice={...currentNotice,leida:true};c.inboxReadRefs[role]=blob(renderToStaticMarkup(React.createElement(Inbox)));c.paths[role]=navigation.resolveNotificationPath(currentNotice,'',currentRole);
  }
  c.toastRef=blob(renderToStaticMarkup(React.createElement(Toast,{id:c.id,type:['ALTA','URGENTE'].includes(c.notice.prioridad)?'warning':'info',title:c.notice.titulo,message:c.notice.mensaje,onRemove(){},onAction(){},actionLabel:'Abrir'})));
 }
 c.title=c.notice?.titulo||c.subject?.replace('[SITREP] ','')||Object.values(c.mailRefs||{})[0]?.subject?.replace('[SITREP] ','');
 if(!c.title)throw Error('Missing title '+c.id);
}
const producerFiles=fs.readFileSync(path.join(root,'frontend/cloud-qa/communications-producers.txt'),'utf8').trim().split('\n');
for(const file of producerFiles)read(file);
function discoverProducers(dir:string):string[] {
 return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(entry=>{
   const name=dir+'/'+entry.name;
   if(entry.isDirectory())return entry.name==='__tests__'?[]:discoverProducers(name);
   if(!entry.name.endsWith('.ts'))return [];
   return /notificacion\.(?:create|createMany)|notificationService\.(?:crearNotificacion|notificarPorRol|notificarCambioEstado)/.test(fs.readFileSync(path.join(root,name),'utf8'))?[name]:[];
 });
}
const discoveredProducers=discoverProducers('backend/src');
const uncataloguedProducers=discoveredProducers.filter(file=>!producerFiles.includes(file));
if(uncataloguedProducers.length)throw Error('A new notice producer needs gallery coverage: '+uncataloguedProducers.join(', '));

const coverage={source:process.env.QA_SOURCE_LABEL||process.env.GITHUB_SHA||'Checkout local · consultar huellas de fuentes',generatedAt:new Date().toISOString(),cases:cases.length,mailCases:cases.filter(c=>c.emailRef||Object.keys(c.mailRefs||{}).length).length,noticeCases:cases.filter(c=>c.notice).length,roles:allRoles,files:[...sources].map(([file,sha256])=>({file,sha256})),producerFiles,discoveredProducers,uncataloguedProducers,unrepresentedProducers:producerFiles.filter(file=>!cases.some(c=>c.source===file)),boundaries:['Los textos libres, nombres, fechas, cantidades y reglas configurables admiten valores ilimitados: se muestran moldes y ejemplos, no todas las combinaciones.','El rol filtra audiencias posibles. El alcance por expediente, relación, autor, preferencias y actividad sigue siendo obligatorio.','CAP cerrado, correo/push apagados. La galería no consulta servidores ni envía mensajes.','Campana y emergente renderizados desde componentes reales, fuera de CAP. Push es una maqueta del contenido: no acredita entrega ni implementación de push para cada emisor, ni es una captura de Android/iOS.','No incluye cada toast de validación de formularios: cubre comunicaciones de eventos, trámites y alertas notificables.'],deliveryCalls:0,databaseConnections:0};
fs.writeFileSync(path.join(out,'catalogue.json'),JSON.stringify({coverage,cases,blobs}));
fs.writeFileSync(path.join(out,'coverage.json'),JSON.stringify(coverage,null,2));
console.log(JSON.stringify({cases:cases.length,mail:coverage.mailCases,notices:coverage.noticeCases,uniqueRenders:Object.keys(blobs).length,unrepresented:coverage.unrepresentedProducers}));
