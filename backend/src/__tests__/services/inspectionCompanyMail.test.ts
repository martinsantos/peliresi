import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ inspectionMany: vi.fn(), inspection: vi.fn(), exchangeMany: vi.fn(), exchange: vi.fn(),
  activities: vi.fn(), companies: vi.fn(), grants: vi.fn(), users: vi.fn(), generators: vi.fn(), carriers: vi.fn(), operators: vi.fn(),
  query: vi.fn(), insert: vi.fn(), notice: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: {
  inspeccion: { findMany: mock.inspectionMany, findUnique: mock.inspection },
  intercambioInspeccion: { findMany: mock.exchangeMany, findUnique: mock.exchange },
  empresaActividad: { findMany: mock.activities }, empresa: { findMany: mock.companies },
  autorizacionEmpresa: { findMany: mock.grants }, usuario: { findMany: mock.users },
  generador: { findMany: mock.generators }, transportista: { findMany: mock.carriers }, operador: { findMany: mock.operators },
  $queryRawUnsafe: mock.query, emailQueue: { createMany: mock.insert }, notificacion: { findUnique: mock.notice },
} }));
import { queueCommittedNotificationEmails, queuedNoticeStillEligible } from '../../services/notification-mail.service';

const inspection = { id:'case', numero:'QA-CASE', numeroActa:'QA-CASE', estado:'NOTIFICADA', inspectorId:'admin',
 tipoActor:'GENERADOR', generadorId:'actor', transportistaId:null, operadorId:null,
 generador:{usuarioId:'owner'}, transportista:null, operador:null };
const exchange = { id:'exchange', inspeccionId:'case', secuencia:1, tipo:'REQUERIMIENTO', parte:'AUTORIDAD',
 destinatario:'INSPECCIONADO', autorId:'admin', plazoRespuestaAt:null };
const user = { email:'rep@night-qa.invalid', activo:true, emailVerified:true, notifEmail:true, rol:'OPERADOR', esInspector:false };
const notice = { id:'notice', tipo:'INFO_GENERAL', usuarioId:'rep', manifiestoId:null, createdAt:new Date(),
 datos:JSON.stringify({tipo:'psip_empresa',version:1,clase:'intercambio',referencia:'exchange',autorizacionId:'grant'}) };
beforeEach(() => {
 vi.resetAllMocks();
 // Only this mocked queue is enabled; no SMTP or delivery function is called.
 vi.stubEnv('ENTERPRISE_ENABLED','true'); vi.stubEnv('ACTOR_MULTIROLE_ENABLED','false');
 vi.stubEnv('DISABLE_EMAILS','false'); vi.stubEnv('EMAIL_NOTIFICATION_FAMILIES','inspecciones');
 vi.stubEnv('EMAIL_DELIVERY_NOT_BEFORE',new Date(Date.now()-60_000).toISOString());
 mock.inspectionMany.mockResolvedValue([inspection]); mock.inspection.mockResolvedValue(inspection);
 mock.exchangeMany.mockResolvedValue([exchange]); mock.exchange.mockResolvedValue(exchange);
 mock.activities.mockResolvedValue([{id:'activity',empresaId:'company',rol:'GENERADOR',actorId:'actor'}]);
 mock.companies.mockResolvedValue([{id:'company',cuit:'30123456789',razonSocial:'QA Empresa'}]);
 mock.grants.mockResolvedValue([{id:'grant',empresaId:'company',actividadId:'activity',usuarioId:'rep'}]);
 mock.users.mockResolvedValue([{id:'rep'}]); mock.generators.mockResolvedValue([{id:'actor',activo:true,cuit:'30123456789'}]);
 mock.carriers.mockResolvedValue([]); mock.operators.mockResolvedValue([]);
 mock.query.mockResolvedValue([{...notice,...user}]); mock.insert.mockResolvedValue({count:1});
 mock.notice.mockResolvedValue({...notice,usuario:user});
});
afterEach(() => vi.unstubAllEnvs());
it('selects the opaque notice, renders only controlled text, and rechecks the grant before a simulated delivery', async () => {
 expect(await queueCommittedNotificationEmails()).toBe(1);
 expect(mock.query.mock.calls[0][0]).toContain('"psip_empresa"');
 const queued = mock.insert.mock.calls[0][0].data[0];
 expect(queued.estado).toBe('PENDIENTE'); expect(queued.html).toContain('/notificaciones/notice');
 expect(queued.html).not.toContain('QA Empresa');
 expect(await queuedNoticeStillEligible('notification:notice',user.email)).toBe(true);
 mock.grants.mockResolvedValue([]);
 expect(await queuedNoticeStillEligible('notification:notice',user.email)).toBe(false);
});
it('does not create a queue item while delivery is disabled', async () => {
 vi.stubEnv('DISABLE_EMAILS','true');
 expect(await queueCommittedNotificationEmails()).toBe(0); expect(mock.query).not.toHaveBeenCalled();
});
