import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const m = vi.hoisted(() => ({ unique: vi.fn(), first: vi.fn(), many: vi.fn(), create: vi.fn(), inspection: vi.fn(), access: vi.fn(), pdf: vi.fn(), tx: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { eventoInspeccion: { findUnique: m.unique, findFirst: m.first, findMany: m.many, create: m.create }, inspeccion: { findUnique: m.inspection }, $transaction: m.tx } }));
vi.mock('../../controllers/inspeccion.controller', () => ({ canAccessInspection: m.access, inspectionInclude: {} }));
vi.mock('../../services/inspectionFieldActPdf.service', () => ({ streamInspectionActPdf: m.pdf }));
vi.mock('../../services/inspectionEvidence.service', () => ({ resolveInspectionEvidence: vi.fn() }));
vi.mock('../../services/inspectionManagementRole.service', () => ({ inspectionManagementRecipientIds: vi.fn().mockResolvedValue([]) }));
const mail = vi.hoisted(() => ({ queue: vi.fn(), list: vi.fn(), state: vi.fn() }));
vi.mock('../../services/inspectionActMail.service', () => ({ queueInspectionActMails: mail.queue, listInspectionActMails: mail.list, inspectionActMailState: mail.state }));
import { readSharedAct, downloadSharedAct, createActShare, presentSharedAct, respondSharedAct, listActMails } from '../../controllers/inspectionActShare.controller';
import { inspectionSignatureHash } from '../../domain/inspectionSignature';
const token = 'a'.repeat(64), hash = createHash('sha256').update(token).digest('hex');
const snapshot = { id: 'case', numero: 'QA-1', acta: {}, evidencias: [], items: [], comparaciones: [] };
const signed = { id: 'sig', tipo: 'ACTA_FIRMADA', createdAt: new Date(), metadata: { snapshot, contenidoSha256: inspectionSignatureHash(snapshot), firma: { nombre: 'Persona QA' } } };
function grant(extra = {}) { return { id: 'grant', inspeccionId: 'case', usuarioId: 'staff', tipo: 'ACTA_ACCESO_HABILITADO', metadata: { tokenHash: hash, expiresAt: new Date(Date.now()+60000).toISOString(), firmaId: 'sig', ...extra } }; }
function request(value = token) { return { params: { accesoId: 'grant', id: 'case' }, get: () => value, user: { id: 'actor', rol: 'GENERADOR' } } as any; }
function response() { return { setHeader: vi.fn(), json: vi.fn(), status: vi.fn().mockReturnThis() } as any; }
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('INSPECTION_FIELD_MODEL_ENABLED', 'true'); m.unique.mockResolvedValue(grant()); m.first.mockResolvedValueOnce(null).mockResolvedValue(signed); m.many.mockResolvedValue([]); });
describe('acta shared capability boundary', () => {
 it.each(['', 'invalid', 'b'.repeat(64)])('rejects missing or wrong token %s', async value => { const next=vi.fn(); await readSharedAct(request(value),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403})); expect(m.many).not.toHaveBeenCalled(); });
 it.each(['2020-01-01', 'not-a-date', undefined])('fails closed for expiry %s', async expiresAt => { m.unique.mockResolvedValue(grant({expiresAt})); const next=vi.fn(); await readSharedAct(request(),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403})); });
 it('rejects revoked link before rendering PDF', async () => { m.first.mockReset().mockResolvedValue({id:'revoke'}); const next=vi.fn(); await downloadSharedAct(request(),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403})); expect(m.pdf).not.toHaveBeenCalled(); });
 it('does not expose internal data and scopes conversation to this access', async () => { const res=response(), next=vi.fn(); await readSharedAct(request(),res,next); expect(next).not.toHaveBeenCalled(); expect(m.many).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({inspeccionId:'case',metadata:{path:['accesoId'],equals:'grant'}})})); expect(res.json.mock.calls[0][0].data).not.toHaveProperty('snapshot'); expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','no-store'); });
 it('rejects altered frozen content', async () => { m.first.mockReset().mockResolvedValueOnce(null).mockResolvedValue({...signed,metadata:{...signed.metadata,contenidoSha256:'0'.repeat(64)}}); const next=vi.fn(); await downloadSharedAct(request(),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:409})); expect(m.pdf).not.toHaveBeenCalled(); });
 it('does not let an actor issue access links', async () => { m.inspection.mockResolvedValue({id:'case'}); m.access.mockReturnValue(false); const next=vi.fn(); await createActShare(request(),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403})); expect(m.create).not.toHaveBeenCalled(); });
 it('rejects presentation without capability before starting transaction', async () => { const next=vi.fn(); await presentSharedAct(request(''),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:403})); expect(m.tx).not.toHaveBeenCalled(); });
 it('keeps feature off without database access', async () => { vi.stubEnv('INSPECTION_FIELD_MODEL_ENABLED','false'); const next=vi.fn(); await readSharedAct(request(),response(),next); expect(next).toHaveBeenCalledWith(expect.objectContaining({statusCode:404})); expect(m.unique).not.toHaveBeenCalled(); });
});

