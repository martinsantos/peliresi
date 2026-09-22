import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AppError } from '../middlewares/errorHandler';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/sitrep-uploads';
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const execFileAsync = promisify(execFile);

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.webm',
};

function detectEvidenceMime(buffer: Buffer): string | null {
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF') return 'application/pdf';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 12
    && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
    && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg';
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav';
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'audio/webm';
  return null;
}

function storageKeyPath(storageKey: string): string {
  if (!storageKey || path.isAbsolute(storageKey)) throw new AppError('Clave de almacenamiento invalida', 400);
  const segments = storageKey.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new AppError('Clave de almacenamiento invalida', 400);
  }
  const root = path.resolve(UPLOADS_DIR);
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new AppError('Ruta de evidencia invalida', 400);
  }
  return resolved;
}

async function scanEvidencePath(filePath: string): Promise<void> {
  if (process.env.FILE_SCAN_MODE !== 'required') return;
  const [command, ...args] = String(process.env.CLAMAV_SCAN_CMD || '').split(/\s+/).filter(Boolean);
  if (!command) throw new AppError('Escaneo antivirus no configurado', 500);
  try {
    await execFileAsync(command, [...args, filePath], { timeout: 30_000 });
  } catch {
    throw new AppError('La evidencia no supero el escaneo antivirus', 400);
  }
}

export interface StoredInspectionEvidence {
  storageKey: string;
  mimeType: string;
  bytes: number;
  sha256: string;
}

export async function persistInspectionEvidence(
  file: Express.Multer.File,
  inspectionId: string,
): Promise<StoredInspectionEvidence> {
  if (!file.buffer?.length) throw new AppError('El archivo de evidencia esta vacio', 400);
  if (file.buffer.length > MAX_EVIDENCE_BYTES) throw new AppError('La evidencia supera el limite de 25 MB', 400);
  if (!/^[a-zA-Z0-9_-]+$/.test(inspectionId)) throw new AppError('Identificador de inspeccion invalido', 400);

  const mimeType = detectEvidenceMime(file.buffer);
  if (!mimeType || !MIME_EXTENSIONS[mimeType]) {
    throw new AppError('Formato no permitido. Use JPG, PNG, WEBP, PDF, MP3, M4A, OGG, WAV o WEBM.', 400);
  }

  const id = crypto.randomUUID();
  const relativeDir = path.posix.join('inspecciones', inspectionId);
  const storageKey = path.posix.join(relativeDir, `${id}${MIME_EXTENSIONS[mimeType]}`);
  const finalPath = storageKeyPath(storageKey);
  const tempKey = path.posix.join('.tmp', `${id}.evidence`);
  const tempPath = storageKeyPath(tempKey);

  await fs.promises.mkdir(path.dirname(finalPath), { recursive: true, mode: 0o700 });
  await fs.promises.mkdir(path.dirname(tempPath), { recursive: true, mode: 0o700 });
  await fs.promises.writeFile(tempPath, file.buffer, { mode: 0o600 });
  try {
    await scanEvidencePath(tempPath);
    await fs.promises.rename(tempPath, finalPath);
    await fs.promises.chmod(finalPath, 0o600);
  } catch (error) {
    await fs.promises.rm(tempPath, { force: true });
    throw error;
  }

  return {
    storageKey,
    mimeType,
    bytes: file.buffer.length,
    sha256: crypto.createHash('sha256').update(file.buffer).digest('hex'),
  };
}

export function resolveInspectionEvidence(storageKey: string): string {
  if (!storageKey.startsWith('inspecciones/')) throw new AppError('Evidencia invalida', 400);
  return storageKeyPath(storageKey);
}

export async function removeInspectionEvidence(storageKey: string): Promise<void> {
  await fs.promises.rm(resolveInspectionEvidence(storageKey), { force: true });
}
