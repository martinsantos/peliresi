import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { config } from '../config/config';
import { canAccessActor, isActorTypeAdmin, isRootAdmin, isUnsafePathSegment } from '../utils/authorization';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/sitrep-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];
const execFileAsync = promisify(execFile);

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function safeResolve(...segments: string[]) {
    const resolved = path.resolve(...segments);
    const root = path.resolve(UPLOADS_DIR);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        throw new AppError('Ruta de archivo invalida', 400);
    }
    return resolved;
}

function detectMime(buffer: Buffer): { mimeType: string; ext: string } | null {
    if (buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF') {
        return { mimeType: 'application/pdf', ext: '.pdf' };
    }
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return { mimeType: 'image/png', ext: '.png' };
    }
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
        return { mimeType: 'image/jpeg', ext: '.jpg' };
    }
    return null;
}

function safeOriginalName(name: string): string {
    return path.basename(name).replace(/[\r\n"]/g, '_').slice(0, 180) || 'documento';
}

async function scanFileIfRequired(filePath: string) {
    if (config.FILE_SCAN_MODE !== 'required') return;
    const [cmd, ...args] = config.CLAMAV_SCAN_CMD.split(/\s+/).filter(Boolean);
    if (!cmd) throw new AppError('Escaneo antivirus no configurado', 500);
    try {
        await execFileAsync(cmd, [...args, filePath], { timeout: 30000 });
    } catch {
        throw new AppError('El archivo no supero el escaneo antivirus', 400);
    }
}

async function persistValidatedUpload(file: Express.Multer.File, actorType: 'generadores' | 'operadores', actorId: string) {
    if (isUnsafePathSegment(actorId)) throw new AppError('Identificador de actor invalido', 400);
    if (!file.buffer || file.buffer.length === 0) throw new AppError('Archivo vacio', 400);

    const detected = detectMime(file.buffer);
    if (!detected || !ALLOWED_MIMES.includes(detected.mimeType)) {
        throw new AppError('Tipo de archivo no permitido. Solo PDF, JPG, PNG.', 400);
    }

    const dir = safeResolve(UPLOADS_DIR, actorType, actorId);
    ensureDir(dir);
    const tempDir = safeResolve(UPLOADS_DIR, '.tmp');
    ensureDir(tempDir);

    const id = crypto.randomUUID();
    const tempPath = safeResolve(tempDir, `${id}.upload`);
    const finalPath = safeResolve(dir, `${id}${detected.ext}`);

    await fs.promises.writeFile(tempPath, file.buffer, { mode: 0o600 });
    try {
        await scanFileIfRequired(tempPath);
        await fs.promises.rename(tempPath, finalPath);
    } catch (error) {
        await fs.promises.rm(tempPath, { force: true });
        throw error;
    }

    return { path: finalPath, mimeType: detected.mimeType, size: file.buffer.length };
}

export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            const err: Error = new AppError('Tipo de archivo no permitido. Solo PDF, JPG, PNG.', 400);
            cb(err);
        }
    }
});

export const uploadDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const file = req.file;
        if (!file) throw new AppError('No se recibio ningun archivo', 400);

        const { tipo, anio, observaciones } = req.body;
        if (!tipo) throw new AppError('El tipo de documento es obligatorio', 400);

        // Determine actor type from route
        const isOperador = req.originalUrl?.includes('/operadores/');

        if (isOperador) {
            const operador = await prisma.operador.findUnique({ where: { id } });
            if (!operador) throw new AppError('Operador no encontrado', 404);
        } else {
            const generador = await prisma.generador.findUnique({ where: { id } });
            if (!generador) throw new AppError('Generador no encontrado', 404);
        }

        const stored = await persistValidatedUpload(file, isOperador ? 'operadores' : 'generadores', id);

        const documento = await prisma.documento.create({
            data: {
                ...(isOperador ? { operadorId: id } : { generadorId: id }),
                tipo,
                nombre: safeOriginalName(file.originalname),
                path: stored.path,
                mimeType: stored.mimeType,
                size: stored.size,
                anio: anio ? Number(anio) : undefined,
                observaciones,
                subidoPor: req.user!.id
            }
        });

        res.status(201).json({ success: true, data: { documento } });
    } catch (error) {
        next(error);
    }
};

export const getDocumentos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const isOperador = req.originalUrl?.includes('/operadores/');

        const documentos = await prisma.documento.findMany({
            where: isOperador ? { operadorId: id } : { generadorId: id },
            orderBy: { createdAt: 'desc' }
        });
        // Never return the persisted filesystem path. Legacy rows remain
        // downloadable only through the authenticated endpoint below.
        res.json({ success: true, data: { documentos: documentos.map(({ path: _path, ...documento }) => documento) } });
    } catch (error) {
        next(error);
    }
};

export const downloadDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { docId } = req.params;
    const doc = await prisma.documento.findUnique({ where: { id: docId }, select: { id: true, generadorId: true, operadorId: true, nombre: true, path: true, mimeType: true } });
    if (!doc) throw new AppError('Documento no encontrado', 404);

    const actorType = doc.generadorId ? 'generador' : doc.operadorId ? 'operador' : null;
    const actorId = doc.generadorId || doc.operadorId;
    if (!actorType || !actorId || !canAccessActor(req.user, actorType, actorId, 'read')) {
      throw new AppError('No tiene permisos sobre este documento', 403);
    }

        const safePath = safeResolve(doc.path);
        if (!fs.existsSync(safePath)) {
            throw new AppError('Archivo no encontrado en disco', 404);
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.nombre)}"`);
        res.setHeader('Content-Type', doc.mimeType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, no-store');
        fs.createReadStream(safePath).pipe(res);
    } catch (error) {
        next(error);
    }
};

export const revisarDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { docId } = req.params;
        const { estado, observaciones } = req.body;

        if (!estado || !['APROBADO', 'RECHAZADO'].includes(estado)) {
            throw new AppError('Estado debe ser APROBADO o RECHAZADO', 400);
        }

        const documento = await prisma.documento.findUnique({ where: { id: docId }, select: { id: true, generadorId: true, operadorId: true } });
        if (!documento) throw new AppError('Documento no encontrado', 404);
        const actorType = documento.generadorId ? 'generador' : documento.operadorId ? 'operador' : null;
        const actorId = documento.generadorId || documento.operadorId;
        if (!actorType || !actorId || !isRootAdmin(req.user) && !isActorTypeAdmin(req.user, actorType)) {
            throw new AppError('No tiene permisos para revisar este documento', 403);
        }

        const updated = await prisma.documento.update({
            where: { id: documento.id },
            data: {
                estado,
                observaciones,
                revisadoPor: req.user!.id,
                revisadoAt: new Date()
            }
        });

        res.json({ success: true, data: { documento: updated } });
    } catch (error) {
        next(error);
    }
};

export const deleteDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { docId } = req.params;
        const doc = await prisma.documento.findUnique({ where: { id: docId } });
        if (!doc) throw new AppError('Documento no encontrado', 404);
        const actorType = doc.generadorId ? 'generador' : doc.operadorId ? 'operador' : null;
        const actorId = doc.generadorId || doc.operadorId;
        if (!actorType || !actorId || !canAccessActor(req.user, actorType, actorId, 'write')) {
            throw new AppError('No tiene permisos sobre este documento', 403);
        }

        // Delete file from disk
        const safePath = safeResolve(doc.path);
        if (fs.existsSync(safePath)) {
            fs.unlinkSync(safePath);
        }

        await prisma.documento.delete({ where: { id: docId } });
        res.json({ success: true, message: 'Documento eliminado' });
    } catch (error) {
        next(error);
    }
};
