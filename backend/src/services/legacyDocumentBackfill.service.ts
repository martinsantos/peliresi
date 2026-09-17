import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { config } from '../config/config';
import { fileMimeFromBytes, scanDocumentPath } from './documentStorage.service';
import { sha256Buffer } from '../utils/documentNormalization';
import { AppError } from '../middlewares/errorHandler';

const UPLOADS_DIR = process.env.UPLOADS_DIR || '/var/www/sitrep-uploads';
const legacyPath = (value: string) => {
  const root = path.resolve(process.env.LEGACY_UPLOADS_DIR || UPLOADS_DIR);
  const resolved = path.resolve(value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new AppError('Ruta legacy fuera del almacenamiento autorizado', 400);
  return resolved;
};

const LEGACY_TYPES = new Set(['ATM_COMPROBANTE_SELLADO', 'CONSTANCIA_AFIP', 'HABILITACION_ACTOR', 'SEGURO_AMBIENTAL', 'TARJETA_IDENTIFICACION_VEHICULO', 'AUTORIZACION_USO_VEHICULO', 'LICENCIA_CONDUCIR', 'MEMORIA_TECNICA', 'RESOLUCION_DPA', 'CERTIFICADO_HABILITACION']);

const actorFor = (documento: { generadorId: string | null; operadorId: string | null }) => documento.generadorId
  ? { generadorId: documento.generadorId }
  : documento.operadorId ? { operadorId: documento.operadorId } : null;

/**
 * Copies legacy Documento metadata/binary into the private pipeline. It is
 * intentionally opt-in, dry-run by default, and never deletes the legacy row.
 * A production deployment must invoke it with DOCUMENT_BACKFILL_CONFIRM=YES
 * after verifying the private storage root and taking a database backup.
 */
export async function backfillLegacyDocuments(options: { dryRun?: boolean; limit?: number } = {}) {
  const dryRun = options.dryRun !== false;
  if (!dryRun && process.env.DOCUMENT_BACKFILL_CONFIRM !== 'YES') {
    throw new AppError('Backfill bloqueado: establezca DOCUMENT_BACKFILL_CONFIRM=YES tras validar backup y storage', 412);
  }
  const rows = await prisma.documento.findMany({
    where: { documentoRegulatorio: null },
    orderBy: { createdAt: 'asc' },
    take: Math.min(Math.max(options.limit || 100, 1), 1000),
    select: { id: true, generadorId: true, operadorId: true, tipo: true, nombre: true, path: true, mimeType: true, size: true, estado: true, anio: true, observaciones: true, subidoPor: true },
  });
  const result = { scanned: rows.length, migrated: 0, skipped: 0, errors: [] as string[] };
  for (const row of rows) {
    try {
      const owner = actorFor(row);
      if (!owner) { result.skipped += 1; continue; }
      const source = legacyPath(row.path);
      const bytes = await fs.readFile(source);
      const mime = fileMimeFromBytes(bytes);
      if (!mime) throw new Error('firma binaria no reconocida');
      const sha256 = sha256Buffer(bytes);
      const existingArchive = await prisma.archivoBinario.findUnique({ where: { sha256 }, select: { id: true } });
      const storageKey = `legacy/${row.id}/${crypto.randomUUID()}${path.extname(source).toLowerCase() || '.bin'}`;
      if (!dryRun) {
        let target: string | null = null;
        if (!existingArchive) {
          target = path.resolve(UPLOADS_DIR, ...storageKey.split('/'));
          await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
          await fs.writeFile(target, bytes, { mode: 0o600 });
          await scanDocumentPath(target);
        }
        try {
          await prisma.$transaction(async tx => {
            const archivo = existingArchive
              ? await tx.archivoBinario.findUniqueOrThrow({ where: { sha256 } })
              : await tx.archivoBinario.create({ data: { storageKey, nombreOriginal: row.nombre, mimeDetectado: mime, bytes: bytes.length, sha256, estadoScan: 'LIMPIO', motorScan: config.FILE_SCAN_MODE === 'required' ? 'clamav-required-backfill' : 'manual-qa-backfill', escaneadoAt: new Date(), creadoPorId: row.subidoPor } });
            await tx.documentoRegulatorio.create({ data: { archivoId: archivo.id, tipo: (LEGACY_TYPES.has(row.tipo) ? row.tipo : 'OTRO') as any, estado: (['APROBADO', 'RECHAZADO'].includes(row.estado) ? row.estado : 'PENDIENTE') as any, ...owner, legacyDocumentoId: row.id, datosOcr: row.observaciones ? { legacyObservaciones: row.observaciones } : undefined } as any });
          });
        } catch (error) {
          if (target) await fs.rm(target, { force: true });
          throw error;
        }
      }
      result.migrated += 1;
    } catch (error) {
      result.errors.push(`${row.id}: ${error instanceof Error ? error.message : 'error'}`);
    }
  }
  return result;
}
