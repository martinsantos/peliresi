import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Worker } from 'worker_threads';
import { AppError } from '../middlewares/errorHandler';
import { config } from '../config/config';
import { isUnsafePathSegment } from '../utils/authorization';
import { sha256Buffer } from '../utils/documentNormalization';

const execFileAsync = promisify(execFile);
const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/sitrep-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
let activeValidators = 0;

export async function validateStoredDocument(filePath: string, mime: string): Promise<void> {
  if (activeValidators >= 4) throw new AppError('Validacion documental ocupada. Reintente en unos segundos.', 503);
  activeValidators++;
  try {
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(path.resolve(__dirname, '../workers/documentValidation.worker.js'), {
        workerData: { filePath, mime }, resourceLimits: { maxOldGenerationSizeMb: 128 },
      });
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        void worker.terminate();
        if (ok) resolve();
        else reject(new AppError('Documento corrupto, protegido o excesivo. PDF: hasta 30 paginas; imagen: hasta 25 megapixeles.', 400));
      };
      const timeout = setTimeout(() => finish(false), 15_000);
      worker.once('message', (result) => finish(result?.ok === true));
      worker.once('error', () => finish(false));
      worker.once('exit', () => finish(false));
    });
  } finally { activeValidators--; }
}

export interface StoredDocumentFile {
  path: string;
  storageKey: string;
  mimeType: string;
  size: number;
  sha256: string;
}

function safeResolve(...segments: string[]): string {
  const resolved = path.resolve(...segments);
  const root = path.resolve(UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new AppError('Ruta de archivo invalida', 400);
  }
  return resolved;
}

function detectMime(buffer: Buffer): { mimeType: string; ext: string } | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF') return { mimeType: 'application/pdf', ext: '.pdf' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mimeType: 'image/png', ext: '.png' };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mimeType: 'image/jpeg', ext: '.jpg' };
  return null;
}

export async function scanDocumentPath(filePath: string): Promise<void> {
  if (config.FILE_SCAN_MODE !== 'required') return;
  const [cmd, ...args] = config.CLAMAV_SCAN_CMD.split(/\s+/).filter(Boolean);
  if (!cmd) throw new AppError('Escaneo antivirus no configurado', 500);
  try {
    await execFileAsync(cmd, [...args, filePath], { timeout: 30_000 });
  } catch {
    throw new AppError('El archivo no supero el escaneo antivirus', 400);
  }
}

export function fileMimeFromBytes(buffer: Buffer): string | null {
  return detectMime(buffer)?.mimeType || null;
}

export async function persistDocumentFile(file: Express.Multer.File, ownerSegments: string[]): Promise<StoredDocumentFile> {
  if (!file.buffer || file.buffer.length === 0) throw new AppError('Archivo vacio', 400);
  if (file.buffer.length > MAX_FILE_SIZE) throw new AppError('El archivo supera el limite de 10MB', 400);
  for (const segment of ownerSegments) {
    if (isUnsafePathSegment(segment)) throw new AppError('Identificador de archivo invalido', 400);
  }
  const detected = detectMime(file.buffer);
  if (!detected || !ALLOWED_MIMES.includes(detected.mimeType)) throw new AppError('Tipo de archivo no permitido. Solo PDF, JPG, PNG.', 400);

  const ownerDir = safeResolve(UPLOADS_DIR, ...ownerSegments);
  const tempDir = safeResolve(UPLOADS_DIR, '.tmp');
  fs.mkdirSync(ownerDir, { recursive: true, mode: 0o700 });
  fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
  const id = crypto.randomUUID();
  const storageKey = `${id}${detected.ext}`;
  const tempPath = safeResolve(tempDir, `${id}.upload`);
  const finalPath = safeResolve(ownerDir, storageKey);
  const sha256 = sha256Buffer(file.buffer);
  await fs.promises.writeFile(tempPath, file.buffer, { mode: 0o600 });
  try {
    await scanDocumentPath(tempPath);
    await validateStoredDocument(tempPath, detected.mimeType);
    await fs.promises.rename(tempPath, finalPath);
    await fs.promises.chmod(finalPath, 0o600);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true });
    throw error;
  }
  return { path: finalPath, storageKey, mimeType: detected.mimeType, size: file.buffer.length, sha256 };
}

export function safeStoredPath(filePath: string): string {
  return path.isAbsolute(filePath)
    ? safeResolve(filePath)
    : safeResolve(UPLOADS_DIR, ...filePath.split('/'));
}

/** Resolve a database storageKey (always relative to UPLOADS_DIR). */
export function storageKeyPath(storageKey: string): string {
  if (!storageKey || storageKey.split('/').some((segment) => isUnsafePathSegment(segment))) {
    throw new AppError('Clave de almacenamiento invalida', 400);
  }
  return safeResolve(UPLOADS_DIR, ...storageKey.split('/'));
}
