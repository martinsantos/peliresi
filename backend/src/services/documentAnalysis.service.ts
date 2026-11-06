import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import type { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { licenseFields } from '../domain/licenseReading';
import { adaptiveLicensePixels, confidentLicenseText, mergeLicenseText } from '../domain/licenseOcr';
import type { PaymentIdentity, PaymentProposal } from '../domain/paymentIdentity';
import { electricityReading, type ElectricityReading } from '../domain/electricityReading';

export type ReceiptAnalysis = {
  version: 1;
  duplicado: boolean;
  lectura: 'LEIDO' | 'SIN_TEXTO' | 'NO_DISPONIBLE';
  motor: 'PDF_TEXT' | 'TESSERACT' | null;
  texto: string;
  alcance: string;
  aviso: string | null;
  documentKind?: 'LICENCIA' | 'FACTURA_ELECTRICA' | 'ARCA';
  arca?: { cuit: string | null; razonSocial: string | null };
  electricidad?: ElectricityReading;
  pago?: { propuesta?: PaymentProposal; revision: 'PENDIENTE' | 'CONFIRMADO'; coincidencia: boolean;
    registroId?: string; identidad?: PaymentIdentity; sha256?: string };
};

/** Retrying extraction must not lose a successful read or a duplicate warning. */
export function mergeReceiptRead(previous: unknown, next: ReceiptAnalysis): ReceiptAnalysis {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return next;
  const old = previous as Partial<ReceiptAnalysis>;
  if (old.version !== 1) return next;
  const duplicado = next.duplicado || old.duplicado === true;
  if (old.lectura === 'LEIDO' && typeof old.texto === 'string' && old.texto.trim()) {
    return { ...old, version: 1, duplicado, lectura: 'LEIDO', texto: old.texto,
      motor: old.motor === 'PDF_TEXT' || old.motor === 'TESSERACT' ? old.motor : null,
      alcance: typeof old.alcance === 'string' ? old.alcance : next.alcance, aviso: null };
  }
  return { ...next, duplicado, ...(old.pago?.revision === 'CONFIRMADO' ? { pago: old.pago } : {}) };
}

/* Re-read the same original while preserving earlier evidence and conflicts.
 * The caller verifies the hash inside its transaction. Payment logic is separate.
 */
export function mergeOriginalRead(previous: unknown, next: ReceiptAnalysis): ReceiptAnalysis {
  const candidate = previous && typeof previous === 'object' && !Array.isArray(previous)
    ? previous as Partial<ReceiptAnalysis> : undefined;
  const old = candidate?.version === 1 && candidate.lectura === 'LEIDO'
    && typeof candidate.texto === 'string' && candidate.texto.trim() ? candidate : undefined;
  let reading = candidate?.version === 1 && candidate.duplicado === true
    ? { ...next, duplicado: true } : next;
  if (old) {
    const keepPrevious = (aviso: string): ReceiptAnalysis => ({
      version: 1, duplicado: old.duplicado === true || next.duplicado, lectura: 'LEIDO',
      texto: old.texto!, motor: old.motor === 'PDF_TEXT' || old.motor === 'TESSERACT' ? old.motor : null,
      alcance: typeof old.alcance === 'string' ? old.alcance : next.alcance, aviso,
    });
    if (next.lectura !== 'LEIDO' || !next.texto.trim()) {
      reading = keepPrevious(next.aviso || 'No se obtuvieron nuevos datos. Se conserva la lectura anterior; revisá el original o reintentá.');
    } else {
      const text = [...new Set([old.texto!, next.texto].flatMap(value => value.split(/\r?\n/)).map(line => line.trim()).filter(Boolean))].join('\n');
      // Never omit a competing value to make a reading look complete.
      reading = text.length > 96_000
        ? keepPrevious('La nueva lectura supera el límite de revisión. Se conserva la lectura anterior; revisá el original manualmente.')
        : { ...next, duplicado: old.duplicado === true || next.duplicado, texto: text,
          alcance: old.texto === next.texto ? next.alcance : 'Lecturas conservadas del mismo original. Los valores contradictorios requieren revisión.' };
    }
  }
  if (candidate?.pago?.revision === 'CONFIRMADO') return { ...reading, pago: candidate.pago };
  return reading;
}

export function mergeElectricityRead(previous: unknown, next: ReceiptAnalysis): ReceiptAnalysis {
  const reading = mergeOriginalRead(previous, next);
  return { ...reading, documentKind: 'FACTURA_ELECTRICA', electricidad: electricityReading(reading.texto) };
}

/** Retry the same hash-verified licence without discarding an earlier useful reading. */
export function mergeLicenseRead(previous: unknown, next: ReceiptAnalysis): ReceiptAnalysis & { campos: ReturnType<typeof licenseFields> } {
  const old = previous && typeof previous === 'object' && !Array.isArray(previous) ? previous as Partial<ReceiptAnalysis> : undefined;
  const keep = old?.version === 1 && old.lectura === 'LEIDO' && typeof old.texto === 'string' && old.texto.trim()
    && (next.lectura !== 'LEIDO' || !next.texto.trim());
  const reading = keep ? { ...mergeReceiptRead(old, next), aviso: `${next.aviso || 'No se obtuvieron nuevos datos.'} Se conserva la lectura anterior.` } : next;
  return { ...reading, documentKind: 'LICENCIA', campos: licenseFields(reading.texto) };
}

/** The original file is never normalized, rewritten, or treated as proof of payment. */
export function describeDocument(file: { path: string; mimetype: string }) {
  const bytes = fs.readFileSync(file.path);
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new AppError('El archivo debe tener contenido y no superar 10 MB.', 400);
  const mime = bytes.subarray(0, 5).toString('ascii') === '%PDF-' ? 'application/pdf'
    : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
  if (!mime || mime !== file.mimetype) throw new AppError('El contenido no corresponde a un PDF, JPG o PNG del tipo indicado.', 400);
  return { sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, mimeType: mime };
}

const MAX_TEXT_BYTES = 96 * 1024;
const MAX_ANALYSIS_MS = 15_000;
let receiptInFlight = false;

/** Open the existing shared inode without O_CREAT, which Linux can reject for
 * another owner in a sticky directory even when the file is readable. */
function openReceiptLock(): number {
  const lockPath = path.join(os.tmpdir(), 'sitrep-receipt-ocr.lock');
  // A FIFO at this path must not block the event loop before fstat rejects it.
  const readFlags = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;
  let fd: number;
  try {
    fd = fs.openSync(lockPath, readFlags);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    try {
      fd = fs.openSync(lockPath, readFlags | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o644);
    } catch (createError) {
      if ((createError as NodeJS.ErrnoException).code !== 'EEXIST') throw createError;
      return openExistingReceiptLock(lockPath, readFlags);
    }
    try { fs.fchmodSync(fd, 0o644); }
    catch (permissionError) { fs.closeSync(fd); throw permissionError; }
  }
  return validateReceiptLock(fd);
}

function validateReceiptLock(fd: number): number {
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('OCR_LOCK_INVALID');
    return fd;
  } catch (error) { fs.closeSync(fd); throw error; }
}

