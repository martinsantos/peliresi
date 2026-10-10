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

export type ReceiptAnalysis = {
  version: 1;
  duplicado: boolean;
  lectura: 'LEIDO' | 'SIN_TEXTO' | 'NO_DISPONIBLE';
  motor: 'PDF_TEXT' | 'TESSERACT' | null;
  texto: string;
  alcance: string;
  aviso: string | null;
};

/** Retrying extraction must not lose a successful read or a duplicate warning. */
export function mergeReceiptRead(previous: unknown, next: ReceiptAnalysis): ReceiptAnalysis {
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) return next;
  const old = previous as Partial<ReceiptAnalysis>;
  if (old.version !== 1) return next;
  const duplicado = next.duplicado || old.duplicado === true;
  if (old.lectura === 'LEIDO' && typeof old.texto === 'string' && old.texto.trim()) {
    return { version: 1, duplicado, lectura: 'LEIDO', texto: old.texto,
      motor: old.motor === 'PDF_TEXT' || old.motor === 'TESSERACT' ? old.motor : null,
      alcance: typeof old.alcance === 'string' ? old.alcance : next.alcance, aviso: null };
  }
  return { ...next, duplicado };
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

function runLocked(command: string, args: string[], deadline: number): Promise<string> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new Error('OCR_DEADLINE'));
  // flock shares ONE native analysis slot across the two PM2 workers. No shell,
  // user-defined command, network provider, or unbounded wait is involved.
  return new Promise((resolve, reject) => {
    execFile('flock', ['-F', '-n', '-E', '75', path.join(os.tmpdir(), 'sitrep-receipt-ocr.lock'), command, ...args], {
      timeout: remaining, maxBuffer: MAX_TEXT_BYTES, encoding: 'utf8',
      // --no-fork keeps the engine on the tracked PID, so a timeout kills it
      // rather than leaving a detached OCR process consuming resources.
      env: { PATH: process.env.PATH, LANG: process.env.LANG, OMP_THREAD_LIMIT: '1' },
    }, (error, stdout) => error ? reject(error) : resolve(stdout));
  });
}

function readable(text: string): string {
  return text.replace(/[^\P{C}\n\t]/gu, '').trim().slice(0, 48_000);
}

/** Bounded, free server-side extraction. Scanned PDFs explicitly cover page 1. */
export async function readReceipt(file: { path: string; mimeType: string }, profile?: 'LICENCIA'): Promise<ReceiptAnalysis> {
  const result: ReceiptAnalysis = { version: 1, duplicado: false, lectura: 'SIN_TEXTO', motor: null,
    texto: '', alcance: file.mimeType === 'application/pdf' ? 'Hasta las primeras 3 páginas con texto; página 1 si es escaneado.' : 'Imagen adjunta.', aviso: null };
  if (receiptInFlight) return { ...result, lectura: 'NO_DISPONIBLE', aviso: 'La lectura automática está ocupada. El archivo se conserva para revisión manual.' };
  receiptInFlight = true;
  const deadline = Date.now() + MAX_ANALYSIS_MS;
  let temporary: string | undefined;
  try {
    if (file.mimeType === 'application/pdf') {
      const text = readable(await runLocked('pdftotext', ['-f', '1', '-l', '3', '-layout', file.path, '-'], deadline));
      const proposed = profile === 'LICENCIA' ? mergeLicenseText([text]) : text;
      if (/[\p{L}\p{N}]/u.test(proposed)) return { ...result, lectura: 'LEIDO', motor: 'PDF_TEXT', texto: proposed };
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
      // Only one extra pass, with the SAME overall deadline and cross-worker
      // engine slot. Blue provincial backgrounds need local shadow compensation.
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
        } catch (error) {
          if (!Object.keys(first).length) throw error;
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
    const text = readable(await runLocked('tesseract', [image, 'stdout', '-l', 'spa', '--psm', '3'], deadline));
    return { ...result, lectura: /[\p{L}\p{N}]/u.test(text) ? 'LEIDO' : 'SIN_TEXTO', motor: 'TESSERACT', texto: text };
  } catch (error) {
    // A busy/missing/failed OCR never means success and never discards the file.
    const busy = (error as { code?: number })?.code === 75;
    return { ...result, lectura: 'NO_DISPONIBLE', aviso: busy
      ? 'La lectura automática está ocupada. El archivo se conserva para revisión manual.'
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
