/**
 * Monitor Controller — War Room endpoints
 * ========================================
 * 3 endpoints para la vista de monitoreo independiente:
 * - timeline: stream cronológico unificado para PLAYBACK
 * - monitor-live: snapshot actual optimizado para LIVE mode
 * - forecast: manifiestos pendientes y programados
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Timeline (PLAYBACK mode) ─────────────────────────────────────────────────

export async function getTimeline(req: Request, res: Response) {
  try {
    const { fecha, dias = '1' } = req.query;

    if (!fecha || typeof fecha !== 'string') {
      return res.status(400).json({ success: false, message: 'Param fecha es requerido (ISO date)' });
    }

    const diasNum = Math.min(Math.max(parseInt(dias as string) || 1, 1), 7);
    const desde = new Date(fecha);
    desde.setHours(0, 0, 0, 0);
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + diasNum);
    hasta.setHours(23, 59, 59, 999);

    // Fetch eventos + GPS en paralelo
    const [eventos, gpsPoints, manifiestos] = await Promise.all([
      prisma.eventoManifiesto.findMany({
        where: { createdAt: { gte: desde, lte: hasta } },
        orderBy: { createdAt: 'asc' },
        take: 3000,
        select: {
          id: true,
          manifiestoId: true,
          tipo: true,
          descripcion: true,
          latitud: true,
          longitud: true,
          createdAt: true,
          manifiesto: {
            select: {
              numero: true,
              estado: true,
              modalidad: true,
              tratamientoMetodo: true,
              fechaFirma: true,
              fechaRetiro: true,
              fechaEntrega: true,
              fechaRecepcion: true,
              fechaCierre: true,
              generador: { select: { razonSocial: true, cuit: true, latitud: true, longitud: true, categoria: true, domicilio: true } },
              operador: { select: { razonSocial: true, cuit: true, latitud: true, longitud: true, categoria: true, modalidades: true } },
              transportista: { select: { razonSocial: true, cuit: true } },
              residuos: {
                select: {
                  cantidad: true,
                  unidad: true,
                  tipoResiduo: { select: { nombre: true, codigo: true } },
                },
              },
            },
          },
        },
      }),
      // GPS downsampled: skip every other point for playback
      prisma.$queryRawUnsafe<any[]>(`
        SELECT t.id, t."manifiestoId", t.latitud, t.longitud, t.velocidad, t.direccion, t.timestamp,
               m.numero as "manifiestoNumero"
        FROM tracking_gps t
        JOIN manifiestos m ON m.id = t."manifiestoId"
        WHERE t.timestamp >= $1 AND t.timestamp <= $2
        ORDER BY t.timestamp ASC
        LIMIT 2000
      `, desde, hasta),
      // Get unique manifiestos in the range for context
      prisma.manifiesto.findMany({
        where: {
          OR: [
            { createdAt: { gte: desde, lte: hasta } },
            { fechaRetiro: { gte: desde, lte: hasta } },
            { fechaCierre: { gte: desde, lte: hasta } },
          ],
        },
        select: { id: true, numero: true },
      }),
    ]);

    // Build unified timeline
    const timeline: any[] = [];

    for (const ev of eventos) {
      timeline.push({
        timestamp: ev.createdAt.toISOString(),
        type: 'EVENTO',
        eventoTipo: ev.tipo,
        manifiestoId: ev.manifiestoId,
        manifiestoNumero: ev.manifiesto.numero,
        descripcion: ev.descripcion,
        latitud: ev.latitud,
        longitud: ev.longitud,
        estadoActual: ev.manifiesto.estado,
        modalidad: ev.manifiesto.modalidad,
        tratamientoMetodo: ev.manifiesto.tratamientoMetodo,
        generador: ev.manifiesto.generador ? {
          razonSocial: ev.manifiesto.generador.razonSocial,
          cuit: ev.manifiesto.generador.cuit,
          lat: ev.manifiesto.generador.latitud,
          lng: ev.manifiesto.generador.longitud,
          categoria: ev.manifiesto.generador.categoria,
          domicilio: ev.manifiesto.generador.domicilio,
        } : null,
        operador: ev.manifiesto.operador ? {
          razonSocial: ev.manifiesto.operador.razonSocial,
          cuit: ev.manifiesto.operador.cuit,
          lat: ev.manifiesto.operador.latitud,
          lng: ev.manifiesto.operador.longitud,
          categoria: ev.manifiesto.operador.categoria,
          modalidades: ev.manifiesto.operador.modalidades,
        } : null,
        transportista: ev.manifiesto.transportista ? {
          razonSocial: ev.manifiesto.transportista.razonSocial,
          cuit: ev.manifiesto.transportista.cuit,
        } : null,
        residuos: ev.manifiesto.residuos?.map(r => ({
          codigo: r.tipoResiduo?.codigo || '',
          nombre: r.tipoResiduo?.nombre || '',
          cantidad: r.cantidad,
          unidad: r.unidad,
        })) || [],
        fechas: {
          firma: ev.manifiesto.fechaFirma,
          retiro: ev.manifiesto.fechaRetiro,
          entrega: ev.manifiesto.fechaEntrega,
          recepcion: ev.manifiesto.fechaRecepcion,
          cierre: ev.manifiesto.fechaCierre,
        },
      });
    }

    for (const gp of gpsPoints) {
      timeline.push({
        timestamp: gp.timestamp instanceof Date ? gp.timestamp.toISOString() : gp.timestamp,
        type: 'GPS',
        manifiestoId: gp.manifiestoId,
        manifiestoNumero: gp.manifiestoNumero,
        descripcion: '',
        latitud: Number(gp.latitud),
        longitud: Number(gp.longitud),
        velocidad: gp.velocidad != null ? Number(gp.velocidad) : undefined,
        direccion: gp.direccion != null ? Number(gp.direccion) : undefined,
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Fetch actor positions
    const [generadores, transportistas, operadores] = await Promise.all([
      prisma.generador.findMany({
        where: { latitud: { not: null } },
        select: { id: true, razonSocial: true, latitud: true, longitud: true },
      }),
      prisma.transportista.findMany({
        where: { latitud: { not: null } },
        select: { id: true, razonSocial: true, latitud: true, longitud: true },
      }),
      prisma.operador.findMany({
        where: { latitud: { not: null } },
        select: { id: true, razonSocial: true, latitud: true, longitud: true },
      }),
    ]);

    res.json({
      success: true,
      data: {
        eventos: timeline,
        actores: {
          generadores: generadores.map(g => ({ id: g.id, razonSocial: g.razonSocial, lat: g.latitud, lng: g.longitud })),
          transportistas: transportistas.map(t => ({ id: t.id, razonSocial: t.razonSocial, lat: t.latitud, lng: t.longitud })),
          operadores: operadores.map(o => ({ id: o.id, razonSocial: o.razonSocial, lat: o.latitud, lng: o.longitud })),
        },
        resumen: {
          totalEventos: timeline.length,
          totalManifiestos: manifiestos.length,
          totalGpsPoints: gpsPoints.length,
          primeraActividad: timeline.length > 0 ? timeline[0].timestamp : null,
          ultimaActividad: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : null,
        },
      },
    });
  } catch (error: any) {
    console.error('[Monitor] Timeline error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener timeline' });
  }
}

// ─── Monitor Live (LIVE mode) ─────────────────────────────────────────────────

export async function getMonitorLive(req: Request, res: Response) {
  try {
    // Stats por estado — raw SQL eficiente
    const estadoCountsRaw = await prisma.$queryRawUnsafe<{ estado: string; cnt: bigint }[]>(`
      SELECT estado, COUNT(*) as cnt FROM manifiestos GROUP BY estado
    `);
    const porEstado: Record<string, number> = {};
    let total = 0;
    for (const row of estadoCountsRaw) {
      const count = Number(row.cnt);
      porEstado[row.estado] = count;
      total += count;
    }

    // En tránsito activos con GPS + residuos + vehicle/chofer
    const enTransito = await prisma.manifiesto.findMany({
      where: { estado: 'EN_TRANSITO' },
      select: {
        id: true,
        numero: true,
        generador: { select: { razonSocial: true, latitud: true, longitud: true } },
        operador: { select: { razonSocial: true, latitud: true, longitud: true } },
        transportista: {
          select: {
            razonSocial: true,
            vehiculos: { where: { activo: true }, select: { patente: true, marca: true, modelo: true }, take: 1 },
            choferes: { where: { activo: true }, select: { nombre: true, apellido: true }, take: 1 },
          },
        },
        residuos: {
          select: {
            cantidad: true,
            unidad: true,
            tipoResiduo: { select: { nombre: true, codigo: true } },
          },
        },
        fechaRetiro: true,
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 30,
          select: { latitud: true, longitud: true, velocidad: true, direccion: true, timestamp: true },
        },
      },
    });

    // Últimos 20 eventos para feed
    const eventosRecientes = await prisma.eventoManifiesto.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        tipo: true,
        descripcion: true,
        latitud: true,
        longitud: true,
        createdAt: true,
        manifiesto: { select: { numero: true } },
      },
    });

    // Actor positions — enriched
    const [generadores, transportistas, operadores] = await Promise.all([
      prisma.generador.findMany({
        where: { latitud: { not: null } },
        select: {
          id: true, razonSocial: true, latitud: true, longitud: true, cuit: true,
          categoria: true, domicilio: true, numeroInscripcion: true,
          _count: { select: { manifiestos: true } },
        },
      }),
      prisma.transportista.findMany({
        where: { latitud: { not: null } },
        select: {
          id: true, razonSocial: true, latitud: true, longitud: true, cuit: true,
          domicilio: true, numeroHabilitacion: true,
          vehiculos: { where: { activo: true }, select: { patente: true, marca: true, modelo: true }, take: 5 },
          choferes: { where: { activo: true }, select: { nombre: true, apellido: true }, take: 5 },
        },
      }),
      prisma.operador.findMany({
        where: { latitud: { not: null } },
        select: {
          id: true, razonSocial: true, latitud: true, longitud: true, cuit: true,
          categoria: true, domicilio: true, modalidades: true, numeroHabilitacion: true,
          tratamientos: {
            where: { activo: true },
            select: { tipoResiduo: { select: { nombre: true } }, metodo: true },
            take: 10,
          },
          _count: { select: { manifiestos: true } },
        },
      }),
    ]);

    // Manifiestos hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manifiestosHoy = await prisma.manifiesto.count({
      where: { createdAt: { gte: hoy } },
    });

    // Toneladas total (sum de residuos)
    const toneladasRaw = await prisma.$queryRawUnsafe<{ total: number }[]>(`
      SELECT COALESCE(SUM(cantidad), 0) as total FROM manifiestos_residuos
    `);
    const toneladas = Number(toneladasRaw[0]?.total || 0);

    // Top generadores (últimos 30 días)
    const hace30d = new Date();
    hace30d.setDate(hace30d.getDate() - 30);
    const topGeneradoresRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT g."razonSocial", COUNT(m.id) as cnt
      FROM manifiestos m
      JOIN generadores g ON g.id = m."generadorId"
      WHERE m."createdAt" >= $1
      GROUP BY g."razonSocial"
      ORDER BY cnt DESC
      LIMIT 5
    `, hace30d);

    // Top operadores
    const topOperadoresRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT o."razonSocial", COUNT(m.id) as cnt
      FROM manifiestos m
      JOIN operadores o ON o.id = m."operadorId"
      WHERE m.estado IN ('RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO') AND m."createdAt" >= $1
      GROUP BY o."razonSocial"
      ORDER BY cnt DESC
      LIMIT 5
    `, hace30d);

    // Manifiestos por día (últimos 7 días)
    const hace7d = new Date();
    hace7d.setDate(hace7d.getDate() - 7);
    const porDia = await prisma.$queryRawUnsafe<any[]>(`
      SELECT DATE("createdAt") as fecha, COUNT(*) as cantidad
      FROM manifiestos
      WHERE "createdAt" >= $1
      GROUP BY DATE("createdAt")
      ORDER BY fecha ASC
    `, hace7d);

    // Top residuos por cantidad total
    const topResiduosRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT tr.nombre, SUM(mr.cantidad) as total, tr.categoria
      FROM manifiestos_residuos mr
      JOIN tipos_residuos tr ON tr.id = mr."tipoResiduoId"
      GROUP BY tr.nombre, tr.categoria
      ORDER BY total DESC
      LIMIT 8
    `);

    // Tratamientos activos por método
    const tratamientosActivosRaw = await prisma.$queryRawUnsafe<any[]>(`
      SELECT m."tratamientoMetodo" as metodo, COUNT(*) as cantidad
      FROM manifiestos m
      WHERE m."tratamientoMetodo" IS NOT NULL AND m.estado IN ('RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO')
      GROUP BY m."tratamientoMetodo"
      ORDER BY cantidad DESC
      LIMIT 8
    `);

    res.json({
      success: true,
      data: {
        estadisticas: {
          porEstado,
          total,
          manifiestosHoy,
          toneladas: Math.round(toneladas * 100) / 100,
          enTransitoActivos: porEstado['EN_TRANSITO'] || 0,
        },
        enTransito: enTransito.map(m => ({
          manifiestoId: m.id,
          numero: m.numero,
          transportista: m.transportista?.razonSocial || 'Sin asignar',
          origen: {
            razonSocial: m.generador.razonSocial,
            lat: m.generador.latitud,
            lng: m.generador.longitud,
          },
          destino: {
            razonSocial: m.operador.razonSocial,
            lat: m.operador.latitud,
            lng: m.operador.longitud,
          },
          residuos: (m.residuos || []).map(r => ({
            codigo: r.tipoResiduo?.codigo || '',
            nombre: r.tipoResiduo?.nombre || '',
            cantidad: r.cantidad,
            unidad: r.unidad,
          })),
          vehiculo: m.transportista?.vehiculos?.[0] ? {
            patente: m.transportista.vehiculos[0].patente,
            descripcion: `${m.transportista.vehiculos[0].marca} ${m.transportista.vehiculos[0].modelo}`,
          } : null,
          chofer: m.transportista?.choferes?.[0] ? {
            nombre: `${m.transportista.choferes[0].nombre} ${m.transportista.choferes[0].apellido}`,
          } : null,
          fechaRetiro: m.fechaRetiro,
          ultimaPosicion: m.tracking[0] || null,
          ruta: m.tracking.reverse().map(t => ({
            lat: t.latitud,
            lng: t.longitud,
            velocidad: t.velocidad,
            timestamp: t.timestamp,
          })),
        })),
        eventosRecientes: eventosRecientes.map(e => ({
          id: e.id,
          tipo: e.tipo,
          descripcion: e.descripcion,
          latitud: e.latitud,
          longitud: e.longitud,
          timestamp: e.createdAt,
          manifiestoNumero: e.manifiesto.numero,
        })),
        actores: {
          generadores: generadores.map(g => ({
            id: g.id, razonSocial: g.razonSocial, lat: g.latitud, lng: g.longitud,
            cuit: g.cuit, categoria: g.categoria, domicilio: g.domicilio,
            numeroInscripcion: g.numeroInscripcion,
            cantManifiestos: g._count.manifiestos,
          })),
          transportistas: transportistas.map(t => ({
            id: t.id, razonSocial: t.razonSocial, lat: t.latitud, lng: t.longitud,
            cuit: t.cuit, domicilio: t.domicilio, numeroHabilitacion: t.numeroHabilitacion,
            vehiculos: t.vehiculos.map(v => ({ patente: v.patente, tipo: `${v.marca} ${v.modelo}` })),
            choferes: t.choferes.map(c => ({ nombre: `${c.nombre} ${c.apellido}` })),
          })),
          operadores: operadores.map(o => ({
            id: o.id, razonSocial: o.razonSocial, lat: o.latitud, lng: o.longitud,
            cuit: o.cuit, categoria: o.categoria, domicilio: o.domicilio,
            modalidades: o.modalidades, numeroHabilitacion: o.numeroHabilitacion,
            tratamientos: o.tratamientos.map(t => `${t.tipoResiduo.nombre} (${t.metodo})`),
            cantManifiestos: o._count.manifiestos,
          })),
        },
        topGeneradores: topGeneradoresRaw.map(r => ({ razonSocial: r.razonSocial, cantidad: Number(r.cnt) })),
        topOperadores: topOperadoresRaw.map(r => ({ razonSocial: r.razonSocial, cantidad: Number(r.cnt) })),
        porDia: porDia.map(r => ({ fecha: r.fecha, cantidad: Number(r.cantidad) })),
        topResiduos: topResiduosRaw.map(r => ({ nombre: r.nombre, total: Number(r.total), categoria: r.categoria || null })),
        tratamientosActivos: tratamientosActivosRaw.map(r => ({ metodo: r.metodo, cantidad: Number(r.cantidad) })),
      },
    });
  } catch (error: any) {
    console.error('[Monitor] Live error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener datos live' });
  }
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export async function getForecast(req: Request, res: Response) {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias as string) || 7, 1), 30);
    const hasta = new Date();
    hasta.setDate(hasta.getDate() + dias);

    // Manifiestos APROBADO pendientes de retiro
    const pendienteRetiro = await prisma.manifiesto.findMany({
      where: { estado: 'APROBADO' },
      select: {
        id: true,
        numero: true,
        fechaEstimadaRetiro: true,
        createdAt: true,
        generador: { select: { razonSocial: true, latitud: true, longitud: true } },
        operador: { select: { razonSocial: true, latitud: true, longitud: true } },
        transportista: { select: { razonSocial: true } },
      },
      orderBy: { fechaEstimadaRetiro: 'asc' },
    });

    // Manifiestos RECIBIDO/EN_TRATAMIENTO pendientes de cierre
    const pendienteTratamiento = await prisma.manifiesto.findMany({
      where: { estado: { in: ['RECIBIDO', 'EN_TRATAMIENTO'] } },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaRecepcion: true,
        operador: { select: { razonSocial: true, latitud: true, longitud: true } },
      },
      orderBy: { fechaRecepcion: 'asc' },
    });

    // Vencimientos próximos de habilitaciones
    const vencimientos: any[] = [];

    const transportistasVenc = await prisma.transportista.findMany({
      where: { vencimientoHabilitacion: { lte: hasta, gte: new Date() } },
      select: { razonSocial: true, vencimientoHabilitacion: true },
    });
    for (const t of transportistasVenc) {
      if (t.vencimientoHabilitacion) {
        const diasRestantes = Math.ceil((t.vencimientoHabilitacion.getTime() - Date.now()) / 86400000);
        vencimientos.push({
          tipo: 'HABILITACION_TRANSPORTISTA',
          entidad: t.razonSocial,
          fechaVencimiento: t.vencimientoHabilitacion,
          diasRestantes,
        });
      }
    }

    const now = new Date();

    res.json({
      success: true,
      data: {
        pendienteRetiro: pendienteRetiro.map(m => ({
          manifiestoId: m.id,
          numero: m.numero,
          generador: m.generador.razonSocial,
          operador: m.operador.razonSocial,
          transportista: m.transportista?.razonSocial || 'Sin asignar',
          fechaEstimadaRetiro: m.fechaEstimadaRetiro,
          diasEspera: Math.ceil((now.getTime() - m.createdAt.getTime()) / 86400000),
          origenLatLng: m.generador.latitud ? [m.generador.latitud, m.generador.longitud] : null,
          destinoLatLng: m.operador.latitud ? [m.operador.latitud, m.operador.longitud] : null,
        })),
        pendienteTratamiento: pendienteTratamiento.map(m => ({
          manifiestoId: m.id,
          numero: m.numero,
          operador: m.operador.razonSocial,
          estado: m.estado,
          diasEnEspera: m.fechaRecepcion ? Math.ceil((now.getTime() - m.fechaRecepcion.getTime()) / 86400000) : 0,
          operadorLatLng: m.operador.latitud ? [m.operador.latitud, m.operador.longitud] : null,
        })),
        vencimientosProximos: vencimientos.sort((a, b) => a.diasRestantes - b.diasRestantes),
      },
    });
  } catch (error: any) {
    console.error('[Monitor] Forecast error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener forecast' });
  }
}

// ─── Active Days (for date navigator) ─────────────────────────────────────────

export async function getActiveDays(req: Request, res: Response) {
  try {
    // Get all days with manifiestos or events in the last 180 days
    const hace180d = new Date();
    hace180d.setDate(hace180d.getDate() - 180);

    const rows = await prisma.$queryRawUnsafe<{ fecha: Date }[]>(`
      SELECT DISTINCT DATE("createdAt") as fecha
      FROM manifiestos
      WHERE "createdAt" >= $1
      UNION
      SELECT DISTINCT DATE("createdAt") as fecha
      FROM eventos_manifiesto
      WHERE "createdAt" >= $1
      ORDER BY fecha ASC
    `, hace180d);

    const days = rows.map(r => {
      const d = r.fecha instanceof Date ? r.fecha : new Date(r.fecha);
      return d.toISOString().split('T')[0];
    });

    res.json({ success: true, data: { days } });
  } catch (error: any) {
    console.error('[Monitor] ActiveDays error:', error.message);
    res.status(500).json({ success: false, message: 'Error al obtener días activos' });
  }
}
