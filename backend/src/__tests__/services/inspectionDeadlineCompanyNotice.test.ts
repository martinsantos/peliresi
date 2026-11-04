import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { inTrainingSession } from '../../lib/trainingScope';
import { inspectionDeadlineCompanyNoticeRows, withInspectionDeadlineCompanyNoticeContext } from '../../services/inspectionDeadlineCompanyNotice.service';

const find = (value: unknown) => vi.fn().mockResolvedValue(value);
const inspection = { id:'case', numero:'QA-CASE', estado:'NOTIFICADA', tipoActor:'GENERADOR' as const, generadorId:'actor' };
const deadline = new Date('2020-01-01T12:00:00Z');
const request = { id:'req', inspeccionId:'case', tipo:'REQUERIMIENTO', parte:'AUTORIDAD', destinatario:'INSPECCIONADO', plazoRespuestaAt:deadline, respuestas:[], inspeccion:inspection };
const facts = { familia:'catalogo_verificable', version:1, tipo:'requerimiento_inspeccion', entidad:'REQUERIMIENTO', entidadId:'req',
 inspeccionId:'case', tipoActor:'GENERADOR', actorId:'actor', vencimiento:deadline.toISOString(), descripcion:'PRIVATE free text' };
const alert = { id:'alert', datos:JSON.stringify(facts), estado:'PENDIENTE', regla:{activa:true} };
let db: any;
beforeEach(() => {
 vi.stubEnv('ENTERPRISE_ENABLED','true');
 db={ empresaActividad:{findMany:find([{id:'activity',empresaId:'company',rol:'GENERADOR',actorId:'actor'}])},
  empresa:{findMany:find([{id:'company',cuit:'30123456789',razonSocial:'QA Empresa'}])},
  autorizacionEmpresa:{findMany:find([{id:'grant',empresaId:'company',actividadId:'activity',usuarioId:'rep'}])},
  usuario:{findMany:find([{id:'rep'}])},generador:{findMany:find([{id:'actor',activo:true,cuit:'30123456789'}])},
  transportista:{findMany:find([])},operador:{findMany:find([])},alertaGenerada:{findMany:find([alert])},
  intercambioInspeccion:{findMany:find([request])} };
});
afterEach(()=>vi.unstubAllEnvs());
it('stores a deterministic opaque notice, excludes direct recipients, and requires full company access',async()=>{
 const [notice]=await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[]);
 expect(await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[])).toEqual([notice]);
 expect(await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',['rep'])).toEqual([]);
 expect(JSON.stringify(notice)).not.toMatch(/QA-CASE|2020-01-01|company|actor|PRIVATE/);
 expect(db.autorizacionEmpresa.findMany.mock.calls[0][0].where).toMatchObject({activa:true,todosEstablecimientos:true});
});
it('does not read company authorizations when disabled or in training',async()=>{
 vi.stubEnv('ENTERPRISE_ENABLED','false');expect(await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[])).toEqual([]);
 vi.stubEnv('ENTERPRISE_ENABLED','true');expect(await inTrainingSession(()=>inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[]))).toEqual([]);
 expect(db.empresaActividad.findMany).not.toHaveBeenCalled();
});
it('projects the current requirement and company context without exposing free text',async()=>{
 const [row]=await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[]);
 const [view]=await withInspectionDeadlineCompanyNoticeContext(db,[row]);
 expect(view.titulo).toBe('Requerimiento vencido sin respuesta');expect(view.mensaje).toContain('QA-CASE');
 expect(JSON.parse(view.datos!)).toMatchObject({familia:'catalogo_verificable',tipo:'requerimiento_inspeccion',inspeccionId:'case',
  destino:'participacion',representacionVersion:1,accesosEmpresa:[{empresaId:'company',actividadId:'activity',actorId:'actor'}]});
 expect(JSON.stringify(view)).not.toMatch(/PRIVATE|autorizacionId/);
});
it.each(['answered','rule-inactive','case-resolved','deadline-changed'])('shows the notice as historical after %s',async reason=>{
 const [row]=await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[]);
 if(reason==='answered')db.intercambioInspeccion.findMany.mockResolvedValue([{...request,respuestas:[{parte:'INSPECCIONADO',tipo:'RESPUESTA'}]}]);
 if(reason==='rule-inactive')db.alertaGenerada.findMany.mockResolvedValue([{...alert,regla:{activa:false}}]);
 if(reason==='case-resolved')db.alertaGenerada.findMany.mockResolvedValue([{...alert,estado:'RESUELTA'}]);
 if(reason==='deadline-changed')db.intercambioInspeccion.findMany.mockResolvedValue([{...request,plazoRespuestaAt:new Date('2099-01-01')}]);
 const [view]=await withInspectionDeadlineCompanyNoticeContext(db,[row]);
 expect(view.titulo).toBe('Estado actualizado de requerimiento');expect(view.mensaje).not.toContain('todavía no hay una respuesta');
 expect(JSON.parse(view.datos!).estadoDetectado).toBe('ACTUALIZADO');
});
it.each(['revoked','grant-replaced','activity-inactive','actor-changed','case-hidden','wrong-source','different-recipient'])('masks the notice after %s',async reason=>{
 const [row]=await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[]);
 if(reason==='revoked')db.autorizacionEmpresa.findMany.mockResolvedValue([]);
 if(reason==='grant-replaced')db.autorizacionEmpresa.findMany.mockResolvedValue([{id:'new',empresaId:'company',actividadId:'activity',usuarioId:'rep'}]);
 if(reason==='activity-inactive')db.empresaActividad.findMany.mockResolvedValue([]);
 if(reason==='actor-changed')db.intercambioInspeccion.findMany.mockResolvedValue([{...request,inspeccion:{...inspection,generadorId:'other'}}]);
 if(reason==='case-hidden')db.intercambioInspeccion.findMany.mockResolvedValue([{...request,inspeccion:{...inspection,estado:'BORRADOR'}}]);
 if(reason==='wrong-source')db.intercambioInspeccion.findMany.mockResolvedValue([{...request,parte:'INSPECCIONADO'}]);
 if(reason==='different-recipient')row.usuarioId='other';
 const [view]=await withInspectionDeadlineCompanyNoticeContext(db,[row]);expect(view.titulo).toBe('Aviso no disponible');
 expect(JSON.stringify(view)).not.toMatch(/QA-CASE|2020-01-01|company|actor|"casoId":"alert"|grant/);
});
it('masks malformed private data and batches multiple notices',async()=>{
 const [row]=await inspectionDeadlineCompanyNoticeRows(db,inspection,'alert',[]);db.alertaGenerada.findMany.mockClear();
 const malformed={...row,datos:JSON.stringify({tipo:'psip_vencimiento_empresa',version:2,numero:'SECRET'})};
 const views=await withInspectionDeadlineCompanyNoticeContext(db,[row,row,malformed]);
 expect(views[2].titulo).toBe('Aviso no disponible');expect(JSON.stringify(views[2])).not.toContain('SECRET');
 expect(db.alertaGenerada.findMany).toHaveBeenCalledOnce();expect(db.intercambioInspeccion.findMany).toHaveBeenCalledOnce();
});
