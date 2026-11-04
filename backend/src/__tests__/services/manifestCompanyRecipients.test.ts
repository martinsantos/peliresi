import { notifyManifestParties } from '../../services/manifestProposal.service';
import { notifyAddendumParties } from '../../services/manifiestoAddendumNotice.service';
import { inTrainingSession } from '../../lib/trainingScope';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { manifestCompanyRecipients, manifestCompanyRecipientsBatch } from '../../services/manifestCompanyRecipients.service';
import { notifyCertificateParties } from '../../services/manifestCertificate.service';
import { notificationMailContent } from '../../services/notification-mail.service';
const find = (value: unknown) => vi.fn().mockResolvedValue(value);
let db: any;
beforeEach(() => {
 vi.stubEnv('ENTERPRISE_ENABLED','true');
 db = {
  manifiesto:{findMany:find([{id:'m',generadorId:'g',transportistaId:null,operadorId:'o',contextoEmpresa:{empresaId:'co',establecimientoId:'site'}}]),findUnique:find({generadorId:'g',transportistaId:null,operadorId:'o',contextoEmpresa:{empresaId:'co',establecimientoId:'site'}})},
  empresaActividad:{findMany:find([{id:'activity',empresaId:'co',rol:'GENERADOR',actorId:'g'}])},
  empresa:{findMany:find([{id:'co',cuit:'30123456789',razonSocial:'QA Empresa'}])},
  autorizacionEmpresa:{findMany:find([{empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:false,establecimientoIds:['site']}])},
  establecimientoEmpresa:{findMany:find([{id:'site',empresaId:'co',nombre:'QA Norte'}])},
  usuario:{findMany:find([{id:'rep'}])},
  generador:{findMany:find([{id:'g',activo:true,cuit:'30-12345678-9'}]),findUnique:find({activo:true,cuit:'30-12345678-9',usuario:{id:'owner',activo:true}})},
  operador:{findMany:find([{id:'o',activo:true,cuit:'30-99999999-9'}]),findUnique:find({activo:true,cuit:'30-99999999-9',usuario:{id:'operator',activo:true}})},
  transportista:{findMany:find([]),findUnique:find(null)},notificacion:{createMany:find({count:2})},
 };
});
afterEach(() => vi.unstubAllEnvs());
it('includes an authorized representative at the identified site, with fresh account filters', async () => {
 expect(await manifestCompanyRecipients(db,'m')).toEqual([{usuarioId:'rep',accesosEmpresa:[{empresaId:'co',actividadId:'activity',rol:'GENERADOR',razonSocial:'QA Empresa',establecimientoId:'site',establecimiento:'QA Norte'}]}]);
 expect(db.autorizacionEmpresa.findMany).toHaveBeenCalledWith({where:{actividadId:{in:['activity']},activa:true}});
 expect(db.usuario.findMany.mock.calls[0][0].where).toMatchObject({activo:true,emailVerified:true,rol:{in:['GENERADOR','TRANSPORTISTA','OPERADOR']}});
 expect(db.empresaActividad.findMany.mock.calls[0][0].where.OR).toEqual([{rol:'GENERADOR',actorId:'g'},{rol:'OPERADOR',actorId:'o'}]);
});
it('revalidates a page of manifests in bounded batches without mixing sites or roles', async () => {
 db.manifiesto.findMany.mockResolvedValue([
  {id:'m',generadorId:'g',transportistaId:null,operadorId:'o',contextoEmpresa:{empresaId:'co',establecimientoId:'site'}},
  {id:'m2',generadorId:'g',transportistaId:null,operadorId:'o',contextoEmpresa:{empresaId:'co',establecimientoId:'other-site'}},
 ]);
 db.establecimientoEmpresa.findMany.mockResolvedValue([{id:'site',empresaId:'co',nombre:'Norte'},{id:'other-site',empresaId:'co',nombre:'Sur'}]);
 const batch=await manifestCompanyRecipientsBatch(db,['m','m2','m'],['rep']);
 expect(batch.get('m')).toHaveLength(1);expect(batch.get('m2')).toEqual([]);
 expect(db.manifiesto.findMany).toHaveBeenCalledOnce();expect(db.autorizacionEmpresa.findMany).toHaveBeenCalledOnce();
 expect(db.generador.findMany).toHaveBeenCalledOnce();expect(db.autorizacionEmpresa.findMany.mock.calls[0][0].where.usuarioId).toEqual({in:['rep']});
});
it.each(['other-site','unknown-origin','inactive-site','mismatched-company','inactive-account','inactive-actor','different-cuit','revoked-grant'])('does not disclose a certificate to %s',async reason=>{
 if(reason==='other-site')db.autorizacionEmpresa.findMany.mockResolvedValue([{empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:false,establecimientoIds:['elsewhere']}]);
 if(reason==='unknown-origin')db.manifiesto.findMany.mockResolvedValue([{id:'m',generadorId:'g',operadorId:'o',contextoEmpresa:null}]);
 if(reason==='inactive-site')db.establecimientoEmpresa.findMany.mockResolvedValue([]);
 if(reason==='mismatched-company')db.empresa.findMany.mockResolvedValue([]);
 if(reason==='inactive-account')db.usuario.findMany.mockResolvedValue([]);
 if(reason==='inactive-actor')db.generador.findMany.mockResolvedValue([{id:'g',activo:false,cuit:'30123456789'}]);
 if(reason==='different-cuit')db.generador.findMany.mockResolvedValue([{id:'g',activo:true,cuit:'30111111111'}]);
 if(reason==='revoked-grant')db.autorizacionEmpresa.findMany.mockResolvedValue([]);
 expect(await manifestCompanyRecipients(db,'m')).toEqual([]);
});
it('allows a whole-company authorization for an older manifest without assuming a site',async()=>{
 db.manifiesto.findMany.mockResolvedValue([{id:'m',generadorId:'g',operadorId:'o',contextoEmpresa:null}]);
 db.autorizacionEmpresa.findMany.mockResolvedValue([{empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:true,establecimientoIds:[]}]);
 const recipients=await manifestCompanyRecipients(db,'m');
 expect(recipients).toHaveLength(1);expect(recipients[0].accesosEmpresa[0].establecimientoId).toBeUndefined();
});
it('does not activate enterprise functionality when the flag is off',async()=>{
 vi.stubEnv('ENTERPRISE_ENABLED','false');expect(await manifestCompanyRecipients(db,'m')).toEqual([]);expect(db.manifiesto.findMany).not.toHaveBeenCalled();
});
it('keeps one notice per person, same immutable id on retry, and no notice for the signer',async()=>{
 db.autorizacionEmpresa.findMany.mockResolvedValue([
  {empresaId:'co',actividadId:'activity',usuarioId:'owner',todosEstablecimientos:true,establecimientoIds:[]},
  {empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:true,establecimientoIds:[]},
  {empresaId:'co',actividadId:'activity',usuarioId:'operator',todosEstablecimientos:true,establecimientoIds:[]},
 ]);
 db.usuario.findMany.mockResolvedValue([{id:'owner'},{id:'rep'},{id:'operator'}]);
 const args=[db,{id:'m',numero:'QA-M',generadorId:'g',operadorId:'o',transportistaId:null},{id:'cert',numero:'QA-C',tipo:'FINAL'},'operator'] as const;
 await notifyCertificateParties(...args);await notifyCertificateParties(...args);
 const first=db.notificacion.createMany.mock.calls[0][0];
 expect(first.data.map((n:any)=>n.usuarioId).sort()).toEqual(['owner','rep']);
 expect(first).toEqual(db.notificacion.createMany.mock.calls[1][0]);expect(first.skipDuplicates).toBe(true);
 expect(JSON.parse(first.data[0].datos).accesosEmpresa).toHaveLength(1);
});
it('renders a representative email to the owned notice without sending or exposing company metadata',()=>{
 const mail=notificationMailContent({id:'notice-qa',tipo:'INFO_GENERAL',manifiestoId:'m',rol:'GENERADOR',datos:JSON.stringify({tipo:'certificado_manifiesto',version:1,documentoId:'cert',tipoCertificado:'FINAL',accesosEmpresa:[{empresaId:'co',razonSocial:'PRIVATE_QA'}]}),createdAt:new Date()} as any)!;
 expect(mail.html).toContain('/notificaciones/notice-qa');expect(mail.html).not.toContain('PRIVATE_QA');
});

