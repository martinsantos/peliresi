/**
 * SITREP — Tracking / Centro de Control Controller
 * ==================================================
 * Endpoint de actividad para el Centro de Control con mapa de capas.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

// ── Coordinate fallback helpers ──────────────────────────────────────────────
// Actors without lat/lng in DB receive a deterministic approximation based on
// their domicilio string so they still appear on the map. After running
// geocode-actors.ts on the server, real coordinates replace these fallbacks.

const CENTROIDES: Record<string, { lat: number; lng: number }> = {
  'capital':        { lat: -32.8908, lng: -68.8272 },
  'godoy cruz':     { lat: -32.9214, lng: -68.8358 },
  'guaymallen':     { lat: -32.8981, lng: -68.7931 },
  'guaymallén':     { lat: -32.8981, lng: -68.7931 },
  'las heras':      { lat: -32.8528, lng: -68.8113 },
  'lujan de cuyo':  { lat: -33.0333, lng: -68.8833 },
  'luján de cuyo':  { lat: -33.0333, lng: -68.8833 },
  'maipu':          { lat: -32.9833, lng: -68.7500 },
  'maipú':          { lat: -32.9833, lng: -68.7500 },
  'san rafael':     { lat: -34.6167, lng: -68.3333 },
  'general alvear': { lat: -34.9667, lng: -67.7000 },
  'malargue':       { lat: -35.4667, lng: -69.5833 },
  'malargüe':       { lat: -35.4667, lng: -69.5833 },
  'san martin':     { lat: -33.3000, lng: -68.4667 },
  'san martín':     { lat: -33.3000, lng: -68.4667 },
  'rivadavia':      { lat: -33.1833, lng: -68.4667 },
  'junin':          { lat: -33.1333, lng: -68.4833 },
  'junín':          { lat: -33.1333, lng: -68.4833 },
  'lavalle':        { lat: -32.7167, lng: -68.5833 },
  'tunuyan':        { lat: -33.5667, lng: -69.0167 },
  'tunuyán':        { lat: -33.5667, lng: -69.0167 },
  'tupungato':      { lat: -33.3667, lng: -69.1500 },
  'san carlos':     { lat: -33.7667, lng: -69.0500 },
  'mendoza':        { lat: -32.8908, lng: -68.8272 },
};

function findCentroid(domicilio: string): { lat: number; lng: number } {
  const lower = (domicilio || '').toLowerCase();
  for (const [dept, coords] of Object.entries(CENTROIDES)) {
    if (lower.includes(dept)) return coords;
  }
  return CENTROIDES['mendoza'];
}

/** Deterministic offset ±0.008° (~900 m) derived from actor id — stable across requests */
function deterministicJitter(id: string, seed: number): number {
  const hash = [...(id + String(seed))].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return ((hash % 1000) / 1000 - 0.5) * 0.016;
}

function resolveCoords(
  latitud: number | null, longitud: number | null,
  domicilio: string, id: string,
): { lat: number; lng: number; coordsFallback: boolean } {
  if (latitud != null && longitud != null) {
    return { lat: latitud, lng: longitud, coordsFallback: false };
  }
  const centroid = findCentroid(domicilio);
  return {
    lat: centroid.lat + deterministicJitter(id, 0),
    lng: centroid.lng + deterministicJitter(id, 1),
    coordsFallback: true,
  };
}

/**
 * GET /api/centro-control/actividad
 * Query params:
 *   - fechaDesde (ISO date string)
 *   - fechaHasta (ISO date string)
 *   - capas (csv: generadores,transportistas,operadores,transito)
 *   - incluirTodos ('true' to skip manifiestos filter — returns all actors with coords)
 */
