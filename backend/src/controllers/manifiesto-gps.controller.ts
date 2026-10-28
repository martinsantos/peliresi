import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { anomaliaDetector } from './notification.controller';
import { domainEvents } from '../services/domainEvent.service';
import { canAccessManifiesto } from '../utils/roleFilter';
import { assessGeographicCorridor } from '../services/gpsCorridor.service';
import { createHash } from 'node:crypto';

// Zod schema for GPS update validation
const actualizarUbicacionSchema = z.object({
  latitud: z.number({ error: 'latitud es requerida y debe ser un numero' }).min(-90, 'latitud debe ser >= -90').max(90, 'latitud debe ser <= 90'),
  longitud: z.number({ error: 'longitud es requerida y debe ser un numero' }).min(-180, 'longitud debe ser >= -180').max(180, 'longitud debe ser <= 180'),
  velocidad: z.number().min(0, 'velocidad no puede ser negativa').optional(),
  direccion: z.number().optional(),
});
const ubicacionIdempotenteSchema = actualizarUbicacionSchema.extend({
  puntoId: z.string().uuid('La referencia de la ubicación no es válida'),
});

// GPS in-memory cache — optimized for high-frequency calls (30 clients x every 30s)
type GpsCacheEntry = {
  ts: number;
  generadorId: string | null;
  transportistaId: string | null;
  operadorId: string | null;
  fechaRetiro: Date | null;
  numero: string;
  genLat: number | null;
  genLon: number | null;
  opLat: number | null;
  opLon: number | null;
};
const _enTransitoCache = new Map<string, GpsCacheEntry>(); // manifiestoId -> entry
const EN_TRANSITO_CACHE_TTL = 30_000; // 30s — matches GPS send interval
const _gpsUpdateCounter = new Map<string, number>(); // manifiestoId -> GPS update count for anomaly sampling
const cacheKey = (id: string) => (isTrainingSession() ? 'training:' : 'operational:') + id;

/** Invalidate GPS cache for a given manifiesto (called when trip ends). */
export function invalidateGpsCache(manifiestoId: string): void {
  _enTransitoCache.delete(cacheKey(manifiestoId));
  _gpsUpdateCounter.delete(cacheKey(manifiestoId));
}

