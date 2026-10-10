import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ read: vi.fn(), exec: vi.fn(), image: vi.fn(), toFile: vi.fn(), toBuffer: vi.fn() }));
vi.mock('node:fs', () => ({ default: { readFileSync: mock.read } }));
vi.mock('node:child_process', () => ({ execFile: mock.exec }));
vi.mock('sharp', () => ({ default: mock.image }));
import { describeDocument, readReceipt, receiptDuplicate, retainReceiptDigest, receiptNotice } from '../../services/documentAnalysis.service';

beforeEach(() => {
  vi.clearAllMocks();
  const pipeline = { rotate: vi.fn().mockReturnThis(), resize: vi.fn().mockReturnThis(), grayscale: vi.fn().mockReturnThis(),
    flatten: vi.fn().mockReturnThis(), toColourspace: vi.fn().mockReturnThis(), extractChannel: vi.fn().mockReturnThis(),
    median: vi.fn().mockReturnThis(), raw: vi.fn().mockReturnThis(), png: vi.fn().mockReturnThis(), toFile: mock.toFile, toBuffer: mock.toBuffer };
  mock.image.mockReturnValue(pipeline); mock.toFile.mockResolvedValue(undefined);
  mock.toBuffer.mockResolvedValue({ data: Buffer.from([255]), info: { width: 1, height: 1, channels: 1 } });
  mock.exec.mockImplementation((_command, _args, _options, callback) => callback(null, 'RECIBO QA 2026 pago para revisar', ''));
});

