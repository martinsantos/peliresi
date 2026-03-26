import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/sitrep-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const actorId = (req as AuthRequest).params.id;
        // Determine actor type from route path
        const isOperador = (req as AuthRequest).originalUrl?.includes('/operadores/');
        const actorType = isOperador ? 'operadores' : 'generadores';
        const dir = path.join(UPLOADS_DIR, actorType, actorId);
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext);
    }
});

export const upload = multer({
    storage,
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

        const documento = await prisma.documento.create({
            data: {
                ...(isOperador ? { operadorId: id } : { generadorId: id }),
                tipo,
                nombre: file.originalname,
                path: file.path,
                mimeType: file.mimetype,
                size: file.size,
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
        res.json({ success: true, data: { documentos } });
    } catch (error) {
        next(error);
    }
};

export const downloadDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { docId } = req.params;
        const doc = await prisma.documento.findUnique({ where: { id: docId } });
        if (!doc) throw new AppError('Documento no encontrado', 404);

        if (!fs.existsSync(doc.path)) {
            throw new AppError('Archivo no encontrado en disco', 404);
        }

        res.setHeader('Content-Disposition', `attachment; filename="${doc.nombre}"`);
        res.setHeader('Content-Type', doc.mimeType);
        fs.createReadStream(doc.path).pipe(res);
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

        const documento = await prisma.documento.update({
            where: { id: docId },
            data: {
                estado,
                observaciones,
                revisadoPor: req.user!.id,
                revisadoAt: new Date()
            }
        });

        res.json({ success: true, data: { documento } });
    } catch (error) {
        next(error);
    }
};

export const deleteDocumento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { docId } = req.params;
        const doc = await prisma.documento.findUnique({ where: { id: docId } });
        if (!doc) throw new AppError('Documento no encontrado', 404);

        // Delete file from disk
        if (fs.existsSync(doc.path)) {
            fs.unlinkSync(doc.path);
        }

        await prisma.documento.delete({ where: { id: docId } });
        res.json({ success: true, message: 'Documento eliminado' });
    } catch (error) {
        next(error);
    }
};
