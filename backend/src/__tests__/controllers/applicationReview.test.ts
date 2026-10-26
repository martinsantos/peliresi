import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find:vi.fn(), replay:vi.fn(), list:vi.fn(), count:vi.fn(), update:vi.fn(), lock:vi.fn(), message:vi.fn(), messages:vi.fn(), read:vi.fn(), notify:vi.fn(), users:vi.fn(), transaction:vi.fn(), doc:vi.fn(), docUpdate:vi.fn() }));
vi.mock('../../lib/prisma',()=>({default:{
 solicitudInscripcion:{findUnique:m.find,findMany:m.list,count:m.count}, mensajeSolicitud:{findMany:m.messages,updateMany:m.read,findUnique:m.replay},
 documentoSolicitud:{findUnique:m.doc}, $transaction:m.transaction,
}}));
vi.mock('../../utils/logger',()=>({default:{error:vi.fn()}}));
vi.mock('../../services/email.service',()=>({emailService:{sendEmailVerification:vi.fn()}}));
vi.mock('../../controllers/auth.controller',()=>({generateTokens:vi.fn()}));
vi.mock('fs',async original=>{const fs=await original<typeof import('fs')>();return {...fs,default:{...fs,existsSync:()=>true}};});
import { getSolicitud,getMensajes,crearMensaje,enviarSolicitud,listarSolicitudes,revisarSolicitud,observarSolicitud,aprobarSolicitud,rechazarSolicitud,revisarDocumento,downloadDocumentoSolicitud } from '../../controllers/solicitud.controller';
const application=()=>({id:'s',tipoActor:'GENERADOR',estado:'EN_REVISION',usuarioId:'owner',usuario:{id:'owner',nombre:'QA solicitante'}});
async function call(handler:any,role='ADMIN',body:unknown={},id='admin',query:unknown={},restricted=false) {
 const res={json:vi.fn(),status:vi.fn().mockReturnThis()}, next=vi.fn();
 await handler({params:{id:'s',docId:'d'},user:{id,rol:role,restricted},body,query} as any,res as any,next);
 return {res,error:next.mock.calls[0]?.[0]};
}
beforeEach(()=>{
 vi.clearAllMocks();m.replay.mockResolvedValue(null);m.find.mockResolvedValue(application());m.list.mockResolvedValue([]);m.count.mockResolvedValue(0);m.messages.mockResolvedValue([]);m.read.mockResolvedValue({count:0});
 m.update.mockImplementation(async({data})=>({...application(),...data}));m.message.mockResolvedValue({id:'message'});m.notify.mockResolvedValue({id:'notice'});m.users.mockResolvedValue([{id:'admin'}]);m.lock.mockResolvedValue([]);
 m.doc.mockResolvedValue({id:'d',solicitudId:'s',tipo:'OTRO',estado:'PENDIENTE'});
 m.transaction.mockImplementation(async cb=>cb({$queryRaw:m.lock,solicitudInscripcion:{findUnique:m.find,update:m.update},mensajeSolicitud:{create:m.message},notificacion:{create:m.notify},usuario:{findMany:m.users},documentoSolicitud:{findUnique:m.doc,update:m.docUpdate}}));
});
it.each([getSolicitud,getMensajes,downloadDocumentoSolicitud])('foreign-sector admin cannot read data/messages/files (%#)',async handler=>{
 expect((await call(handler,'ADMIN_OPERADOR')).error).toMatchObject({statusCode:403});
 expect(m.messages).not.toHaveBeenCalled();expect(m.doc).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();
});
it.each(['ADMIN','ADMIN_GENERADOR','GENERADOR'])('authorized %s can read an application',async role=>{
 expect((await call(getSolicitud,role,{},role==='GENERADOR'?'owner':'admin')).error).toBeUndefined();
});
it.each(['ADMIN_GENERADOR','ADMIN_TRANSPORTISTA','ADMIN_OPERADOR'])('list fixes sector even if %s supplies another activity',async role=>{
 expect((await call(listarSolicitudes,role,{},'admin',{tipoActor:'OPERADOR',page:'2',limit:'20'})).error).toBeUndefined();
 expect(m.list.mock.calls[0][0]).toMatchObject({where:{tipoActor:role.replace('ADMIN_','')},skip:20,take:20});
 expect(m.count.mock.calls[0][0]).toMatchObject({where:{tipoActor:role.replace('ADMIN_','')}});
});
it('global administration can choose the activity filter',async()=>{
 await call(listarSolicitudes,'ADMIN',{},'admin',{tipoActor:'TRANSPORTISTA'});
 expect(m.list.mock.calls[0][0].where.tipoActor).toBe('TRANSPORTISTA');
});
it('foreign-sector admin cannot send correspondence',async()=>{
 expect((await call(crearMensaje,'ADMIN_OPERADOR',{contenido:'Mensaje ajeno'})).error).toMatchObject({statusCode:403});
 expect(m.message).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});