describe('document bytes are evidence, not a filename or a payment decision', () => {
  it.each([
    ['application/pdf', Buffer.from('%PDF-1.4\nQA')],
    ['image/jpeg', Buffer.from([255, 216, 255, 224, 0, 1])],
    ['image/png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  ])('fingerprints actual %s bytes without rewriting them', (mimetype, bytes) => {
    mock.read.mockReturnValue(bytes);
    expect(describeDocument({ path: '/virtual/renamed', mimetype })).toEqual({ mimeType: mimetype, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    expect(bytes).toEqual(mock.read.mock.results[0].value);
  });
  it.each([Buffer.alloc(0), Buffer.from('<html>not a document</html>'), Buffer.alloc(10 * 1024 * 1024 + 1)])('rejects empty, disguised and oversized content', bytes => {
    mock.read.mockReturnValue(bytes);
    expect(() => describeDocument({ path: '/virtual/file', mimetype: 'application/pdf' })).toThrowError();
  });
});

describe('free OCR has bounded resources and reports real states', () => {
  it('uses extracted PDF text without running an OCR image or a network provider', async () => {
    const result = await readReceipt({ path: '/virtual/original.pdf', mimeType: 'application/pdf' });
    expect(result).toMatchObject({ lectura: 'LEIDO', motor: 'PDF_TEXT', duplicado: false, texto: 'RECIBO QA 2026 pago para revisar' });
    expect(mock.exec).toHaveBeenCalledTimes(1); expect(mock.image).not.toHaveBeenCalled();
    const [command, args, options] = mock.exec.mock.calls[0];
    expect(command).toBe('flock'); expect(args).toEqual(expect.arrayContaining(['-n', 'pdftotext', '-f', '1', '-l', '3', '/virtual/original.pdf', '-']));
    expect(args[0]).toBe('-F'); expect(options.env.DATABASE_URL).toBeUndefined(); expect(options.env.JWT_SECRET).toBeUndefined();
    expect(options.timeout).toBeLessThanOrEqual(15000); expect(options.maxBuffer).toBe(96 * 1024); expect(options.env.OMP_THREAD_LIMIT).toBe('1');
  });
  it('reads an image in Spanish with a bounded raster and no shell', async () => {
    const result = await readReceipt({ path: '/virtual/original.jpg', mimeType: 'image/jpeg' });
    expect(result).toMatchObject({ lectura: 'LEIDO', motor: 'TESSERACT' });
    expect(mock.image).toHaveBeenCalledWith('/virtual/original.jpg', { limitInputPixels: 16_000_000 });
    expect(mock.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['tesseract', 'stdout', '-l', 'spa']));
    expect(mock.exec.mock.calls[0][2].shell).toBeUndefined();
  });
  it('explicitly limits a scanned PDF to the first page', async () => {
    mock.exec.mockImplementation((_command, args, _options, callback) => callback(null, args.includes('tesseract') ? 'RECIBO ESCANEADO QA' : '', ''));
    const result = await readReceipt({ path: '/virtual/scan.pdf', mimeType: 'application/pdf' });
    expect(result).toMatchObject({ lectura: 'LEIDO', motor: 'TESSERACT', texto: 'RECIBO ESCANEADO QA' });
    expect(mock.exec).toHaveBeenCalledTimes(3);
    expect(mock.exec.mock.calls[1][1]).toEqual(expect.arrayContaining(['pdftoppm', '-f', '1', '-l', '1', '-scale-to', '1800', '-singlefile']));
  });
  it('does not turn missing engines, timeout or unreadable documents into success', async () => {
    mock.exec.mockImplementation((_command, _args, _options, callback) => callback(new Error('Engine unavailable'), '', ''));
    expect(await readReceipt({ path: '/virtual/receipt.pdf', mimeType: 'application/pdf' })).toMatchObject({ lectura: 'NO_DISPONIBLE', texto: '', motor: null, duplicado: false });
  });
  it('limits same-worker concurrency instead of starting another raster/engine', async () => {
    let done: ((error: null, text: string, stderr: string) => void) | undefined;
    mock.exec.mockImplementation((_command, _args, _options, callback) => { done = callback; });
    const first = readReceipt({ path: '/virtual/one.pdf', mimeType: 'application/pdf' });
    expect(await readReceipt({ path: '/virtual/two.pdf', mimeType: 'application/pdf' })).toMatchObject({ lectura: 'NO_DISPONIBLE', texto: '' });
    expect(mock.exec).toHaveBeenCalledTimes(1); done!(null, 'RECIBO QA', '');
    expect((await first).lectura).toBe('LEIDO');
  });
});

function nativeLicenseTsv(text: string) {
  return ['level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext',
    ...text.split('\n').flatMap((line, index) => line.split(' ').map((word, wordIndex) =>
      ['5', '1', '1', '1', String(index + 1), String(wordIndex + 1), '0', '0', '10', '10', '95', word].join('\t')))].join('\n');
}

describe('license profile is offline, bounded and isolated from payment OCR', () => {
  it('preserves the established Spanish page reader and skips enhanced fallback when identity fields are already readable', async () => {
    mock.exec.mockImplementation((_command, _args, _options, callback) => callback(null, nativeLicenseTsv('APELLIDO: QA\nNOMBRE: ANA\nDNI: 90012345\nVENCIMIENTO: 31/12/2027'), ''));
    const result = await readReceipt({ path: '/virtual/license.png', mimeType: 'image/png' }, 'LICENCIA');
    expect(result).toMatchObject({ lectura: 'LEIDO', motor: 'TESSERACT', texto: expect.stringContaining('DNI: 90012345') });
    expect(mock.exec).toHaveBeenCalledTimes(1); expect(mock.toBuffer).not.toHaveBeenCalled();
    expect(mock.exec.mock.calls[0][1]).toEqual(expect.arrayContaining(['--psm', '3', 'tessedit_create_tsv=1']));
    expect(mock.exec.mock.calls[0][1]).not.toContain('--tessdata-dir');
    expect(result.alcance).toContain('no acredita identidad ni vigencia');
  });
  it('tries exactly one shadow-compensated pass, preserves the first read, and does not invent expiry/license number', async () => {
    let pass = 0;
    mock.exec.mockImplementation((_command, _args, _options, callback) => callback(null, nativeLicenseTsv(++pass === 1 ? 'D.U. 90012345' : 'D.U. 90012345\nPEREZ, ANA QA\nDOCUMENTO, APELLIDO Y NOMBRE\nN° DE SELLO 98765432'), ''));
    const result = await readReceipt({ path: '/virtual/license.jpg', mimeType: 'image/jpeg' }, 'LICENCIA');
    expect(result).toMatchObject({ lectura: 'LEIDO', texto: 'APELLIDO: PEREZ\nNOMBRE: ANA QA\nDNI: 90012345' });
    expect(mock.exec).toHaveBeenCalledTimes(2); expect(mock.toBuffer).toHaveBeenCalledTimes(1);
    expect(mock.exec.mock.calls[0][1]).not.toContain('--tessdata-dir');
    expect(mock.exec.mock.calls[1][1]).toEqual(expect.arrayContaining(['--oem', '1', '--tessdata-dir', '--psm', '6', 'tessedit_create_tsv=1']));
    expect(mock.exec.mock.calls[1][2].timeout).toBeLessThanOrEqual(mock.exec.mock.calls[0][2].timeout);
  });
  it('reports no usable fields from a reverse/noise instead of presenting garbage as success', async () => {
    mock.exec.mockImplementation((_command, _args, _options, callback) => callback(null, nativeLicenseTsv('MINISTERIO DE SEGURIDAD\nGRUPO SANGUINEO O+\nN° DE CONTROL 98765432'), ''));
    expect(await readReceipt({ path: '/virtual/reverse.jpg', mimeType: 'image/jpeg' }, 'LICENCIA')).toMatchObject({ lectura: 'SIN_TEXTO', texto: '', motor: 'TESSERACT' });
    expect(mock.exec).toHaveBeenCalledTimes(2);
  });
  it('retains safe partial fields when the second native pass fails, without claiming a complete read', async () => {
    let pass = 0;
    mock.exec.mockImplementation((_command, _args, _options, callback) => ++pass === 1
      ? callback(null, nativeLicenseTsv('DNI: 90012345'), '') : callback(new Error('Deadline'), '', ''));
    expect(await readReceipt({ path: '/virtual/license.jpg', mimeType: 'image/jpeg' }, 'LICENCIA'))
      .toMatchObject({ lectura: 'LEIDO', texto: 'DNI: 90012345', aviso: expect.stringContaining('Lectura parcial') });
  });
  it('preserves cross-worker busy status and starts no extra pass', async () => {
    mock.exec.mockImplementation((_command, _args, _options, callback) => callback(Object.assign(new Error('busy'), { code: 75 }), '', ''));
    expect(await readReceipt({ path: '/virtual/license.jpg', mimeType: 'image/jpeg' }, 'LICENCIA'))
      .toMatchObject({ lectura: 'NO_DISPONIBLE', texto: '', aviso: expect.stringContaining('ocupada') });
    expect(mock.exec).toHaveBeenCalledTimes(1);
  });
  it('keeps only labelled fields from a text PDF and never stores reverse medical/contact text in proposals', async () => {
    mock.exec.mockImplementation((_command, _args, _options, callback) => callback(null, 'DNI: 90012345\nGRUPO SANGUINEO O+\nDOMICILIO QA 123', ''));
    expect(await readReceipt({ path: '/virtual/license.pdf', mimeType: 'application/pdf' }, 'LICENCIA'))
      .toMatchObject({ lectura: 'LEIDO', motor: 'PDF_TEXT', texto: 'DNI: 90012345' });
    expect(mock.image).not.toHaveBeenCalled();
  });
});

describe('receipt reuse is serialized, persistent and private', () => {
  const tx = () => ({ $queryRaw: vi.fn().mockResolvedValue([]), documento: { findFirst: vi.fn().mockResolvedValue(null) },
    documentoSolicitud: { findFirst: vi.fn().mockResolvedValue(null) }, huellaRecibo: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() }, notificacion: { create: vi.fn() } });
  it.each(['documento', 'documentoSolicitud', 'huellaRecibo'] as const)('detects repeated content in %s, including replaced/deleted attachments', async source => {
    const db = tx();
    if (source === 'huellaRecibo') db.huellaRecibo.findUnique.mockResolvedValue({ documentoId: 'old-file' } as never);
    else db[source].findFirst.mockResolvedValue({ id: 'old-file' } as never);
    expect(await receiptDuplicate(db as never, 'a'.repeat(64))).toBe(true);
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.documento.findFirst.mock.invocationCallOrder[0]);
  });
  it('does not flag the acknowledgement of its own unchanged attachment', async () => {
    const db = tx(); db.huellaRecibo.findUnique.mockResolvedValue({ documentoId: 'same-file' } as never);
    expect(await receiptDuplicate(db as never, 'a'.repeat(64), 'same-file')).toBe(false);
  });
  it('retains the first digest without rewriting its original reference', async () => {
    const db = tx(); await retainReceiptDigest(db as never, 'a'.repeat(64), 'file', 'SOLICITUD');
    expect(db.huellaRecibo.upsert).toHaveBeenCalledWith({ where: { sha256: 'a'.repeat(64) }, create: { sha256: 'a'.repeat(64), documentoId: 'file', origen: 'SOLICITUD' }, update: {} });
  });
  it('creates only an internal owner notice and never identifies another actor', async () => {
    const db = tx(); await receiptNotice(db as never, 'owner', { solicitudId: 'own-draft' });
    expect(db.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ usuarioId: 'owner', tipo: 'ALERTA_SISTEMA', prioridad: 'ALTA' }) });
    expect(JSON.parse(db.notificacion.create.mock.calls[0][0].data.datos)).toEqual({ tipo: 'comprobante_repetido', solicitudId: 'own-draft', ruta: '/mi-solicitud' });
  });
  it('returns an actor receipt notice to their own profile, not a restricted admin ficha', async () => {
    const db = tx(); await receiptNotice(db as never, 'owner', { actorTipo: 'transportista', actorId: 'own-actor' });
    expect(JSON.parse(db.notificacion.create.mock.calls[0][0].data.datos)).toMatchObject({ ruta: '/mi-perfil', actorId: 'own-actor' });
  });
});
