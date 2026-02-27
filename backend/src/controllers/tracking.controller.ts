/**
 * SITREP — Tracking / Centro de Control Controller
 * ==================================================
 * Endpoint de actividad para el Centro de Control con mapa de capas.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

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

    // ── Generadores layer (only those with activity in the period) ──
    if (layerList.includes('generadores')) {
      const generadores = await prisma.generador.findMany({
        where: {
          activo: true,
          latitud: { not: null },
          ...(showAll ? {} : { manifiestos: { some: { fechaCreacion: dateFilter } } }),
        },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true,
          latitud: true,
          longitud: true,
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

      result.generadores = generadores.map(g => ({
        id: g.id,
        razonSocial: g.razonSocial,
        cuit: g.cuit,
        categoria: g.categoria,
        latitud: g.latitud,
        longitud: g.longitud,
        cantManifiestos: g._count.manifiestos,
        ultimaActividad: g.manifiestos[0]?.fechaCreacion || null,
      }));
    }

    // ── Transportistas layer (only those with activity in the period) ──
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
          domicilio: true,
          latitud: true,
          longitud: true,
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

      result.transportistas = transportistas.map(t => ({
        id: t.id,
        razonSocial: t.razonSocial,
        cuit: t.cuit,
        domicilio: t.domicilio,
        latitud: t.latitud,
        longitud: t.longitud,
        vehiculosActivos: t._count.vehiculos,
        enviosEnTransito: t.manifiestos.length,
      }));
    }

    // ── Operadores layer (only those with activity in the period) ──
    if (layerList.includes('operadores')) {
      const operadores = await prisma.operador.findMany({
        where: {
          activo: true,
          latitud: { not: null },
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

      result.operadores = operadores.map(o => ({
        id: o.id,
        razonSocial: o.razonSocial,
        cuit: o.cuit,
        categoria: o.categoria,
        latitud: o.latitud,
        longitud: o.longitud,
        cantRecibidos: o._count.manifiestos,
        cantTratados: o.manifiestos.length,
      }));
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