it('does not read operational company grants in CAP even if the enterprise flag is enabled',async()=>{
 expect(await inTrainingSession(()=>manifestCompanyRecipients(db,'m'))).toEqual([]);
 expect(db.manifiesto.findMany).not.toHaveBeenCalled();
});
it.each(['creada','aprobacion-GENERADOR','aprobacion-TRANSPORTISTA','aprobacion-OPERADOR','aprobada','iniciada','rechazada'])('proposal %s reaches the representative with an actionable title and scoped destination',async phase=>{
 db.generador.findUnique.mockResolvedValue({activo:true,cuit:'30123456789',razonSocial:'QA Empresa',usuario:{id:'owner',activo:true}});
 const m={id:'m',numero:'QA-M',generadorId:'g',transportistaId:null,operadorId:'o',creadoPorId:'owner',fechaEstimadaRetiro:null};
 await notifyManifestParties(db,m,phase,'rep','GENERADOR');
 const notices=db.notificacion.createMany.mock.calls[0][0].data;
 const representative=notices.find((n:any)=>n.usuarioId==='rep');expect(representative).toBeDefined();
 expect(new Set(notices.map((n:any)=>n.usuarioId)).size).toBe(notices.length);
 expect(JSON.parse(representative.datos)).toMatchObject({tipo:'propuesta_partes',version:1,fase:phase,accesosEmpresa:[{empresaId:'co',actividadId:'activity'}]});
 if(phase==='creada'){expect(representative.titulo).toBe('Manifiesto pendiente de tu aprobación');expect(representative.mensaje).toContain('QA Empresa (Generador) propuso');}
});
it.each(['CREADA','APROBADA','OBSERVADA','RECHAZADA'] as const)('addendum %s reaches the representative and links exactly the reviewed annex',async event=>{
 const m={id:'m',numero:'QA-M',generadorId:'g',transportistaId:null,operadorId:'o'};
 await notifyAddendumParties(db,m,'annex',3,event,'operator','OPERADOR');
 const notices=db.notificacion.createMany.mock.calls[0][0].data;
 const representative=notices.find((n:any)=>n.usuarioId==='rep');
 expect(JSON.parse(representative.datos)).toMatchObject({tipo:'adenda_manifiesto',version:1,evento:event,adendaId:'annex',autorRol:'Operador',url:'/manifiestos/m/adendas?adenda=annex',accesosEmpresa:[{empresaId:'co'}]});
 expect(notices.some((n:any)=>n.usuarioId==='operator')).toBe(false);
});
it('names the authenticated activity of a representative reviewing an addendum, without self notice',async()=>{
 await notifyAddendumParties(db,{id:'m',numero:'QA-M',generadorId:'g',transportistaId:null,operadorId:'o'},'annex',4,'OBSERVADA','rep','GENERADOR');
 const notices=db.notificacion.createMany.mock.calls[0][0].data;
 expect(notices.some((n:any)=>n.usuarioId==='rep')).toBe(false);
 expect(notices.every((n:any)=>JSON.parse(n.datos).autorRol==='Generador')).toBe(true);
});