describe('acta link mail ledger', () => {
 const body = { clienteId: '6f1c0d1e-1111-4111-8111-111111111111', tipo: 'DESCARGO', nombre: 'Persona QA', texto: 'Descargo artificial para la prueba.' };
 function linkTx(previous: any) {
  const t = { $queryRaw: vi.fn(), eventoInspeccion: { findUnique: vi.fn().mockResolvedValue({ ...grant(), destinatario: 'persona@practica.sitrep.test' }), findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(signed).mockResolvedValueOnce(previous), create: vi.fn().mockResolvedValue({ id: 'pres', createdAt: new Date() }) },
   inspeccion: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'case', numero: 'INS-1', numeroActa: 'QA-1', inspectorId: 'insp', tipoActor: null }) }, usuario: { findMany: vi.fn().mockResolvedValue([]) }, notificacion: { createMany: vi.fn() } };
  m.tx.mockImplementation((fn: any) => fn(t)); return t;
 }
 it('prepares mail once for a new presentation, with the link recipient and expiry', async () => {
  linkTx(null); const res = response(), next = vi.fn();
  await presentSharedAct({ ...request(), body } as any, res, next);
  expect(next).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(201);
  expect(mail.queue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ event: 'PRESENTACION_RECIBIDA', eventoId: 'pres', share: expect.objectContaining({ destinatario: 'persona@practica.sitrep.test' }) }));
 });
 it('does not prepare mail again for an idempotent replay', async () => {
  linkTx({ id: 'pres', createdAt: new Date(), detalle: body.texto, metadata: { accesoId: 'grant', nombre: body.nombre, tipo: body.tipo } });
  const res = response(), next = vi.fn();
  await presentSharedAct({ ...request(), body } as any, res, next);
  expect(next).not.toHaveBeenCalled(); expect(mail.queue).not.toHaveBeenCalled();
 });
 it('withholds the recipient address when the link was revoked before the answer', async () => {
  m.inspection.mockResolvedValue({ id: 'case', numero: 'INS-1', numeroActa: 'QA-1', inspectorId: 'insp', eventos: [] }); m.access.mockReturnValue(true);
  const t = { $queryRaw: vi.fn(), eventoInspeccion: { findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'pres', createdAt: new Date(), metadata: { accesoId: 'grant', tipo: 'DESCARGO', nombre: 'Persona QA' } }).mockResolvedValueOnce({ ...grant(), destinatario: 'persona@practica.sitrep.test' }).mockResolvedValueOnce({ id: 'revoke' }), create: vi.fn().mockResolvedValue({ id: 'ans', createdAt: new Date() }) } };
  m.tx.mockImplementation((fn: any) => fn(t)); const res = response(), next = vi.fn();
  await respondSharedAct({ ...request(), body: { clienteId: body.clienteId, respondeAId: 'pres', texto: 'Respuesta artificial del equipo.' } } as any, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(mail.queue).toHaveBeenCalledWith(t, expect.objectContaining({ event: 'RESPUESTA_PUBLICADA', autorId: 'actor', share: expect.objectContaining({ destinatario: null }) }));
 });
 it('shows the ledger only to staff with access to the dossier', async () => {
  m.inspection.mockResolvedValue({ id: 'case', eventos: [{ id: 'pres', tipo: 'ACTA_PRESENTACION_RECIBIDA' }, { id: 'x', tipo: 'ACTA_FIRMADA' }] }); m.access.mockReturnValue(false);
  const denied = vi.fn(); await listActMails(request(), response(), denied); expect(denied).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 })); expect(mail.list).not.toHaveBeenCalled();
  m.access.mockReturnValue(true); mail.list.mockResolvedValue([]); mail.state.mockReturnValue({ ready: false, reason: 'EMAIL_DISABLED' });
  const res = response(), next = vi.fn(); await listActMails(request(), res, next);
  expect(mail.list).toHaveBeenCalledWith(['pres']); expect(res.json.mock.calls[0][0].data).toEqual({ envioHabilitado: false, motivo: 'EMAIL_DISABLED', correos: [] });
 });
});
