import { Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest, canReadActorRecord } from '../middlewares/auth.middleware';
import { auditarActor } from '../utils/auditoria';
import { describeDocument, readReceipt, receiptDuplicate, receiptNotice, retainReceiptDigest } from '../services/documentAnalysis.service';
import { scopedUploadRoot } from '../lib/trainingScope';
import { electricityReading } from '../domain/electricityReading';
import { actorPaymentScope, confirmPayment, notePaymentDecision, paymentAnalysis, requirePaymentIdentity, retainPaymentAllocation } from '../services/paymentIdentity.service';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/sitrep-uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

function documentActor(doc: { generadorId?: string | null; operadorId?: string | null; transportistaId?: string | null }) {
    // Missing or ambiguous ownership never opens a document to any account.
    if ([doc.generadorId, doc.operadorId, doc.transportistaId].filter(Boolean).length !== 1) throw new AppError('Documento sin actor válido', 403);
    return doc.transportistaId ? { type: 'transportista' as const, id: doc.transportistaId, adminRole: 'ADMIN_TRANSPORTISTA' } : doc.operadorId
        ? { type: 'operador' as const, id: doc.operadorId, adminRole: 'ADMIN_OPERADOR' }
        : { type: 'generador' as const, id: doc.generadorId!, adminRole: 'ADMIN_GENERADOR' };
}

function assertDocumentWrite(req: AuthRequest, doc: { generadorId?: string | null; operadorId?: string | null; transportistaId?: string | null }) {
    const scope = documentActor(doc);
    if (!req.user || req.user.restricted || !['ADMIN', scope.adminRole].includes(req.user.rol)) {
        throw new AppError('No tiene permisos para modificar este documento', 403);
    }
}

function routeActor(req: AuthRequest) {
    const sector = (req.originalUrl || '').split('?')[0].match(/\/(generadores|operadores|transportistas)\//)?.[1];
    if (!sector) throw new AppError('Tipo de actor inválido', 400);
    return sector === 'operadores' ? 'operador' as const : sector === 'transportistas' ? 'transportista' as const : 'generador' as const;
}

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const actorId = (req as AuthRequest).params.id;
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(actorId)) return cb(new AppError('Identificador de actor inválido', 400), '');
        // Determine actor type from route path
        const actorType = routeActor(req as AuthRequest) === 'operador' ? 'operadores' : routeActor(req as AuthRequest) === 'transportista' ? 'transportistas' : 'generadores';
        const dir = path.join(scopedUploadRoot(UPLOADS_DIR), actorType, actorId);
        ensureDir(dir);
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = randomUUID();
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
    let persisted = false;
    try {
        const { id } = req.params;
        const file = req.file;
        if (!file) throw new AppError('No se recibio ningun archivo', 400);

        const { tipo, anio, observaciones } = req.body;
        if (!tipo) throw new AppError('El tipo de documento es obligatorio', 400);

        // Determine actor type from route
        const actorType = routeActor(req);
        const actor = actorType === 'operador' ? await prisma.operador.findUnique({ where: { id } })
            : actorType === 'transportista' ? await prisma.transportista.findUnique({ where: { id } })
            : await prisma.generador.findUnique({ where: { id } });
        if (!actor) throw new AppError('Actor no encontrado', 404);
        const ownership = actorType === 'operador' ? { operadorId: id } : actorType === 'transportista' ? { transportistaId: id } : { generadorId: id };
        const official = tipo === 'CERTIFICADO_AMBIENTAL';
        if (official) {
            assertDocumentWrite(req, ownership);
            if (!Number.isInteger(Number(anio)) || Number(anio) < 1900 || Number(anio) > 2100) throw new AppError('Indicá el año del certificado', 400);
            if (file.mimetype !== 'application/pdf') throw new AppError('El certificado oficial debe ser un PDF', 400);
        }
        const description = describeDocument(file);
        const electricBill = tipo === 'FACTURA_ELECTRICA' || tipo === 'FACTURA_LUZ';
        const reading = electricBill ? await readReceipt({ path: file.path, mimeType: description.mimeType }, 'FACTURA_ELECTRICA') : tipo === 'COMPROBANTE_PAGO' ? await readReceipt({ path: file.path, mimeType: description.mimeType }) : undefined;
        let analysis = reading && electricBill ? { ...reading, documentKind: 'FACTURA_ELECTRICA' as const, electricidad: electricityReading(reading.texto) } : reading;
        const documento = await prisma.$transaction(async transaction => {
          if (analysis && tipo === 'COMPROBANTE_PAGO') {
            analysis.duplicado = await receiptDuplicate(transaction, description.sha256);
            analysis = await paymentAnalysis(transaction, analysis, actorPaymentScope(actorType, id, anio ? Number(anio) : null));
          }
          const saved = await transaction.documento.create({
            data: {
                ...ownership,
                tipo,
                nombre: file.originalname,
                path: file.path,
                ...description,
                ...(analysis ? { analisis: analysis } : {}),
                anio: anio ? Number(anio) : undefined,
                observaciones,
                subidoPor: req.user!.id,
                ...(official ? { estado: 'APROBADO', revisadoPor: req.user!.id, revisadoAt: new Date() } : {}),
            }
          });
          await auditarActor({ accion: 'UPDATE', modulo: actorType.toUpperCase() as 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA',
            ...ownership, usuarioId: req.user!.id, datosDespues: { documentoId: saved.id, tipo, anio: saved.anio, nombre: saved.nombre, estado: saved.estado }, ip: req.ip, userAgent: req.headers['user-agent'] }, transaction);
          if (analysis && tipo === 'COMPROBANTE_PAGO') await retainReceiptDigest(transaction, description.sha256, saved.id, 'ACTOR');
          if (analysis?.duplicado) await receiptNotice(transaction, actor.usuarioId, { actorTipo: actorType, actorId: id, documentoId: saved.id });
          if (official) await transaction.notificacion.create({ data: {
            usuarioId: actor.usuarioId, tipo: 'INFO_GENERAL',
            titulo: 'Certificado ambiental disponible',
            mensaje: 'DGFA cargó tu certificado oficial. Podés descargarlo desde tu ficha.',
            datos: JSON.stringify({ tipo: 'certificado_ambiental', documentoId: saved.id, actorTipo: actorType, actorId: id }),
          } });
          return saved;
        });

        persisted = true;
        res.status(201).json({ success: true, data: { documento } });
    } catch (error) {
        if (!persisted && req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        next(error);
    }
};

