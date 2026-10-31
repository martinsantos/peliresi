import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({ cases:vi.fn(),case:vi.fn(),requests:vi.fn(),request:vi.fn(),activities:vi.fn(),companies:vi.fn(),grants:vi.fn(),users:vi.fn(),generators:vi.fn(),carriers:vi.fn(),operators:vi.fn(),notice:vi.fn(),query:vi.fn(),insert:vi.fn() }));
vi.mock('../../lib/prisma',()=>({default:{alertaGenerada:{findMany:m.cases,findUnique:m.case},intercambioInspeccion:{findMany:m.requests,findUnique:m.request},
 empresaActividad:{findMany:m.activities},empresa:{findMany:m.companies},autorizacionEmpresa:{findMany:m.grants},usuario:{findMany:m.users},
 generador:{findMany:m.generators},transportista:{findMany:m.carriers},operador:{findMany:m.operators},notificacion:{findUnique:m.notice},
 $queryRawUnsafe:m.query,emailQueue:{createMany:m.insert}}}));
import { queueCommittedNotificationEmails, queuedNoticeStillEligible } from '../../services/notification-mail.service';

const date=new Date('2020-01-01T12:00:00Z');
const inspection={id:'case',numero:'QA-CASE',estado:'NOTIFICADA',inspectorId:'inspector',tipoActor:'GENERADOR',generadorId:'actor',transportistaId:null,operadorId:null,
 generador:{usuarioId:'owner'},transportista:null,operador:null};
const request={id:'req',inspeccionId:'case',tipo:'REQUERIMIENTO',parte:'AUTORIDAD',destinatario:'INSPECCIONADO',plazoRespuestaAt:date,respuestas:[],inspeccion:inspection};
const facts={familia:'catalogo_verificable',version:1,tipo:'requerimiento_inspeccion',entidad:'REQUERIMIENTO',entidadId:'req',inspeccionId:'case',tipoActor:'GENERADOR',actorId:'actor',vencimiento:date.toISOString()};
const alert={id:'alert',estado:'PENDIENTE',datos:JSON.stringify(facts),regla:{activa:true}};
const user={email:'rep@night-qa.invalid',activo:true,emailVerified:true,notifEmail:true,rol:'OPERADOR',esInspector:false};
const notice={id:'notice',tipo:'INFO_GENERAL',usuarioId:'rep',manifiestoId:null,createdAt:new Date(),datos:JSON.stringify({tipo:'psip_vencimiento_empresa',version:1,casoId:'alert',autorizacionId:'grant'})};
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv('ENTERPRISE_ENABLED','true');vi.stubEnv('ACTOR_MULTIROLE_ENABLED','false');
 vi.stubEnv('DISABLE_EMAILS','false');vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES','alertas');vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE',new Date(Date.now()-60_000).toISOString());
 m.cases.mockResolvedValue([alert]);m.case.mockResolvedValue(alert);m.requests.mockResolvedValue([request]);m.request.mockResolvedValue(request);
 m.activities.mockResolvedValue([{id:'activity',empresaId:'company',rol:'GENERADOR',actorId:'actor'}]);
 m.companies.mockResolvedValue([{id:'company',cuit:'30123456789',razonSocial:'QA Empresa'}]);
 m.grants.mockResolvedValue([{id:'grant',empresaId:'company',actividadId:'activity',usuarioId:'rep'}]);
 m.users.mockResolvedValue([{id:'rep'}]);m.generators.mockResolvedValue([{id:'actor',activo:true,cuit:'30123456789'}]);m.carriers.mockResolvedValue([]);m.operators.mockResolvedValue([]);
 m.notice.mockResolvedValue({...notice,usuario:user});m.query.mockResolvedValue([{...notice,...user}]);m.insert.mockResolvedValue({count:1});
});
afterEach(()=>vi.unstubAllEnvs());
it('simulates a queue to the owned notice and suppresses delivery after a response or revocation',async()=>{
 expect(await queueCommittedNotificationEmails()).toBe(1);expect(m.query.mock.calls[0][0]).toContain('"psip_vencimiento_empresa"');
 const queued=m.insert.mock.calls[0][0].data[0];expect(queued.estado).toBe('PENDIENTE');expect(queued.subject).toBe('[SITREP] Requerimiento vencido sin respuesta');expect(queued.html).toContain('/notificaciones/notice');
 expect(queued.html).not.toContain('QA Empresa');expect(await queuedNoticeStillEligible('notification:notice',user.email)).toBe(true);
 const answered={...request,respuestas:[{parte:'INSPECCIONADO',tipo:'RESPUESTA'}]};m.requests.mockResolvedValue([answered]);m.request.mockResolvedValue(answered);
 expect(await queuedNoticeStillEligible('notification:notice',user.email)).toBe(false);
 m.requests.mockResolvedValue([request]);m.request.mockResolvedValue(request);m.grants.mockResolvedValue([]);
 expect(await queuedNoticeStillEligible('notification:notice',user.email)).toBe(false);
});
it('does not queue anything while email is disabled',async()=>{
 vi.stubEnv('DISABLE_EMAILS','true');expect(await queueCommittedNotificationEmails()).toBe(0);expect(m.query).not.toHaveBeenCalled();
});
