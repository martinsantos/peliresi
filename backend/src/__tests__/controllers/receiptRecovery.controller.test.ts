import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), old: vi.fn(), list: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), transaction: vi.fn(), read: vi.fn(), unlink: vi.fn(), duplicate: vi.fn(), notice: vi.fn() }));
vi.mock('../../lib/prisma', () => ({ default: { solicitudInscripcion: { findUnique: m.find }, documentoSolicitud: { findUnique: m.old }, $transaction: m.transaction } }));
vi.mock('../../utils/logger', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/email.service', () => ({ emailService: {} }));
vi.mock('../../controllers/auth.controller', () => ({ generateTokens: vi.fn() }));
vi.mock('../../services/documentAnalysis.service', async original => ({
  ...await original<typeof import('../../services/documentAnalysis.service')>(),
  describeDocument: () => ({ sha256: 'a'.repeat(64), size: 30, mimeType: 'application/pdf' }),
  readReceipt: m.read, receiptDuplicate: m.duplicate, receiptNotice: m.notice, retainReceiptDigest: vi.fn(),
}));
vi.mock('fs', async original => { const actual = await original<typeof import('fs')>(); return { ...actual, default: { ...actual, existsSync: () => true, unlinkSync: m.unlink } }; });
import { uploadDocumento, analizarDocumentoSolicitud } from '../../controllers/solicitud.controller';
const draft = { id: 'draft', usuarioId: 'owner', estado: 'BORRADOR', tipoActor: 'GENERADOR' };
const complete = { version: 1, duplicado: false, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: 'SELLADO TRIBUTARIO QA', alcance: 'Texto.', aviso: null };
const old = { id: 'old', tipo: 'COMPROBANTE_PAGO', mimeType: 'application/pdf', solicitudId: 'draft', path: '/virtual/old.pdf', sha256: 'a'.repeat(64), estado: 'APROBADO',
  analisis: { ...complete, duplicado: true, lectura: 'NO_DISPONIBLE', texto: '', motor: null } };
beforeEach(() => {
  vi.clearAllMocks(); m.find.mockResolvedValue(draft); m.old.mockResolvedValue(old); m.list.mockResolvedValue([old]); m.read.mockResolvedValue(complete); m.duplicate.mockResolvedValue(false);
  m.update.mockImplementation(async ({ data }) => ({ ...old, ...data }));
  m.transaction.mockImplementation(callback => callback({ $queryRaw: vi.fn(), solicitudInscripcion: { findUnique: m.find },
    documentoSolicitud: { findMany: m.list, findUnique: m.old, findUniqueOrThrow: m.old, update: m.update, create: m.create, deleteMany: m.remove } }));
});
async function invoke(handler = uploadDocumento, user = { id: 'owner', rol: 'GENERADOR', restricted: true }) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
  await handler({ params: { id: 'draft', docId: 'old' }, user, body: { tipo: 'COMPROBANTE_PAGO' }, file: { path: '/virtual/retry.pdf', originalname: 'retry.pdf', mimetype: 'application/pdf', size: 30 } } as never, res as never, next);
  return { error: next.mock.calls[0]?.[0], saved: res.json.mock.calls[0]?.[0]?.data.documento };
}
describe('same receipt retry preserves original, legal state and duplicate warning', () => {
  it('recovers an unavailable read on the same bytes without replacement or a new notice', async () => {
    const { error, saved } = await invoke(); expect(error).toBeUndefined();
    expect(saved.analisis).toMatchObject({ lectura: 'LEIDO', texto: complete.texto, duplicado: true });
    expect(saved).toMatchObject({ id: 'old', estado: 'APROBADO', path: '/virtual/old.pdf' });
    expect(m.create).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled(); expect(m.notice).not.toHaveBeenCalled(); expect(m.unlink).not.toHaveBeenCalledWith('/virtual/old.pdf');
  });
  it('never replaces a successful read with an unavailable retry', async () => {
    m.old.mockResolvedValue({ ...old, analisis: complete }); m.read.mockResolvedValue({ ...complete, lectura: 'NO_DISPONIBLE', texto: '' });
    const { saved } = await invoke(); expect(saved.analisis).toEqual(complete); expect(m.update).not.toHaveBeenCalled();
  });
  it('retries the saved original, even on a submitted request, without legal-state updates', async () => {
    m.find.mockResolvedValue({ ...draft, estado: 'ENVIADA' });
    const { error, saved } = await invoke(analizarDocumentoSolicitud); expect(error).toBeUndefined();
    expect(m.read).toHaveBeenCalledWith({ path: '/virtual/old.pdf', mimeType: 'application/pdf' });
    expect(saved.analisis).toMatchObject({ lectura: 'LEIDO', duplicado: true });
    expect(m.update.mock.calls[0][0].data).toEqual({ sha256: old.sha256, analisis: saved.analisis });
    expect(saved.estado).toBe('APROBADO'); expect(m.create).not.toHaveBeenCalled(); expect(m.unlink).not.toHaveBeenCalled();
  });
  it.each([
    { id: 'foreign', rol: 'GENERADOR', restricted: false },
    { id: 'foreign', rol: 'ADMIN_OPERADOR', restricted: false },
    { id: 'foreign', rol: 'ADMIN', restricted: true },
  ])('denies unauthorized retry before native execution for $rol restricted=$restricted', async user => {
    expect((await invoke(analizarDocumentoSolicitud, user)).error).toMatchObject({ statusCode: 403 });
    expect(m.read).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
  });
  it('permits the responsible sector admin to retry a receipt, not to certify its payment', async () => {
    expect((await invoke(analizarDocumentoSolicitud, { id: 'reviewer', rol: 'ADMIN_GENERADOR', restricted: false })).error).toBeUndefined();
    expect(m.update.mock.calls[0][0].data.estado).toBeUndefined();
  });
  it('rejects a document from another request without exposing or analyzing it', async () => {
    m.old.mockResolvedValue({ ...old, solicitudId: 'other' });
    expect((await invoke(analizarDocumentoSolicitud)).error).toMatchObject({ statusCode: 404 }); expect(m.read).not.toHaveBeenCalled();
  });
  it('rejects changed original bytes instead of replacing their stored fingerprint', async () => {
    m.old.mockResolvedValue({ ...old, sha256: 'b'.repeat(64) });
    expect((await invoke(analizarDocumentoSolicitud)).error).toMatchObject({ statusCode: 409 }); expect(m.read).not.toHaveBeenCalled();
  });
  it('does not overwrite a document replaced while extraction was running', async () => {
    m.old.mockResolvedValueOnce(old).mockResolvedValueOnce({ ...old, path: '/virtual/replaced.pdf' });
    expect((await invoke(analizarDocumentoSolicitud)).error).toMatchObject({ statusCode: 409 }); expect(m.update).not.toHaveBeenCalled();
  });
});