export const getActividadCentroControl = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { fechaDesde, fechaHasta, capas, incluirTodos } = req.query;
    const showAll = incluirTodos === 'true';

    // Date range — ensure "hasta" covers the full day (end-of-day, not midnight)
    const desde = fechaDesde ? new Date(fechaDesde as string) : new Date(Date.now() - 30 * 24 * 3600000);
    const hastaRaw = fechaHasta ? new Date(fechaHasta as string) : new Date();
    // If fechaHasta is a date-only string (e.g. "2026-02-05"), it parses to midnight.
    // Bump to 23:59:59.999 so the entire day is included.
    const hasta = fechaHasta && hastaRaw.getUTCHours() === 0 && hastaRaw.getUTCMinutes() === 0
      ? new Date(hastaRaw.getTime() + 86399999)
      : hastaRaw;

    // Layers to include
    const layerList = capas
      ? (capas as string).split(',').map(s => s.trim())
      : ['generadores', 'transportistas', 'operadores', 'transito'];

    const dateFilter = { gte: desde, lte: hasta };

    const result: any = {
      generadores: [],
      transportistas: [],
      operadores: [],
      enTransito: [],
      estadisticas: {},
    };

    // ── Generadores layer ──
    if (layerList.includes('generadores')) {
      const generadores = await prisma.generador.findMany({
        where: {
          activo: true,
          ...(showAll ? {} : { manifiestos: { some: { fechaCreacion: dateFilter } } }),
        },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true,
          latitud: true,
          longitud: true,
          domicilio: true,
          _count: {
            select: {
              manifiestos: {
                where: { fechaCreacion: dateFilter },
              },
            },
          },
          manifiestos: {
            where: { fechaCreacion: dateFilter },
            orderBy: { fechaCreacion: 'desc' },
            take: 1,
            select: { fechaCreacion: true },
          },
        },
      });

      result.generadores = generadores.map(g => {
        const coords = resolveCoords(g.latitud, g.longitud, g.domicilio || '', g.id);
        return {
          id: g.id,
          razonSocial: g.razonSocial,
          cuit: g.cuit,
          categoria: g.categoria,
          latitud: coords.lat,
          longitud: coords.lng,
          coordsFallback: coords.coordsFallback,
          cantManifiestos: g._count.manifiestos,
          ultimaActividad: g.manifiestos[0]?.fechaCreacion || null,
        };
      });
    }

    // ── Transportistas layer ──
    if (layerList.includes('transportistas')) {
      const transportistas = await prisma.transportista.findMany({
        where: {
          activo: true,
          ...(showAll ? {} : { manifiestos: { some: { fechaCreacion: dateFilter } } }),
        },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          latitud: true,
          longitud: true,
          domicilio: true,
          _count: {
            select: {
              vehiculos: { where: { activo: true } },
              manifiestos: { where: { fechaCreacion: dateFilter } },
            },
          },
          manifiestos: {
            where: { estado: 'EN_TRANSITO' },
            select: { id: true },
          },
        },
      });

      result.transportistas = transportistas.map(t => {
        const coords = resolveCoords(t.latitud, t.longitud, t.domicilio || '', t.id);
        return {
          id: t.id,
          razonSocial: t.razonSocial,
          cuit: t.cuit,
          latitud: coords.lat,
          longitud: coords.lng,
          coordsFallback: coords.coordsFallback,
          vehiculosActivos: t._count.vehiculos,
          enviosEnTransito: t.manifiestos.length,
        };
      });
    }

    // ── Operadores layer ──
    if (layerList.includes('operadores')) {
      const operadores = await prisma.operador.findMany({
        where: {
          activo: true,
          ...(showAll ? {} : {
            manifiestos: {
              some: {
                OR: [
                  { fechaRecepcion: dateFilter },
                  { fechaCierre: dateFilter },
                  { fechaCreacion: dateFilter },
                ],
              },
            },
          }),
        },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true,
          latitud: true,
          longitud: true,
          domicilio: true,
          _count: {
            select: {
              manifiestos: {
                where: {
                  estado: { in: ['RECIBIDO', 'EN_TRATAMIENTO'] },
                  fechaRecepcion: dateFilter,
                },
              },
            },
          },
          manifiestos: {
            where: {
              estado: 'TRATADO',
              fechaCierre: dateFilter,
            },
            select: { id: true },
          },
        },
      });

      result.operadores = operadores.map(o => {
        const coords = resolveCoords(o.latitud, o.longitud, o.domicilio || '', o.id);
        return {
          id: o.id,
          razonSocial: o.razonSocial,
          cuit: o.cuit,
          categoria: o.categoria,
          latitud: coords.lat,
          longitud: coords.lng,
          coordsFallback: coords.coordsFallback,
          cantRecibidos: o._count.manifiestos,
          cantTratados: o.manifiestos.length,
        };
      });
    }

    // ── En Tránsito layer — trips with real activity in the period ──
    // Show EN_TRANSITO if created in range OR has GPS tracking in range
    if (layerList.includes('transito')) {
      const enTransito = await prisma.manifiesto.findMany({
        where: {
          estado: 'EN_TRANSITO',
          OR: [
            { fechaCreacion: dateFilter },
            { tracking: { some: { timestamp: dateFilter } } },
          ],
        },
        select: {
          id: true,
          numero: true,
          transportista: {
            select: { razonSocial: true },
          },
          generador: {
            select: { razonSocial: true, latitud: true, longitud: true },
          },
          operador: {
            select: { razonSocial: true, latitud: true, longitud: true },
          },
          tracking: {
            orderBy: { timestamp: 'desc' },
            take: 50,
            select: {
              latitud: true,
              longitud: true,
              velocidad: true,
              direccion: true,
              timestamp: true,
            },
          },
        },
      });

      result.enTransito = enTransito.map(m => ({
        manifiestoId: m.id,
        numero: m.numero,
        transportista: m.transportista.razonSocial,
        origen: m.generador.razonSocial,
        origenLatLng: m.generador.latitud && m.generador.longitud
          ? [m.generador.latitud, m.generador.longitud] : null,
        destino: m.operador.razonSocial,
        destinoLatLng: m.operador.latitud && m.operador.longitud
          ? [m.operador.latitud, m.operador.longitud] : null,
        ultimaPosicion: m.tracking[0] || null,
        ruta: m.tracking.reverse().map(t => ({
          lat: t.latitud,
          lng: t.longitud,
          velocidad: t.velocidad,
          timestamp: t.timestamp,
        })),
      }));
    }

    // ── Estadísticas ──
    const [
      totalManifiestos,
      enTransitoActivos,
      generadoresActivos,
      operadoresActivos,
      // Pipeline: count per estado filtered by date
      borradores,
      aprobados,
      enTransitoCount,
      entregados,
      recibidos,
      enTratamiento,
      tratados,
      rechazados,
    ] = await Promise.all([
      prisma.manifiesto.count({ where: { fechaCreacion: dateFilter } }),
      prisma.manifiesto.count({
        where: {
          estado: 'EN_TRANSITO',
          OR: [
            { fechaCreacion: dateFilter },
            { tracking: { some: { timestamp: dateFilter } } },
          ],
        },
      }),
      prisma.generador.count({
        where: {
          activo: true,
          manifiestos: { some: { fechaCreacion: dateFilter } },
        },
      }),
      prisma.operador.count({
        where: {
          activo: true,
          manifiestos: { some: { fechaRecepcion: dateFilter } },
        },
      }),
      prisma.manifiesto.count({ where: { estado: 'BORRADOR', fechaCreacion: dateFilter } }),
      prisma.manifiesto.count({ where: { estado: 'APROBADO', fechaCreacion: dateFilter } }),
      prisma.manifiesto.count({
        where: {
          estado: 'EN_TRANSITO',
          OR: [
            { fechaCreacion: dateFilter },
            { tracking: { some: { timestamp: dateFilter } } },
          ],
        },
      }),
      prisma.manifiesto.count({ where: { estado: 'ENTREGADO', OR: [{ fechaCreacion: dateFilter }, { fechaEntrega: dateFilter }] } }),
      prisma.manifiesto.count({ where: { estado: 'RECIBIDO', OR: [{ fechaCreacion: dateFilter }, { fechaRecepcion: dateFilter }] } }),
      prisma.manifiesto.count({ where: { estado: 'EN_TRATAMIENTO', OR: [{ fechaCreacion: dateFilter }, { fechaRecepcion: dateFilter }] } }),
      prisma.manifiesto.count({ where: { estado: 'TRATADO', OR: [{ fechaCreacion: dateFilter }, { fechaCierre: dateFilter }] } }),
      prisma.manifiesto.count({ where: { estado: 'RECHAZADO', fechaCreacion: dateFilter } }),
    ]);

    // Toneladas en el período (sum of cantidades in kg, convert)
    const residuosAgg = await prisma.manifiestoResiduo.aggregate({
      _sum: { cantidad: true },
      where: {
        manifiesto: { fechaCreacion: dateFilter },
        unidad: { in: ['kg', 'toneladas'] },
      },
    });

    // Manifiestos por día
    const manifiestosPorDia = await prisma.$queryRawUnsafe<Array<{ fecha: string; cantidad: bigint }>>(
      `SELECT DATE("fechaCreacion") as fecha, COUNT(*)::bigint as cantidad
       FROM manifiestos
       WHERE "fechaCreacion" >= $1 AND "fechaCreacion" <= $2
       GROUP BY DATE("fechaCreacion")
       ORDER BY fecha ASC`,
      desde,
      hasta
    );

    result.estadisticas = {
      totalManifiestos,
      enTransitoActivos,
      generadoresActivos,
      operadoresActivos,
      toneladasPeriodo: Math.round((residuosAgg._sum.cantidad || 0) / 1000),
      porEstado: {
        BORRADOR: borradores,
        APROBADO: aprobados,
        EN_TRANSITO: enTransitoCount,
        ENTREGADO: entregados,
        RECIBIDO: recibidos,
        EN_TRATAMIENTO: enTratamiento,
        TRATADO: tratados,
        RECHAZADO: rechazados,
      },
      manifiestosPorDia: manifiestosPorDia.map(r => ({
        fecha: r.fecha,
        cantidad: Number(r.cantidad),
      })),
    };

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