export const confirmarIdentidadPagoActor = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { docId } = req.params;
        const documento = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM documentos WHERE id = ${docId} FOR UPDATE`;
            const doc = await tx.documento.findUnique({ where: { id: docId } });
            if (!doc) throw new AppError('Documento no encontrado', 404);
            assertDocumentWrite(req, doc);
            if (doc.tipo !== 'COMPROBANTE_PAGO' || !doc.sha256 || req.body.expectedSha256 !== doc.sha256) throw new AppError('Revisá el comprobante actual y su huella antes de confirmar.', 409);
            const scope = documentActor(doc);
            const owner = scope.type === 'generador' ? await tx.generador.findUniqueOrThrow({ where: { id: scope.id }, select: { cuit: true } })
                : scope.type === 'operador' ? await tx.operador.findUniqueOrThrow({ where: { id: scope.id }, select: { cuit: true } })
                : await tx.transportista.findUniqueOrThrow({ where: { id: scope.id }, select: { cuit: true } });
            const pago = await confirmPayment(tx, { origen: 'ACTOR', documentoId: docId, ambito: actorPaymentScope(scope.type, scope.id, doc.anio), cuit: owner.cuit, sha256: doc.sha256, historico: doc.estado === 'APROBADO', aplicado: doc.estado === 'APROBADO' }, req.body, req.user!.id);
            const analysis = doc.analisis && typeof doc.analisis === 'object' && !Array.isArray(doc.analisis) ? doc.analisis : {};
            return tx.documento.update({ where: { id: docId }, data: { analisis: { ...analysis, pago } } });
        }, { timeout: 15_000 });
        res.json({ success: true, data: { documento } });
    } catch (error) { next(error); }
};

export const getDocumentos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const actorType = routeActor(req);

        if (!canReadActorRecord(req.user, actorType, id)) {
            throw new AppError('No tiene permisos para consultar estos documentos', 403);
        }

        const documentos = await prisma.documento.findMany({
            where: actorType === 'operador' ? { operadorId: id } : actorType === 'transportista' ? { transportistaId: id } : { generadorId: id },
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

        const scope = documentActor(doc);
        if (!canReadActorRecord(req.user, scope.type, scope.id)) {
            throw new AppError('No tiene permisos para consultar este documento', 403);
        }

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

        const doc = await prisma.documento.findUnique({ where: { id: docId } });
        if (!doc) throw new AppError('Documento no encontrado', 404);
        assertDocumentWrite(req, doc);

        const documento = await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM documentos WHERE id = ${docId} FOR UPDATE`;
            const current = await tx.documento.findUniqueOrThrow({ where: { id: docId } });
            assertDocumentWrite(req, current);
            if (current.tipo === 'COMPROBANTE_PAGO') {
                const scope = documentActor(current);
                const owner = scope.type === 'generador' ? await tx.generador.findUniqueOrThrow({ where: { id: scope.id }, select: { cuit: true } })
                    : scope.type === 'operador' ? await tx.operador.findUniqueOrThrow({ where: { id: scope.id }, select: { cuit: true } })
                    : await tx.transportista.findUniqueOrThrow({ where: { id: scope.id }, select: { cuit: true } });
                const target = { origen: 'ACTOR' as const, documentoId: docId, ambito: actorPaymentScope(scope.type, scope.id, current.anio), cuit: owner.cuit, sha256: current.sha256 || '' };
                if (estado === 'APROBADO') await requirePaymentIdentity(tx, target, current.analisis);
                await notePaymentDecision(tx, target, current.analisis, estado, req.user!.id);
            }
            return tx.documento.update({ where: { id: docId }, data: { estado, observaciones, revisadoPor: req.user!.id, revisadoAt: new Date() } });
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
        assertDocumentWrite(req, doc);
        await prisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT id FROM documentos WHERE id = ${docId} FOR UPDATE`;
            const current = await tx.documento.findUniqueOrThrow({ where: { id: docId } });
            assertDocumentWrite(req, current);
            if (current.tipo === 'COMPROBANTE_PAGO') {
                const scope = documentActor(current);
                await retainPaymentAllocation(tx, current, actorPaymentScope(scope.type, scope.id, current.anio), 'ACTOR', 'RETIRADO', req.user!.id);
            }
            await tx.documento.delete({ where: { id: docId } });
        });

        // Delete file from disk
        if (fs.existsSync(doc.path)) {
            fs.unlinkSync(doc.path);
        }

        res.json({ success: true, message: 'Documento eliminado' });
    } catch (error) {
        next(error);
    }
};
