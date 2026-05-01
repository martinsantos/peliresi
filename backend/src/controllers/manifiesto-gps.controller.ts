import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { anomaliaDetector } from './notification.controller';
import { domainEvents } from '../services/domainEvent.service';
import { distanciaPuntoSegmento } from '../utils/geo';
import { canAccessManifiesto } from '../utils/roleFilter';

// Zod schema for GPS update validation
const actualizarUbicacionSchema = z.object({
  latitud: z.number({ error: 'latitud es requerida y debe ser un numero' }).min(-90, 'latitud debe ser >= -90').max(90, 'latitud debe ser <= 90'),
  longitud: z.number({ error: 'longitud es requerida y debe ser un numero' }).min(-180, 'longitud debe ser >= -180').max(180, 'longitud debe ser <= 180'),
  velocidad: z.number().min(0, 'velocidad no puede ser negativa').optional(),
  direccion: z.number().optional(),
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

/** Invalidate GPS cache for a given manifiesto (called when trip ends). */
export function invalidateGpsCache(manifiestoId: string): void {
  _enTransitoCache.delete(manifiestoId);
  _gpsUpdateCounter.delete(manifiestoId);
}

// Actualizar ubicacion GPS — optimized for high-frequency calls (30 clients x every 30s)
// Uses a lightweight SELECT instead of full row, and skips it if the
// manifiesto was validated recently (in-memory cache per PM2 instance, 30s TTL).
export const actualizarUbicacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const parsed = actualizarUbicacionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { latitud, longitud, velocidad, direccion } = parsed.data;

    // Check cache — skip DB lookup if we verified EN_TRANSITO recently
    let cacheEntry = _enTransitoCache.get(id);
    const cacheExpired = !cacheEntry || Date.now() - cacheEntry.ts > EN_TRANSITO_CACHE_TTL;
    if (cacheExpired && cacheEntry) _enTransitoCache.delete(id); // evict stale entry
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
        _enTransitoCache.delete(id);
        throw new AppError('Manifiesto no encontrado', 404);
      }

      if (manifiesto.estado !== 'EN_TRANSITO') {
        _enTransitoCache.delete(id);
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
      _enTransitoCache.set(id, cacheEntry);
    }

    const tracking = await prisma.trackingGPS.create({
      data: { manifiestoId: id, latitud, longitud, velocidad, direccion },
    });

    res.json({ success: true, data: { tracking } });

    // Deteccion TIEMPO_EXCESIVO: >24h desde retiro
    if (cacheEntry.fechaRetiro) {
      const horasTransito = (Date.now() - cacheEntry.fechaRetiro.getTime()) / 3_600_000;
      if (horasTransito > 24) {
        domainEvents.emit({
          type: 'TIEMPO_EXCESIVO',
          manifiestoId: id,
          horasTransito,
          numero: cacheEntry.numero,
          userId,
        });
      }
    }

    // Deteccion DESVIO_RUTA: >50 km del corredor generador<->operador
    if (
      cacheEntry.genLat !== null && cacheEntry.genLon !== null &&
      cacheEntry.opLat !== null && cacheEntry.opLon !== null
    ) {
      const distKm = distanciaPuntoSegmento(
        latitud, longitud,
        cacheEntry.genLat, cacheEntry.genLon,
        cacheEntry.opLat, cacheEntry.opLon,
      );
      if (distKm > 50) {
        domainEvents.emit({
          type: 'DESVIO_RUTA',
          manifiestoId: id,
          distanciaKm: distKm,
          numero: cacheEntry.numero,
          userId,
          latActual: latitud,
          lonActual: longitud,
        });
      }
    }

    // Sample every 10 GPS updates for anomaly detection (avoids overhead on every update)
    const gpsCount = (_gpsUpdateCounter.get(id) ?? 0) + 1;
    _gpsUpdateCounter.set(id, gpsCount);
    if (gpsCount % 10 === 0) {
      setImmediate(() => anomaliaDetector.detectarAnomalias(id, userId).catch(() => {}));
    }
  } catch (error) {
    next(error);
  }
};

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

    const tracking = await prisma.trackingGPS.findMany({
      where: { manifiestoId: id },
      orderBy: { timestamp: 'asc' },
      take: 500,
    });

    res.json({ success: true, data: tracking });
  } catch (error) {
    next(error);
  }
};