function openExistingReceiptLock(lockPath: string, flags: number): number {
  return validateReceiptLock(fs.openSync(lockPath, flags));
}

function runLocked(command: string, args: string[], deadline: number): Promise<string> {
  if (deadline <= Date.now()) return Promise.reject(new Error('OCR_DEADLINE'));
  // Keep the descriptor open until the engine exits: flock opens this same
  // inode through procfs, so old and new workers still share ONE native slot.
  // No shell, user-defined command, network provider or unbounded wait.
  return new Promise((resolve, reject) => {
    let fd: number | undefined;
    const release = () => { if (fd !== undefined) { try { fs.closeSync(fd); } catch { /* already closed */ } fd = undefined; } };
    try {
      fd = openReceiptLock();
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('OCR_DEADLINE');
      execFile('flock', ['-F', '-n', '-E', '75', `/proc/${process.pid}/fd/${fd}`, command, ...args], {
        timeout: remaining, maxBuffer: MAX_TEXT_BYTES, encoding: 'utf8',
        // --no-fork keeps the engine on the tracked PID, so a timeout kills it
        // rather than leaving a detached OCR process consuming resources.
        env: { PATH: process.env.PATH, LANG: process.env.LANG, OMP_THREAD_LIMIT: '1' },
      }, (error, stdout) => { release(); error ? reject(error) : resolve(stdout); });
    } catch (error) { release(); reject(error); }
  });
}

function readable(text: string): string {
  return text.replace(/[^\P{C}\n\t]/gu, '').trim().slice(0, 48_000);
}