it('candidate response notifies only global and its sector inside the message transaction',async()=>{
 expect((await call(crearMensaje,'GENERADOR',{contenido:'Respuesta de práctica'},'owner')).error).toBeUndefined();
 expect(m.users).toHaveBeenCalledWith({where:{rol:{in:['ADMIN','ADMIN_GENERADOR']},activo:true},select:{id:true}});
 expect(m.transaction).toHaveBeenCalledOnce();expect(m.message).toHaveBeenCalledOnce();expect(m.notify).toHaveBeenCalledOnce();
});
it('candidate message cannot pass a concurrent rejection before acquiring the application lock',async()=>{
 m.find.mockResolvedValueOnce(application()).mockResolvedValue({...application(),estado:'RECHAZADA'});
 expect((await call(crearMensaje,'GENERADOR',{contenido:'Respuesta tardía'},'owner',{},true)).error).toMatchObject({statusCode:403});
 expect(m.lock).toHaveBeenCalledOnce();expect(m.message).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});
it.each([null,12,'', 'x'.repeat(5001)])('invalid message input does not write (%#)',async contenido=>{
 expect((await call(crearMensaje,'ADMIN',{contenido})).error).toMatchObject({statusCode:400});expect(m.message).not.toHaveBeenCalled();
});
it.each([revisarSolicitud,observarSolicitud,rechazarSolicitud])('transition rechecks current state under lock (%#)',async handler=>{
 const initial=handler===revisarSolicitud?'ENVIADA':'EN_REVISION';
 m.find.mockResolvedValueOnce({...application(),estado:initial}).mockResolvedValue({...application(),estado:'APROBADA'});
 expect((await call(handler,'ADMIN',{observaciones:'Corregir datos',motivoRechazo:'Constancia inválida'})).error).toMatchObject({statusCode:409});
 expect(m.lock).toHaveBeenCalledOnce();expect(m.update).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();expect(m.message).not.toHaveBeenCalled();
});
it.each([observarSolicitud,rechazarSolicitud])('decision and notice commit together (%#)',async handler=>{
 expect((await call(handler,'ADMIN',{observaciones:'Completar declaración',motivoRechazo:'Documento inválido'})).error).toBeUndefined();
 expect(m.transaction).toHaveBeenCalledOnce();expect(m.update).toHaveBeenCalledOnce();expect(m.notify).toHaveBeenCalledOnce();
 if(handler===observarSolicitud)expect(m.message).toHaveBeenCalledOnce();
});
it('closed application cannot receive a new document decision',async()=>{
 m.find.mockResolvedValue({...application(),estado:'APROBADA'});
 expect((await call(revisarDocumento,'ADMIN',{estado:'RECHAZADO'})).error).toMatchObject({statusCode:409});expect(m.docUpdate).not.toHaveBeenCalled();
});
it.each([revisarSolicitud,observarSolicitud,aprobarSolicitud,rechazarSolicitud])('stale revision cannot decide on data the reviewer has not seen (%#)',async handler=>{
 m.find.mockResolvedValue({...application(),estado:handler===revisarSolicitud?'ENVIADA':'EN_REVISION',updatedAt:new Date('2026-10-25T15:00:00Z')});
 expect((await call(handler,'ADMIN',{expectedUpdatedAt:'2026-10-25T14:59:00.000Z',observaciones:'Corregir declaración',motivoRechazo:'Documento inválido'})).error).toMatchObject({statusCode:409});
 expect(m.update).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});

const clientMessageId='00000000-0000-4000-8000-000000000001';
it('acknowledges an identical message retry without repeating the notification',async()=>{
 const previous={id:'ui-'+clientMessageId,solicitudId:'s',autorId:'admin',contenido:'Consulta de práctica'};
 m.replay.mockResolvedValue(previous);
 const result=await call(crearMensaje,'ADMIN',{contenido:previous.contenido,clientMessageId});
 expect(result.error).toBeUndefined();expect(result.res.json).toHaveBeenCalledWith({success:true,data:{mensaje:previous}});
 expect(m.transaction).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});
