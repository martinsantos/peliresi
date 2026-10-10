import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ find: vi.fn(), lock: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { solicitudInscripcion: { findUnique: mock.find }, $transaction: mock.transaction } }));
vi.mock('../../utils/logger', () => ({ default: { error: vi.fn(), warn: vi.fn() } }));
vi.mock('../../services/email.service', () => ({ emailService: { sendEmailVerification: vi.fn() } }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: vi.fn() }));
import { editarDatosRevision } from '../../controllers/solicitud.controller';
const revision = '2026-10-10T10:00:00.000Z';
const original = { id: 'qa', tipoActor: 'TRANSPORTISTA', usuarioId: 'owner', estado: 'EN_REVISION', updatedAt: new Date(revision), usuario: { cuit: '30-70987654-3' }, datosActor: JSON.stringify({ razonSocial: 'QA', cuit: '30-70987654-3', legacy: { preserved: true } }) };
beforeEach(() => {
  vi.clearAllMocks(); mock.find.mockResolvedValue(original);
  mock.update.mockImplementation(async ({ data }) => ({ ...original, ...data }));
  mock.transaction.mockImplementation(fn => fn({ $queryRaw: mock.lock, solicitudInscripcion: { findUnique: mock.find, update: mock.update }, auditoria: { create: mock.audit } }));
});
async function edit(rol = 'ADMIN', body: object = { datosActor: { domicilio: 'QA corregido' }, expectedUpdatedAt: revision }) {
  const res = { json: vi.fn() }, next = vi.fn();
  await editarDatosRevision({ params: { id: 'qa' }, user: { id: 'admin', rol }, body, headers: {} } as never, res as never, next);
  return { error: next.mock.calls[0]?.[0], res };
}
describe('administration corrects declarations with identity, revision and audit protected', () => {
  it('merges corrected fields, preserving original structured data and recording before/after in the transaction', async () => {
    expect((await edit()).error).toBeUndefined();
    expect(JSON.parse(mock.update.mock.calls[0][0].data.datosActor)).toMatchObject({ domicilio: 'QA corregido', cuit: '30-70987654-3', legacy: { preserved: true } });
    expect(mock.audit).toHaveBeenCalledOnce(); expect(mock.audit.mock.calls[0][0].data).toMatchObject({ modulo: 'SOLICITUD', accion: 'UPDATE', usuarioId: 'admin' });
  });
  it.each(['GENERADOR', 'INSPECTOR', 'ADMIN_OPERADOR'])('denies unrelated role %s before writes', async role => {
    expect((await edit(role)).error).toMatchObject({ statusCode: 403 }); expect(mock.update).not.toHaveBeenCalled();
  });
  it('refuses an absent or stale revision without overwriting', async () => {
    expect((await edit('ADMIN', { datosActor: {} })).error).toMatchObject({ statusCode: 400 });
    expect((await edit('ADMIN', { datosActor: {}, expectedUpdatedAt: '2026-10-09T10:00:00.000Z' })).error).toMatchObject({ statusCode: 409 });
    expect(mock.update).not.toHaveBeenCalled();
  });
  it('refuses account identity substitution or a terminal application', async () => {
    expect((await edit('ADMIN', { datosActor: { cuit: '30-11111111-1' }, expectedUpdatedAt: revision })).error).toMatchObject({ statusCode: 400 });
    mock.find.mockResolvedValue({ ...original, estado: 'APROBADA' });
    expect((await edit()).error).toMatchObject({ statusCode: 409 }); expect(mock.update).not.toHaveBeenCalled();
  });
});