/** Bounded, free server-side extraction. Scanned PDFs explicitly cover page 1. */
export async function readReceipt(file: { path: string; mimeType: string }, profile?: 'LICENCIA' | 'FACTURA_ELECTRICA'): Promise<ReceiptAnalysis> {
  const result: ReceiptAnalysis = { version: 1, duplicado: false, lectura: 'SIN_TEXTO', motor: null,
    texto: '', alcance: file.mimeType === 'application/pdf' ? 'Hasta las primeras 3 páginas con texto; página 1 si es escaneado.' : 'Imagen adjunta.', aviso: null };
  if (receiptInFlight) return { ...result, lectura: 'NO_DISPONIBLE', aviso: 'La lectura automática está ocupada. El archivo se conserva para revisión manual.' };
  receiptInFlight = true;
  const deadline = Date.now() + MAX_ANALYSIS_MS;
  let temporary: string | undefined;
  let partialPdfText = '';
  try {
    if (file.mimeType === 'application/pdf') {
      const text = readable(await runLocked('pdftotext', ['-f', '1', '-l', '3', '-layout', file.path, '-'], deadline));
      const proposed = profile === 'LICENCIA' ? mergeLicenseText([text]) : text;
      const electricFields = profile === 'FACTURA_ELECTRICA' ? electricityReading(proposed).campos : undefined;
      if (/[\p{L}\p{N}]/u.test(proposed) && (!electricFields || electricFields.categoriaTarifaria && (electricFields.consumoKwh || electricFields.suministro))) return { ...result, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: proposed };
      if (profile === 'FACTURA_ELECTRICA') partialPdfText = proposed;
      temporary = await mkdtemp(path.join(os.tmpdir(), 'sitrep-receipt-'));
      const output = path.join(temporary, 'page');
      await runLocked('pdftoppm', ['-f', '1', '-l', '1', '-scale-to', '1800', '-png', '-singlefile', file.path, output], deadline);
      file = { path: `${output}.png`, mimeType: 'image/png' };
    }
    // Decode at most 16M pixels and hand a bounded image to Tesseract. A very
    // large/invalid photo remains available for manual review, not an OOM.
    temporary ||= await mkdtemp(path.join(os.tmpdir(), 'sitrep-receipt-'));
    const image = path.join(temporary, 'ocr.png');
    await sharp(file.path, { limitInputPixels: 16_000_000 }).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).grayscale().png().toFile(image);
    if (profile === 'LICENCIA') {
      const enhancedArgs = (raster: string) => [raster, 'stdout', '-l', 'spa', '--oem', '1', '--tessdata-dir',
        path.join(__dirname, '..', 'assets', 'ocr'), '--psm', '6', '-c', 'tessedit_create_tsv=1'];
      // Keep the established model/segmentation for already-readable cards.
      // A more expensive model is not invariably more accurate on every font.
      const reads = [confidentLicenseText(await runLocked('tesseract', [image, 'stdout', '-l', 'spa', '--psm', '3', '-c', 'tessedit_create_tsv=1'], deadline))];
      const first = licenseFields(reads[0]); let warning: string | null = null;
      // Bounded fallback with the SAME overall deadline and cross-worker slot.
      // Blue provincial backgrounds need local shadow compensation.
      if (!first.dni || !first.nombre || !first.apellido) {
        try {
          const raw = await sharp(file.path, { limitInputPixels: 16_000_000 }).rotate()
            .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#fff' }).toColourspace('srgb').extractChannel(2).median(3).raw().toBuffer({ resolveWithObject: true });
          if (raw.info.channels !== 1) throw new Error('INVALID_OCR_RASTER');
          const pixels = adaptiveLicensePixels(raw.data, raw.info.width, raw.info.height);
          const adaptive = path.join(temporary, 'license-adaptive.png');
          await sharp(Buffer.from(pixels), { raw: { width: raw.info.width, height: raw.info.height, channels: 1 } }).png().toFile(adaptive);
          reads.push(confidentLicenseText(await runLocked('tesseract', enhancedArgs(adaptive), deadline)));
          const partial = licenseFields(mergeLicenseText(reads));
          // Old Mendoza cards place identity below a large emblem/photo. Only
          // a confidently labelled DU on a landscape card enables this final
          // region pass. The same label/conflict checks still apply; no guessed
          // names, expiry or number from the reverse, and no extra time budget.
          if (partial.dni && (!partial.nombre || !partial.apellido)
              && reads.some(read => /\bD\.?U\.?\s+\d{6,9}(?:\s|$)/i.test(read))
              && raw.info.width >= 200 && raw.info.height >= 200
              && raw.info.width / raw.info.height >= 1.2 && raw.info.width / raw.info.height <= 2) {
            const region = path.join(temporary, 'license-identity.png');
            await sharp(raw.data, { raw: { width: raw.info.width, height: raw.info.height, channels: 1 } })
              .extract({ left: 0, top: Math.floor(raw.info.height * 0.44), width: Math.floor(raw.info.width * 0.68), height: Math.floor(raw.info.height * 0.35) })
              .normalize().png().toFile(region);
            reads.push(confidentLicenseText(await runLocked('tesseract', enhancedArgs(region), deadline)));
          }
        } catch (error) {
          // Any completed pass may contain safe fields, not only the first.
          // Still merge conflicts before retaining a partial result.
          if (!Object.keys(licenseFields(mergeLicenseText(reads))).length) throw error;
          warning = 'Lectura parcial. Revisá las propuestas y completá manualmente los campos que falten.';
        }
      }
      const text = mergeLicenseText(reads);
      const fields = licenseFields(text);
      if (text && (!fields.dni || !fields.nombre || !fields.apellido || !fields.vencimiento)) {
        warning = 'Lectura parcial. Revisá las propuestas y completá manualmente los campos que falten.';
      }
      return { ...result, lectura: text ? 'LEIDO' : 'SIN_TEXTO', motor: 'TESSERACT', texto: text,
        alcance: 'Sólo campos identificados de la licencia. Requiere revisión; no acredita identidad ni vigencia.', aviso: warning };
    }
    const text = readable([partialPdfText, await runLocked('tesseract', [image, 'stdout', '-l', 'spa', '--psm', '3'], deadline)].filter(Boolean).join('\n'));
    return { ...result, lectura: /[\p{L}\p{N}]/u.test(text) ? 'LEIDO' : 'SIN_TEXTO', motor: 'TESSERACT', texto: text,
      ...(partialPdfText ? { alcance: 'Texto del PDF y OCR de su primera página. Los valores contradictorios requieren revisión.' } : {}) };
  } catch (error) {
    // A busy/missing/failed OCR never means success and never discards the file.
    const failure = error as { code?: number | string; killed?: boolean; message?: string; stderr?: string };
    const busy = failure.code === 75;
    const unavailable = failure.code === 'ENOENT' || failure.code === 127
      || /Error opening data file|Failed loading language|Could not initialize tesseract/i.test(failure.stderr || '');
    const timeout = failure.killed || failure.message === 'OCR_DEADLINE';
    if (partialPdfText) return { ...result, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: partialPdfText,
      aviso: 'Lectura parcial del PDF. El OCR complementario no estuvo disponible; podés reintentar sin reemplazar el original.' };
    return { ...result, lectura: 'NO_DISPONIBLE', aviso: busy
      ? 'La lectura automática está ocupada. El archivo se conserva para revisión manual.'
      : unavailable ? 'El servicio de lectura automática no está disponible en el servidor. No es un problema de tu archivo; se conserva para revisión manual.'
      : timeout ? 'La lectura automática excedió el tiempo disponible. El archivo se conserva; podés reintentar sin volver a adjuntarlo.'
      : 'No se pudo leer automáticamente. El archivo se conserva para revisión manual.' };
  } finally {
    receiptInFlight = false;
    if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Serialize equal digests BEFORE checking both sources, including other accounts. */
export async function receiptDuplicate(tx: Prisma.TransactionClient, sha256: string, excludeSolicitudDocumentId?: string): Promise<boolean> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${sha256}, 0))::text`;
  const [actorFile, registrationFile, historical] = await Promise.all([
    tx.documento.findFirst({ where: { tipo: 'COMPROBANTE_PAGO', sha256 }, select: { id: true } }),
    tx.documentoSolicitud.findFirst({ where: { tipo: 'COMPROBANTE_PAGO', sha256,
      ...(excludeSolicitudDocumentId ? { id: { not: excludeSolicitudDocumentId } } : {}) }, select: { id: true } }),
    tx.huellaRecibo.findUnique({ where: { sha256 }, select: { documentoId: true } }),
  ]);
  return Boolean(actorFile || registrationFile || (historical && historical.documentoId !== excludeSolicitudDocumentId));
}

export async function retainReceiptDigest(tx: Prisma.TransactionClient, sha256: string, documentoId: string, origen: 'ACTOR' | 'SOLICITUD'): Promise<void> {
  await tx.huellaRecibo.upsert({ where: { sha256 }, create: { sha256, documentoId, origen }, update: {} });
}

export async function receiptNotice(tx: Prisma.TransactionClient, usuarioId: string, datos: object): Promise<void> {
  const ruta = 'solicitudId' in datos && typeof datos.solicitudId === 'string' ? '/mi-solicitud' : '/mi-perfil';
  await tx.notificacion.create({ data: { usuarioId, tipo: 'ALERTA_SISTEMA', prioridad: 'ALTA',
    titulo: 'Comprobante repetido', mensaje: 'La huella de este archivo coincide con un comprobante ya cargado. Revisá el documento; no acredita un pago nuevo.',
    datos: JSON.stringify({ tipo: 'comprobante_repetido', ...datos, ruta }) } });
}
