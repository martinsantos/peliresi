import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AppError } from '../middlewares/errorHandler';

const root = path.resolve(process.env.UPLOADS_DIR || '/var/www/sitrep-uploads');
const execFileAsync = promisify(execFile);
export const SUPPORT_FILE_LIMIT = 5 * 1024 * 1024;
export type SupportFile = { nombre: string; mime: string; bytes: number; sha256: string; storageKey: string };
export function resolveSupportFile(key: string): string {
  if (!/^soporte\/[a-f0-9-]{36}\.(png|jpg|webp|pdf)$/.test(key)) throw new AppError('Adjunto inválido', 400);
  return path.join(root, key);
}
export function supportFileType(buffer: Buffer): { mime: string; extension: string } {
  if (buffer.length > SUPPORT_FILE_LIMIT || !buffer.length) throw new AppError('Cada adjunto debe tener entre 1 byte y 5 MB', 400);
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { mime: 'image/png', extension: 'png' };
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return { mime: 'image/jpeg', extension: 'jpg' };
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return { mime: 'image/webp', extension: 'webp' };
  if (buffer.subarray(0, 5).toString() === '%PDF-') return { mime: 'application/pdf', extension: 'pdf' };
  throw new AppError('Adjuntá JPG, PNG, WEBP o PDF. No se permiten archivos ejecutables ni SVG.', 400);
}
export function describeSupportFile(file: Express.Multer.File): Omit<SupportFile, 'storageKey'> {
  const { mime } = supportFileType(file.buffer);
  return { nombre: file.originalname.split(/[\\/]/).pop()!.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 160) || 'adjunto',
    mime, bytes: file.buffer.length, sha256: createHash('sha256').update(file.buffer).digest('hex') };
}
export async function persistSupportFiles(files: Express.Multer.File[]): Promise<SupportFile[]> {
  const stored: SupportFile[] = [];
  try {
    for (const file of files) {
      const meta = describeSupportFile(file);
      const storageKey = 'soporte/' + randomUUID() + '.' + supportFileType(file.buffer).extension;
      const target = resolveSupportFile(storageKey);
      await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
      // Add before writing so a partially written/scanning file is also removed.
      stored.push({ ...meta, storageKey });
      await fs.writeFile(target, file.buffer, { mode: 0o600, flag: 'wx' });
      if (process.env.FILE_SCAN_MODE === 'required') {
        const [command, ...args] = (process.env.CLAMAV_SCAN_CMD || '').split(/\s+/).filter(Boolean);
        if (!command) throw new AppError('Escaneo antivirus no configurado', 503);
        try { await execFileAsync(command, [...args, target], { timeout: 30000 }); }
        catch { throw new AppError('El adjunto no superó el escaneo antivirus', 400); }
      }
    }
    return stored;
  } catch (error) { await discardSupportFiles(stored); throw error; }
}
export async function discardSupportFiles(files: SupportFile[]): Promise<void> {
  await Promise.all(files.map(file => fs.rm(resolveSupportFile(file.storageKey), { force: true })));
}