it('concurrent copies converge to the one committed message',async()=>{
 const previous={id:'ui-'+clientMessageId,solicitudId:'s',autorId:'admin',contenido:'Consulta de práctica'};
 m.replay.mockResolvedValueOnce(null).mockResolvedValueOnce(previous);m.transaction.mockRejectedValueOnce({code:'P2002'});
 const result=await call(crearMensaje,'ADMIN',{contenido:previous.contenido,clientMessageId});
 expect(result.error).toBeUndefined();expect(result.res.json).toHaveBeenCalledWith({success:true,data:{mensaje:previous}});
});
it.each([{autorId:'another'},{solicitudId:'foreign'},{contenido:'Different'}])('refuses reuse of a reference for another message %j',async difference=>{
 m.replay.mockResolvedValue({id:'ui-'+clientMessageId,solicitudId:'s',autorId:'admin',contenido:'Consulta',...difference});
 expect((await call(crearMensaje,'ADMIN',{contenido:'Consulta',clientMessageId})).error).toMatchObject({statusCode:409});
 expect(m.transaction).not.toHaveBeenCalled();
});
it('stores a valid client reference on the message, not on its notification',async()=>{
 expect((await call(crearMensaje,'ADMIN',{contenido:'Mensaje con referencia',clientMessageId})).error).toBeUndefined();
 expect(m.message.mock.calls[0][0].data.id).toBe('ui-'+clientMessageId);expect(m.notify).toHaveBeenCalledOnce();
});

it('candidate resend refuses a newer observation revision before writing or notifying',async()=>{
 m.find.mockResolvedValue({...application(),estado:'OBSERVADA',updatedAt:new Date('2026-10-26T12:01:00Z')});
 expect((await call(enviarSolicitud,'GENERADOR',{expectedUpdatedAt:'2026-10-26T12:00:00.000Z'},'owner')).error).toMatchObject({statusCode:409});
 expect(m.update).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});
it('resend of an already submitted request is read-only and never repeats notices',async()=>{
 m.find.mockResolvedValue({...application(),estado:'ENVIADA',updatedAt:new Date('2026-10-26T12:01:00Z')});
 expect((await call(enviarSolicitud,'GENERADOR',{expectedUpdatedAt:'2026-10-26T12:00:00.000Z'},'owner')).error).toBeUndefined();
 expect(m.update).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});
it.each([null,'invalid',17])('invalid resend revision %j cannot write',async expectedUpdatedAt=>{
 expect((await call(enviarSolicitud,'GENERADOR',{expectedUpdatedAt},'owner')).error).toMatchObject({statusCode:400});
 expect(m.update).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});

it.each(['APROBADO','RECHAZADO'])('does not overwrite another document decision with an old pending view (%s)',async estado=>{
 m.doc.mockResolvedValue({id:'d',solicitudId:'s',tipo:'OTRO',estado,sha256:'a'.repeat(64)});
 expect((await call(revisarDocumento,'ADMIN',{estado:'RECHAZADO',expectedDocument:{estado:'PENDIENTE',sha256:'a'.repeat(64)}})).error).toMatchObject({statusCode:409});
 expect(m.docUpdate).not.toHaveBeenCalled();
});
it('rejects a different original even if its document identifier is reused',async()=>{
 m.doc.mockResolvedValue({id:'d',solicitudId:'s',tipo:'OTRO',estado:'PENDIENTE',sha256:'b'.repeat(64)});
 expect((await call(revisarDocumento,'ADMIN',{estado:'APROBADO',expectedDocument:{estado:'PENDIENTE',sha256:'a'.repeat(64)}})).error).toMatchObject({statusCode:409});expect(m.docUpdate).not.toHaveBeenCalled();
});
it.each([12,null,'x'.repeat(5001)])('rejects invalid document observations before writing (%#)',async observaciones=>{
 expect((await call(revisarDocumento,'ADMIN',{estado:'RECHAZADO',observaciones})).error).toMatchObject({statusCode:400});expect(m.docUpdate).not.toHaveBeenCalled();
});
it('saves an explicit empty note without erasing notes when the field is omitted',async()=>{
 await call(revisarDocumento,'ADMIN',{estado:'RECHAZADO',observaciones:''});expect(m.docUpdate).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({observaciones:''})}));
 await call(revisarDocumento,'ADMIN',{estado:'RECHAZADO'});expect(m.docUpdate).toHaveBeenLastCalledWith(expect.objectContaining({data:expect.objectContaining({observaciones:undefined})}));
});

it('reviews the expected current original and trims its note without resolving the application',async()=>{
 m.doc.mockResolvedValue({id:'d',solicitudId:'s',tipo:'OTRO',estado:'PENDIENTE',sha256:'a'.repeat(64)});
 expect((await call(revisarDocumento,'ADMIN',{estado:'RECHAZADO',observaciones:'  Falta una página  ',expectedDocument:{estado:'PENDIENTE',sha256:'a'.repeat(64)}})).error).toBeUndefined();
 expect(m.docUpdate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({estado:'RECHAZADO',observaciones:'Falta una página'})}));expect(m.update).not.toHaveBeenCalled();expect(m.notify).not.toHaveBeenCalled();
});
it.each([null,[],{estado:'OTRO',sha256:null},{estado:'PENDIENTE',sha256:'broken'}])('invalid document reference cannot write (%#)',async expectedDocument=>{
 expect((await call(revisarDocumento,'ADMIN',{estado:'APROBADO',expectedDocument})).error).toMatchObject({statusCode:400});expect(m.docUpdate).not.toHaveBeenCalled();
});
