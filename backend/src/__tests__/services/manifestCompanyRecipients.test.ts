import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { manifestCompanyRecipients } from '../../services/manifestCompanyRecipients.service';
import { notifyCertificateParties } from '../../services/manifestCertificate.service';
import { notificationMailContent } from '../../services/notification-mail.service';
const find = (value: unknown) => vi.fn().mockResolvedValue(value);
let db: any;
beforeEach(() => {
 vi.stubEnv('ENTERPRISE_ENABLED','true');
 db = {
  manifiesto:{findUnique:find({generadorId:'g',transportistaId:null,operadorId:'o',contextoEmpresa:{empresaId:'co',establecimientoId:'site'}})},
  empresaActividad:{findMany:find([{id:'activity',empresaId:'co',rol:'GENERADOR',actorId:'g'}])},
  empresa:{findMany:find([{id:'co',cuit:'30123456789',razonSocial:'QA Empresa'}])},
  autorizacionEmpresa:{findMany:find([{empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:false,establecimientoIds:['site']}])},
  establecimientoEmpresa:{findMany:find([{id:'site',empresaId:'co',nombre:'QA Norte'}])},
  usuario:{findMany:find([{id:'rep'}])},
  generador:{findUnique:find({activo:true,cuit:'30-12345678-9',usuario:{id:'owner',activo:true}})},
  operador:{findUnique:find({activo:true,cuit:'30-99999999-9',usuario:{id:'operator',activo:true}})},
  transportista:{findUnique:find(null)},notificacion:{createMany:find({count:2})},
 };
});
afterEach(() => vi.unstubAllEnvs());
it('includes an authorized representative at the identified site, with fresh account filters', async () => {
 expect(await manifestCompanyRecipients(db,'m')).toEqual([{usuarioId:'rep',accesosEmpresa:[{empresaId:'co',actividadId:'activity',rol:'GENERADOR',razonSocial:'QA Empresa',establecimientoId:'site',establecimiento:'QA Norte'}]}]);
 expect(db.autorizacionEmpresa.findMany).toHaveBeenCalledWith({where:{actividadId:{in:['activity']},activa:true}});
 expect(db.usuario.findMany.mock.calls[0][0].where).toMatchObject({activo:true,emailVerified:true,rol:{in:['GENERADOR','TRANSPORTISTA','OPERADOR']}});
 expect(db.empresaActividad.findMany.mock.calls[0][0].where.OR).toEqual([{rol:'GENERADOR',actorId:'g'},{rol:'OPERADOR',actorId:'o'}]);
});
it.each(['other-site','unknown-origin','inactive-site','mismatched-company','inactive-account','inactive-actor','different-cuit','revoked-grant'])('does not disclose a certificate to %s',async reason=>{
 if(reason==='other-site')db.autorizacionEmpresa.findMany.mockResolvedValue([{empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:false,establecimientoIds:['elsewhere']}]);
 if(reason==='unknown-origin')db.manifiesto.findUnique.mockResolvedValue({generadorId:'g',operadorId:'o',contextoEmpresa:null});
 if(reason==='inactive-site')db.establecimientoEmpresa.findMany.mockResolvedValue([]);
 if(reason==='mismatched-company')db.empresa.findMany.mockResolvedValue([]);
 if(reason==='inactive-account')db.usuario.findMany.mockResolvedValue([]);
 if(reason==='inactive-actor')db.generador.findUnique.mockResolvedValue({activo:false,cuit:'30123456789'});
 if(reason==='different-cuit')db.generador.findUnique.mockResolvedValue({activo:true,cuit:'30111111111'});
 if(reason==='revoked-grant')db.autorizacionEmpresa.findMany.mockResolvedValue([]);
 expect(await manifestCompanyRecipients(db,'m')).toEqual([]);
});
it('allows a whole-company authorization for an older manifest without assuming a site',async()=>{
 db.manifiesto.findUnique.mockResolvedValue({generadorId:'g',operadorId:'o',contextoEmpresa:null});
 db.autorizacionEmpresa.findMany.mockResolvedValue([{empresaId:'co',actividadId:'activity',usuarioId:'rep',todosEstablecimientos:true,establecimientoIds:[]}]);
 const recipients=await manifestCompanyRecipients(db,'m');
 expect(recipients).toHaveLength(1);expect(recipients[0].accesosEmpresa[0].establecimientoId).toBeUndefined();
});
it('does not activate enterprise functionality when the flag is off',async()=>{
 vi.stubEnv('ENTERPRISE_ENABLED','false');expect(await manifestCompanyRecipients(db,'m')).toEqual([]);expect(db.manifiesto.findUnique).not.toHaveBeenCalled();
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
