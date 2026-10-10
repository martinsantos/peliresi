import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppError } from '../middlewares/errorHandler';
import { describeDocument, readReceipt } from '../services/documentAnalysis.service';
import { licenseFields } from '../domain/licenseReading';

// Volatile single-file read. No Prisma, mail, account, application, payment or
// provider call. Native extraction already has a cross-worker flock and deadline.
export const previewUpload = multer({ storage: multer.diskStorage({
  destination: os.tmpdir(), filename: (_req, _file, done) => done(null, `sitrep-preview-${randomUUID()}`),
}), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 1, parts: 2 },
  fileFilter: (_req, file, done) => ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)
    ? done(null, true) : done(new AppError('Elegí un PDF, JPG o PNG de hasta 10 MB.', 400)) });

export async function previewDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new AppError('Seleccioná un documento para leer.', 400);
    if (!['LICENCIA', 'DOCUMENTO'].includes(req.body.tipo)) throw new AppError('Tipo de lectura no permitido.', 400);
    const description = describeDocument(req.file);
    const analisis = await readReceipt({ path: req.file.path, mimeType: description.mimeType });
    // The same free reader, but do not assert that a trial original was stored.
    if (analisis.lectura !== 'LEIDO') analisis.aviso = 'No se obtuvo una lectura. Podés completar los campos manualmente o reintentar con una imagen más clara.';
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, data: { analisis, campos: req.body.tipo === 'LICENCIA' ? licenseFields(analisis.texto) : {}, persistido: false } });
  } catch (error) { next(error); }
  finally { if (req.file?.path?.startsWith(path.join(os.tmpdir(), 'sitrep-preview-'))) await unlink(req.file.path).catch(() => undefined); }
}