describe('electricity retry can improve a partial read without hiding evidence', () => {
  const partial = { ...complete, texto: 'EDEMSA\nTarifa: T2', aviso: 'Lectura parcial del PDF.' };
  beforeEach(() => { m.old.mockResolvedValue({ ...old, tipo: 'FACTURA_ELECTRICA', analisis: partial }); });
  it('adds consumption recovered by the new pass while retaining the original tariff', async () => {
    m.read.mockResolvedValue({ ...complete, motor: 'TESSERACT', texto: 'Consumo facturado: 1250 kWh' });
    const { error, saved } = await invoke(analizarDocumentoSolicitud);
    expect(error).toBeUndefined();
    expect(saved.analisis.electricidad.campos).toMatchObject({ categoriaTarifaria: 'T2', consumoKwh: '1250' });
    expect(saved.analisis.aviso).toBeNull();
    expect(m.read).toHaveBeenCalledWith({ path: old.path, mimeType: old.mimeType }, 'FACTURA_ELECTRICA');
    expect(m.update.mock.calls[0][0].data.estado).toBeUndefined();
    expect(m.duplicate).not.toHaveBeenCalled(); expect(m.notice).not.toHaveBeenCalled();
  });
  it('keeps conflicting readings explicit rather than choosing the latest tariff', async () => {
    m.read.mockResolvedValue({ ...complete, texto: 'EDEMSA\nTarifa: T1R3\nConsumo: 400 kWh' });
    const { saved } = await invoke(analizarDocumentoSolicitud);
    expect(saved.analisis.electricidad.conflictos).toContain('categoriaTarifaria');
    expect(saved.analisis.electricidad.campos.categoriaTarifaria).toBeUndefined();
    expect(saved.analisis.electricidad.campos.consumoKwh).toBe('400');
  });
  it.each(['NO_DISPONIBLE', 'SIN_TEXTO'])('preserves evidence and explains an unsuccessful %s retry', async lectura => {
    m.read.mockResolvedValue({ ...complete, lectura, texto: '', aviso: 'No se pudo completar la nueva lectura.' });
    const { saved } = await invoke(analizarDocumentoSolicitud);
    expect(saved.analisis.texto).toBe(partial.texto);
    expect(saved.analisis.electricidad.campos.categoriaTarifaria).toBe('T2');
    expect(saved.analisis.aviso).toContain('No se pudo completar');
  });
  it('does not repeat evidence on an identical retry', async () => {
    m.read.mockResolvedValue({ ...partial, aviso: null });
    const { saved } = await invoke(analizarDocumentoSolicitud);
    expect(saved.analisis.electricidad.evidencias.filter((e: { campo: string }) => e.campo === 'categoriaTarifaria')).toHaveLength(1);
    expect(saved.analisis.aviso).toBeNull();
  });
  it('does not grow without bound or silently omit conflicting evidence', async () => {
    m.old.mockResolvedValue({ ...old, tipo: 'FACTURA_ELECTRICA', analisis: { ...partial, texto: 'Tarifa: T2\n' + 'A'.repeat(48000) } });
    m.read.mockResolvedValue({ ...complete, texto: 'Tarifa: T1R3\n' + 'B'.repeat(48000) });
    const { saved } = await invoke(analizarDocumentoSolicitud);
    expect(saved.analisis.texto).not.toContain('T1R3');
    expect(saved.analisis.aviso).toContain('supera el límite');
  });
  it('uses the current transaction evidence when another retry completed first', async () => {
    m.old.mockResolvedValueOnce({ ...old, tipo: 'FACTURA_ELECTRICA', analisis: partial })
      .mockResolvedValueOnce({ ...old, tipo: 'FACTURA_ELECTRICA', analisis: { ...partial, texto: 'Tarifa: T2\nPotencia contratada: 45 kW' } });
    m.read.mockResolvedValue({ ...complete, texto: 'Consumo: 1250 kWh' });
    const { saved } = await invoke(analizarDocumentoSolicitud);
    expect(saved.analisis.electricidad.campos).toMatchObject({ categoriaTarifaria: 'T2', consumoKwh: '1250', potenciaContratadaKw: '45' });
  });
  it('retains previous conflicts when a later pass reads only one competing value', async () => {
    m.old.mockResolvedValue({ ...old, tipo: 'FACTURA_ELECTRICA', analisis: { ...partial, texto: 'Tarifa: T2\nTarifa: T1R3' } });
    m.read.mockResolvedValue({ ...complete, texto: 'Tarifa: T2' });
    const { saved } = await invoke(analizarDocumentoSolicitud);
    expect(saved.analisis.electricidad.conflictos).toContain('categoriaTarifaria');
  });
});