// Actualizar ubicacion GPS — optimized for high-frequency calls (30 clients x every 30s)
// Uses a lightweight SELECT instead of full row, and skips it if the
// manifiesto was validated recently (in-memory cache per PM2 instance, 30s TTL).
const guardarUbicacion = async (req: AuthRequest, res: Response, next: NextFunction, idempotente: boolean) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const parsed = (idempotente ? ubicacionIdempotenteSchema : actualizarUbicacionSchema).safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { latitud, longitud, velocidad, direccion } = parsed.data;
    const puntoId = 'puntoId' in parsed.data ? parsed.data.puntoId as string : undefined;
    // The point key is scoped to both the account and the manifest. The GPS
    // primary key already exists, so this adds no schema or data migration.
    const trackingId = puntoId ? 'gpsv1_' + createHash('sha256').update(JSON.stringify([id, String(userId), puntoId.toLowerCase()])).digest('hex') : undefined;

    // Check cache — skip DB lookup if we verified EN_TRANSITO recently
    let cacheEntry = _enTransitoCache.get(cacheKey(id));
    const cacheExpired = !cacheEntry || Date.now() - cacheEntry.ts > EN_TRANSITO_CACHE_TTL;
    if (cacheExpired && cacheEntry) _enTransitoCache.delete(cacheKey(id)); // evict stale entry
    if (cacheEntry && !cacheExpired && !canAccessManifiesto(req.user, cacheEntry)) {
      throw new AppError('Manifiesto no encontrado', 404);
    }
    if (!cacheEntry || cacheExpired) {
      const manifiesto = await prisma.manifiesto.findUnique({
        where: { id },
        select: {
          id: true,
          estado: true,
          numero: true,
          fechaRetiro: true,
          generadorId: true,
          transportistaId: true,
          operadorId: true,
          generador: { select: { latitud: true, longitud: true } },
          operador: { select: { latitud: true, longitud: true } },
        },
      });

      if (!manifiesto || !canAccessManifiesto(req.user, manifiesto)) {
        _enTransitoCache.delete(cacheKey(id));
        throw new AppError('Manifiesto no encontrado', 404);
      }

      if (manifiesto.estado !== 'EN_TRANSITO') {
        _enTransitoCache.delete(cacheKey(id));
        throw new AppError('Manifiesto no encontrado o no esta en transito', 404);
      }
      cacheEntry = {
        ts: Date.now(),
        generadorId: manifiesto.generadorId,
        transportistaId: manifiesto.transportistaId,
        operadorId: manifiesto.operadorId,
        fechaRetiro: manifiesto.fechaRetiro,
        numero: manifiesto.numero,
        genLat: manifiesto.generador?.latitud ?? null,
        genLon: manifiesto.generador?.longitud ?? null,
        opLat: manifiesto.operador?.latitud ?? null,
        opLon: manifiesto.operador?.longitud ?? null,
      };
      _enTransitoCache.set(cacheKey(id), cacheEntry);
    }

    // A PM2 worker cannot invalidate another worker's memory. Check live
    // ownership/state under a shared row lock before persisting every point;
    // delivery updates serialize with this short transaction across workers.
    const result = await prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ estado: string; generadorId: string | null; transportistaId: string | null; operadorId: string | null }>>`
        SELECT estado, "generadorId", "transportistaId", "operadorId"
        FROM manifiestos WHERE id = ${id} FOR SHARE
      `;
      const current = rows[0];
      if (!current || current.estado !== 'EN_TRANSITO' || !canAccessManifiesto(req.user, current)) {
        invalidateGpsCache(id);
        throw new AppError('Manifiesto no encontrado o no esta en transito', 404);
      }
      const activeLeg = await tx.tramoTransporte.findFirst({ where:{manifiestoId:id,fin:null} });
      if (activeLeg && activeLeg.tipo !== 'ORIGINAL') throw new AppError('El GPS de este manifiesto continúa desde el enlace del transporte de reemplazo',409);
      if (trackingId) {
        // A transaction-level lock serializes retries across API workers.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${trackingId}, 0))::text`;
        const previous = await tx.trackingGPS.findUnique({ where: { id: trackingId } });
        if (previous) {
          if (previous.manifiestoId !== id || previous.emisor !== `usuario:${userId}` || previous.tramoId !== null
            || previous.latitud !== latitud || previous.longitud !== longitud
            || (previous.velocidad ?? null) !== (velocidad ?? null) || (previous.direccion ?? null) !== (direccion ?? null)) {
            throw new AppError('La referencia de ubicación ya corresponde a otros datos. Revisá la sincronización.', 409);
          }
          return { tracking: previous, repetido: true };
        }
      }
      const tracking = await tx.trackingGPS.create({ data: {
        ...(trackingId ? { id: trackingId } : {}), manifiestoId: id, latitud, longitud, velocidad, direccion, emisor:`usuario:${userId}`,
      } });
      return { tracking, repetido: false };
    });

    res.json({ success: true, data: { tracking: result.tracking,
      ...(puntoId ? { idempotencia: { version: 1, puntoId, repetido: result.repetido } } : {}) } });
    // Replaying an acknowledged point must not generate another alert/event.
    if (result.repetido) return;

    // El tiempo es informativo: sólo reglas con umbrales configurados pueden
    // convertir esta observación en un aviso. No existe un plazo fijo.
    if (cacheEntry.fechaRetiro) {
      const horasTransito = (Date.now() - cacheEntry.fechaRetiro.getTime()) / 3_600_000;
      if (Number.isFinite(horasTransito) && horasTransito >= 0) {
        domainEvents.emit({
          type: 'DURACION_TRANSITO_OBSERVADA',
          manifiestoId: id,
          horasTransito,
          numero: cacheEntry.numero,
          userId,
        });
      }
    }

    // Geographic anomaly only after 3 consecutive samples. This is not called a
    // route deviation because SITREP does not store an authorised road geometry.
    if (
      cacheEntry.genLat !== null && cacheEntry.genLon !== null &&
      cacheEntry.opLat !== null && cacheEntry.opLon !== null
    ) {
      const recentPoints = await prisma.trackingGPS.findMany({
        where: { manifiestoId: id },
        orderBy: { timestamp: 'desc' },
        take: 3,
        select: { latitud: true, longitud: true },
      });
      const corridorAssessment = assessGeographicCorridor(recentPoints, {
        origin: { latitud: cacheEntry.genLat, longitud: cacheEntry.genLon },
        destination: { latitud: cacheEntry.opLat, longitud: cacheEntry.opLon },
      });
      if (corridorAssessment) {
        domainEvents.emit({
          type: 'ANOMALIA_GPS',
          manifiestoId: id,
          numero: cacheEntry.numero,
          tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO',
          descripcion: `Tres posiciones consecutivas se mantuvieron a más de 50 km del corredor geográfico estimado entre origen y destino (mínimo ${corridorAssessment.minimumDistanceKm.toFixed(1)} km). No se compara una ruta vial autorizada; requiere revisión operativa.`,
          severidad: 'ALTA',
          userId,
        });
      }
    }

    // Sample every 10 GPS updates for anomaly detection (avoids overhead on every update)
    const gpsCount = (_gpsUpdateCounter.get(cacheKey(id)) ?? 0) + 1;
    _gpsUpdateCounter.set(cacheKey(id), gpsCount);
    if (gpsCount % 10 === 0) {
      setImmediate(() => anomaliaDetector.detectarAnomalias(id, userId).catch(() => {}));
    }
  } catch (error) {
    next(error);
  }
};

export const actualizarUbicacion = (req: AuthRequest, res: Response, next: NextFunction) => guardarUbicacion(req, res, next, false);
export const actualizarUbicacionIdempotente = (req: AuthRequest, res: Response, next: NextFunction) => guardarUbicacion(req, res, next, true);

// Obtener tracking GPS del viaje actual de un manifiesto
export const getViajeActual = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: { id: true, estado: true, generadorId: true, transportistaId: true, operadorId: true },
    });

    if (!manifiesto || !canAccessManifiesto(req.user, manifiesto)) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Keep a bounded RECENT window, then deliver it chronologically for maps.
    // The ID tie-breaker makes equal sensor timestamps deterministic. One extra
    // row reports clipping without loading/counting the entire trip history.
    const rows = await prisma.trackingGPS.findMany({
      where: { manifiestoId: id },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      take: 501,
    });
    const tracking = rows.slice(0, 500).reverse();

    // Preserve data[] for existing web/app clients. This is a recent window,
    // not the complete historical route; stored points and leg IDs are intact.
    res.json({ success: true, data: tracking, ventana: {
      tipo: 'ULTIMOS_PUNTOS', limite: 500, orden: 'timestamp_asc_id_asc',
      hayAnteriores: rows.length > 500,
      desde: tracking[0]?.timestamp ?? null,
      hasta: tracking[tracking.length - 1]?.timestamp ?? null,
    } });
  } catch (error) {
    next(error);
  }
};
