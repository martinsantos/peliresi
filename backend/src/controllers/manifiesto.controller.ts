import { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { anomaliaDetector } from './notification.controller';
import { domainEvents } from '../services/domainEvent.service';
import { distanciaPuntoSegmento } from '../utils/geo';

// Verificar manifiesto públicamente (sin auth) — usado por QR codes
export const verificarManifiesto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numero } = req.params;

    if (!numero) {
      throw new AppError('Número de manifiesto requerido', 400);
    }

    const manifiesto = await prisma.manifiesto.findFirst({
      where: { numero },
      select: {
        numero: true,
        estado: true,
        createdAt: true,
        fechaFirma: true,
        fechaRetiro: true,
        fechaEntrega: true,
        fechaRecepcion: true,
        fechaCierre: true,
        generador: {
          select: { razonSocial: true }
        },
        transportista: {
          select: { razonSocial: true }
        },
        operador: {
          select: { razonSocial: true }
        },
        residuos: {
          select: {
            cantidad: true,
            unidad: true,
            tipoResiduo: {
              select: { nombre: true, codigo: true }
            }
          }
        }
      }
    });

    if (!manifiesto) {
      res.status(404).json({
        success: false,
        message: 'Manifiesto no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: { manifiesto }
    });
  } catch (error) {
    next(error);
  }
};

// Zod schemas for input validation
const createManifiestoSchema = z.object({
  generadorId: z.string().min(1, 'El generador es requerido').optional(),
  transportistaId: z.string().min(1, 'El transportista es requerido'),
  operadorId: z.string().min(1, 'El operador es requerido'),
  observaciones: z.string().max(1000).optional(),
  residuos: z.array(z.object({
    tipoResiduoId: z.string().min(1, 'El tipo de residuo es requerido'),
    cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
    unidad: z.string().min(1, 'La unidad es requerida'),
    descripcion: z.string().optional(),
  })).min(1, 'Debe incluir al menos un residuo'),
});

const registrarIncidenteSchema = z.object({
  tipoIncidente: z.string().optional(),
  tipo: z.string().optional(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(1000),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
});

const cerrarManifiestoSchema = z.object({
  metodoTratamiento: z.string().optional(),
  observaciones: z.string().max(1000).optional(),
});

const actualizarUbicacionSchema = z.object({
  latitud: z.number({ error: 'latitud es requerida y debe ser un número' }).min(-90, 'latitud debe ser >= -90').max(90, 'latitud debe ser <= 90'),
  longitud: z.number({ error: 'longitud es requerida y debe ser un número' }).min(-180, 'longitud debe ser >= -180').max(180, 'longitud debe ser <= 180'),
  velocidad: z.number().min(0, 'velocidad no puede ser negativa').optional(),
  direccion: z.number().optional(),
});

// Generar número de manifiesto único
const generarNumeroManifiesto = async (): Promise<string> => {
  const año = new Date().getFullYear();
  const manifiestos = await prisma.manifiesto.findMany({
    where: {
      numero: {
        startsWith: `${año}-`
      }
    },
    select: { numero: true },
  });

  let maxNum = 0;
  for (const m of manifiestos) {
    const suffix = m.numero.replace(`${año}-`, '');
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed) && parsed > maxNum) {
      maxNum = parsed;
    }
  }

  return `${año}-${(maxNum + 1).toString().padStart(6, '0')}`;
};

// Obtener todos los manifiestos
export const getManifiestos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { estado, generadorId, transportistaId, operadorId, search, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (estado) where.estado = estado;
    if (generadorId) where.generadorId = generadorId;
    if (transportistaId) where.transportistaId = transportistaId;
    if (operadorId) where.operadorId = operadorId;

    // Text search by numero or actor razón social
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { numero: { contains: q, mode: 'insensitive' } },
        { generador: { razonSocial: { contains: q, mode: 'insensitive' } } },
        { transportista: { razonSocial: { contains: q, mode: 'insensitive' } } },
        { operador: { razonSocial: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Filtrar según el rol del usuario
    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      where.generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      where.transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      where.operadorId = req.user.operador.id;
    }

    // Smart ordering: for completed states, order by the state-specific date
    const orderBy: any =
      estado === 'ENTREGADO' ? { fechaEntrega: 'desc' } :
      estado === 'RECIBIDO' ? { fechaRecepcion: 'desc' } :
      estado === 'TRATADO' ? { fechaCierre: 'desc' } :
      { createdAt: 'desc' };

    const [manifiestos, total] = await Promise.all([
      prisma.manifiesto.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy,
        include: {
          generador: true,
          transportista: true,
          operador: true,
          residuos: {
            include: {
              tipoResiduo: true
            }
          },
          eventos: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      }),
      prisma.manifiesto.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        manifiestos,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Obtener manifiesto por ID
export const getManifiestoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        generador: true,
        transportista: {
          include: {
            vehiculos: true,
            choferes: true
          }
        },
        operador: true,
        residuos: {
          include: {
            tipoResiduo: true
          }
        },
        eventos: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: {
              select: {
                nombre: true,
                apellido: true,
                rol: true
              }
            }
          }
        },
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 100
        }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    res.json({
      success: true,
      data: { manifiesto }
    });
  } catch (error) {
    next(error);
  }
};

// Crear nuevo manifiesto
export const createManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createManifiestoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { generadorId: bodyGeneradorId, transportistaId, operadorId, residuos, observaciones } = parsed.data;
    const userId = req.user.id;

    // Verificar que el usuario es un generador o admin
    if (req.user.rol !== 'GENERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los generadores pueden crear manifiestos', 403);
    }

    // ADMIN can specify generadorId in body; GENERADOR uses their own
    const generadorId = req.user.rol === 'ADMIN'
      ? (bodyGeneradorId || (req.user.generador && req.user.generador.id))
      : req.user.generador?.id;

    if (!generadorId) {
      throw new AppError('Se requiere un generador para crear el manifiesto', 400);
    }

    // Generar número de manifiesto
    const numero = await generarNumeroManifiesto();

    // Crear manifiesto con residuos
    const manifiesto = await prisma.manifiesto.create({
      data: {
        numero,
        generadorId,
        transportistaId,
        operadorId,
        observaciones,
        estado: 'BORRADOR',
        creadoPorId: userId,
        residuos: {
          create: residuos.map((r: any) => ({
            tipoResiduoId: r.tipoResiduoId,
            cantidad: r.cantidad,
            unidad: r.unidad,
            descripcion: r.descripcion,
            estado: 'pendiente'
          }))
        }
      },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        residuos: {
          include: {
            tipoResiduo: true
          }
        }
      }
    });

    // Registrar evento
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: manifiesto.id,
        tipo: 'CREACION',
        descripcion: 'Manifiesto creado',
        usuarioId: userId
      }
    });

    res.status(201).json({
      success: true,
      data: { manifiesto }
    });
  } catch (error) {
    next(error);
  }
};

// Firmar manifiesto
export const firmarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Generate QR before transaction (async, no DB write)
    // We need manifiesto.numero first — fetch outside tx to avoid holding tx open during QR generation
    const manifiestoPreview = await prisma.manifiesto.findUnique({
      where: { id },
      select: { id: true, numero: true, estado: true },
    });

    if (!manifiestoPreview) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiestoPreview.estado !== 'BORRADOR') {
      throw new AppError('Solo se pueden firmar manifiestos en estado borrador', 400);
    }

    const qrData = JSON.stringify({
      numero: manifiestoPreview.numero,
      id: manifiestoPreview.id,
      timestamp: new Date().toISOString()
    });
    const qrCode = await QRCode.toDataURL(qrData);

    // Atomic conditional update: WHERE { id, estado: 'BORRADOR' } ensures only one
    // concurrent request can transition the state. If the manifest was already signed
    // by a concurrent request, Prisma throws P2025 (record not found matching WHERE).
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'BORRADOR' },
          data: {
            estado: 'APROBADO',
            fechaFirma: new Date(),
            qrCode
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: {
              include: {
                tipoResiduo: true
              }
            }
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('Solo se pueden firmar manifiestos en estado borrador', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'FIRMA',
          descripcion: 'Manifiesto firmado digitalmente por el generador',
          usuarioId: userId
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'APROBADO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Confirmar retiro (transportista)
export const confirmarRetiro = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden confirmar retiros', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'APROBADO' },
          data: {
            estado: 'EN_TRANSITO',
            fechaRetiro: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: {
              include: {
                tipoResiduo: true
              }
            }
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar aprobado para confirmar retiro', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RETIRO',
          descripcion: observaciones || 'Carga retirada del generador',
          latitud,
          longitud,
          usuarioId: userId
        }
      });

      if (latitud && longitud) {
        await tx.trackingGPS.create({
          data: {
            manifiestoId: id,
            latitud,
            longitud
          }
        });
      }

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'APROBADO',
      estadoNuevo: 'EN_TRANSITO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar ubicación GPS — optimized for high-frequency calls (30 clients × every 30s)
// Uses a lightweight SELECT instead of full row, and skips it if the
// manifiesto was validated recently (in-memory cache per PM2 instance, 30s TTL).
type GpsCacheEntry = {
  ts: number;
  fechaRetiro: Date | null;
  numero: string;
  genLat: number | null;
  genLon: number | null;
  opLat: number | null;
  opLon: number | null;
};
const _enTransitoCache = new Map<string, GpsCacheEntry>(); // manifiestoId → entry
const EN_TRANSITO_CACHE_TTL = 30_000; // 30s — matches GPS send interval
const _gpsUpdateCounter = new Map<string, number>(); // manifiestoId → GPS update count for anomaly sampling

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
    if (!cacheEntry || Date.now() - cacheEntry.ts > EN_TRANSITO_CACHE_TTL) {
      const manifiesto = await prisma.manifiesto.findUnique({
        where: { id },
        select: {
          id: true,
          estado: true,
          numero: true,
          fechaRetiro: true,
          generador: { select: { latitud: true, longitud: true } },
          operador: { select: { latitud: true, longitud: true } },
        },
      });

      if (!manifiesto || manifiesto.estado !== 'EN_TRANSITO') {
        _enTransitoCache.delete(id);
        throw new AppError('Manifiesto no encontrado o no está en tránsito', 404);
      }
      cacheEntry = {
        ts: Date.now(),
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

    // Detección TIEMPO_EXCESIVO: >24h desde retiro
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

    // Detección DESVIO_RUTA: >50 km del corredor generador↔operador
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

// Confirmar entrega (transportista)
export const confirmarEntrega = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden confirmar entregas', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'EN_TRANSITO' },
          data: {
            estado: 'ENTREGADO',
            fechaEntrega: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar en tránsito', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'ENTREGA',
          descripcion: observaciones || 'Carga entregada en planta de tratamiento',
          latitud,
          longitud,
          usuarioId: userId
        }
      });

      return updated;
    });

    // Invalidate GPS cache — trip is no longer EN_TRANSITO
    _enTransitoCache.delete(id);
    _gpsUpdateCounter.delete(id);

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'EN_TRANSITO',
      estadoNuevo: 'ENTREGADO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Confirmar recepción (operador)
export const confirmarRecepcion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { observaciones, pesoReal } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden confirmar recepciones', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'ENTREGADO' },
          data: {
            estado: 'RECIBIDO',
            fechaRecepcion: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar en estado entregado', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RECEPCION',
          descripcion: `Carga recibida. ${pesoReal ? `Peso registrado: ${pesoReal} kg` : ''} ${observaciones || ''}`,
          usuarioId: userId
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'ENTREGADO',
      estadoNuevo: 'RECIBIDO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar tratamiento y cerrar manifiesto
export const cerrarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = cerrarManifiestoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { metodoTratamiento, observaciones } = parsed.data;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden cerrar manifiestos', 403);
    }

    // Atomic conditional update: accepts RECIBIDO or EN_TRATAMIENTO as valid source states
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      // First verify it exists and is in a valid state
      const current = await tx.manifiesto.findUnique({ where: { id }, select: { estado: true } });
      if (!current) throw new AppError('Manifiesto no encontrado', 404);
      if (current.estado !== 'RECIBIDO' && current.estado !== 'EN_TRATAMIENTO') {
        throw new AppError('El manifiesto debe estar recibido o en tratamiento', 400);
      }

      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: current.estado },
          data: {
            estado: 'TRATADO',
            fechaCierre: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: {
              include: {
                tipoResiduo: true
              }
            }
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar recibido o en tratamiento', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'CIERRE',
          descripcion: `Manifiesto cerrado${metodoTratamiento ? `. Tratamiento: ${metodoTratamiento}` : ''}${observaciones ? `. ${observaciones}` : ''}`,
          usuarioId: userId
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'EN_TRATAMIENTO',
      estadoNuevo: 'TRATADO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Rechazar carga (operador) - CU-O06
export const rechazarCarga = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo, descripcion, cantidadRechazada } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden rechazar cargas', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'ENTREGADO' },
          data: {
            estado: 'RECHAZADO',
            observaciones: `RECHAZADO: ${motivo}. ${descripcion || ''}`
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('Solo se pueden rechazar cargas en estado entregado', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RECHAZO',
          descripcion: `Carga rechazada. Motivo: ${motivo}. ${cantidadRechazada ? `Cantidad rechazada: ${cantidadRechazada}` : ''} ${descripcion || ''}`,
          usuarioId: userId
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'RECHAZO_CARGA',
      manifiestoId: manifiestoActualizado.id,
      motivo,
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar incidente (transportista) - CU-T06
export const registrarIncidente = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = registrarIncidenteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { tipoIncidente, tipo, descripcion, latitud, longitud } = parsed.data;
    const tipoFinal = tipoIncidente || tipo; // Accept both field names
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden registrar incidentes', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'EN_TRANSITO') {
      throw new AppError('Solo se pueden registrar incidentes en transportes activos', 400);
    }

    // Registrar evento de incidente
    const evento = await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'INCIDENTE',
        descripcion: `INCIDENTE: ${tipoFinal}. ${descripcion}`,
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    // Marcar manifiesto con incidente
    await prisma.manifiesto.update({
      where: { id },
      data: {
        observaciones: `${manifiesto.observaciones || ''} [INCIDENTE: ${tipoFinal}]`
      }
    });

    res.json({
      success: true,
      data: { evento }
    });

    domainEvents.emit({
      type: 'INCIDENTE_REGISTRADO',
      manifiestoId: id,
      tipoIncidente: tipoFinal ?? '',
      descripcion: descripcion ?? '',
      userId,
      latitud,
      longitud,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar tratamiento (operador) - CU-O08
export const registrarTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metodoTratamiento, metodo, fechaTratamiento, observaciones } = req.body;
    const metodoFinal = metodoTratamiento || metodo; // Accept both field names
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden registrar tratamientos', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'RECIBIDO' },
          data: {
            estado: 'EN_TRATAMIENTO'
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar recibido para registrar tratamiento', 400);
        }
        throw err;
      }

      await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'TRATAMIENTO',
          descripcion: `Tratamiento iniciado: ${metodoFinal}. Fecha: ${fechaTratamiento || new Date().toISOString()}. ${observaciones || ''}`,
          usuarioId: userId
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'RECIBIDO',
      estadoNuevo: 'EN_TRATAMIENTO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar pesaje (operador) - CU-O04
export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { residuosPesados, residuos, observaciones } = req.body; // Accept both formats
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden registrar pesajes', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        residuos: true
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Accept pesaje in both ENTREGADO and RECIBIDO states
    if (manifiesto.estado !== 'ENTREGADO' && manifiesto.estado !== 'RECIBIDO') {
      throw new AppError('El manifiesto debe estar entregado o recibido para registrar pesaje', 400);
    }

    // Normalize input: accept both {residuosPesados: [{id, pesoReal}]} and {residuos: [{id, cantidadRecibida}]}
    const normalizedResiduos = residuosPesados || (residuos ? residuos.map((r: any) => ({ id: r.id, pesoReal: r.cantidadRecibida })) : null);
    if (!normalizedResiduos || !Array.isArray(normalizedResiduos)) {
      throw new AppError('Formato de residuos incorrecto', 400);
    }

    let pesoDeclaradoTotal = 0;
    let pesoRealTotal = 0;

    // Actualizar cada residuo en una transacción
    await prisma.$transaction(
      normalizedResiduos.map((item: any) => {
        const residuoOriginal = manifiesto.residuos.find(r => r.id === item.id);
        if (!residuoOriginal) throw new AppError(`Residuo con ID ${item.id} no encontrado en el manifiesto`, 400);

        pesoDeclaradoTotal += residuoOriginal.cantidad;
        pesoRealTotal += Number(item.pesoReal);

        let tipoDiferencia: 'NINGUNA' | 'FALTANTE' | 'EXCEDENTE' = 'NINGUNA';
        if (Number(item.pesoReal) > residuoOriginal.cantidad) tipoDiferencia = 'EXCEDENTE';
        if (Number(item.pesoReal) < residuoOriginal.cantidad) tipoDiferencia = 'FALTANTE';

        return prisma.manifiestoResiduo.update({
          where: { id: item.id },
          data: {
            cantidadRecibida: Number(item.pesoReal),
            tipoDiferencia,
            estado: 'pesado'
          }
        });
      })
    );

    const diferencia = pesoRealTotal - pesoDeclaradoTotal;
    const porcentajeDif = pesoDeclaradoTotal > 0 ? ((diferencia / pesoDeclaradoTotal) * 100).toFixed(2) : '0';

    // Registrar evento de pesaje
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'PESAJE',
        descripcion: `Pesaje realizado. Declarado Total: ${pesoDeclaradoTotal}, Real Total: ${pesoRealTotal}. Diferencia: ${porcentajeDif}%. ${observaciones || ''}`,
        usuarioId: userId
      }
    });

    // Generate anomalies if needed (Logic for CU-O05 could be here or separate)
    if (Math.abs(Number(porcentajeDif)) > 5) { // 5% tolerance
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'INCIDENTE',
          descripcion: `Diferencia de peso significativa detectada (${porcentajeDif}%)`,
          usuarioId: userId
        }
      });
      domainEvents.emit({
        type: 'DIFERENCIA_PESO',
        manifiestoId: id,
        pesoDeclarado: pesoDeclaradoTotal,
        pesoReal: pesoRealTotal,
        delta: `${porcentajeDif}%`,
        userId,
      });
    }

    res.json({
      success: true,
      data: {
        pesoDeclarado: pesoDeclaradoTotal,
        pesoReal: pesoRealTotal,
        diferencia,
        porcentajeDif: parseFloat(porcentajeDif as string)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Dashboard estadísticas
export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = {};

    // Filtrar según rol
    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      where.generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      where.transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      where.operadorId = req.user.operador.id;
    }

    // Contar manifiestos por estado
    const [borradores, aprobados, enTransito, entregados, recibidos, tratados, total] = await Promise.all([
      prisma.manifiesto.count({ where: { ...where, estado: 'BORRADOR' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'APROBADO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'EN_TRANSITO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'ENTREGADO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'RECIBIDO' } }),
      prisma.manifiesto.count({ where: { ...where, estado: 'TRATADO' } }),
      prisma.manifiesto.count({ where })
    ]);

    // Obtener manifiestos recientes
    const recientes = await prisma.manifiesto.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        generador: true,
        transportista: true,
        operador: true
      }
    });

    // Manifiestos en tránsito con último tracking
    const enTransitoList = await prisma.manifiesto.findMany({
      where: { ...where, estado: 'EN_TRANSITO' },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    res.json({
      success: true,
      data: {
        estadisticas: {
          borradores,
          aprobados,
          enTransito,
          entregados,
          recibidos,
          tratados,
          total
        },
        recientes,
        enTransitoList
      }
    });
  } catch (error) {
    next(error);
  }
};

// ========== NUEVOS ENDPOINTS PARA SOPORTE OFFLINE (CU-T01, CU-O03) ==========

// Sincronización Inicial para Transportista (CU-T01)
// Descarga tablas maestras para operación offline
export const getSyncInicial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verificar que sea transportista u operador
    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Endpoint disponible solo para transportistas y operadores', 403);
    }

    // Obtener catálogo de residuos activos
    const catalogoResiduos = await prisma.tipoResiduo.findMany({
      where: { activo: true },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        categoria: true,
        peligrosidad: true
      }
    });

    // Obtener operadores con sus datos de ubicación
    const operadores = await prisma.operador.findMany({
      where: { activo: true },
      select: {
        id: true,
        razonSocial: true,
        cuit: true,
        domicilio: true,
        telefono: true,
        email: true,
        categoria: true
      }
    });

    // Obtener manifiestos asignados al usuario (según rol)
    let manifiestos: any[] = [];

    if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      manifiestos = await prisma.manifiesto.findMany({
        where: {
          transportistaId: req.user.transportista.id,
          estado: { in: ['APROBADO', 'EN_TRANSITO'] }
        },
        include: {
          generador: {
            select: {
              id: true,
              razonSocial: true,
              domicilio: true,
              telefono: true
            }
          },
          operador: {
            select: {
              id: true,
              razonSocial: true,
              domicilio: true,
              telefono: true
            }
          },
          residuos: {
            include: {
              tipoResiduo: {
                select: {
                  codigo: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      manifiestos = await prisma.manifiesto.findMany({
        where: {
          operadorId: req.user.operador.id,
          estado: { in: ['EN_TRANSITO', 'ENTREGADO'] }
        },
        include: {
          generador: {
            select: {
              id: true,
              razonSocial: true
            }
          },
          transportista: {
            select: {
              id: true,
              razonSocial: true
            }
          },
          residuos: {
            include: {
              tipoResiduo: {
                select: {
                  codigo: true,
                  nombre: true
                }
              }
            }
          }
        }
      });
    }

    // Timestamp de sincronización
    const syncTimestamp = new Date().toISOString();

    res.json({
      success: true,
      data: {
        syncTimestamp,
        catalogoResiduos,
        operadores,
        manifiestos,
        version: '1.0.0' // Para control de versión del schema offline
      }
    });
  } catch (error) {
    next(error);
  }
};

// Lista de Manifiestos Esperados para Operador (CU-O03)
// Validación QR offline contra lista pre-descargada
export const getManifiestosEsperados = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if ((req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') || (req.user.rol === 'OPERADOR' && !req.user.operador)) {
      throw new AppError('Solo los operadores pueden acceder a esta función', 403);
    }

    // Build where clause - ADMIN sees all, OPERADOR sees only their own
    const whereClause: any = {
      estado: { in: ['EN_TRANSITO', 'ENTREGADO'] }
    };
    if (req.user.rol === 'OPERADOR' && req.user.operador) {
      whereClause.operadorId = req.user.operador.id;
    }

    // Obtener manifiestos que están en camino o ya llegaron (pendientes de recepción)
    const esperados = await prisma.manifiesto.findMany({
      where: whereClause,
      select: {
        id: true,
        numero: true,
        estado: true,
        qrCode: true,
        generador: {
          select: {
            razonSocial: true,
            cuit: true
          }
        },
        transportista: {
          select: {
            razonSocial: true,
            cuit: true
          }
        },
        residuos: {
          select: {
            cantidad: true,
            unidad: true,
            tipoResiduo: {
              select: {
                codigo: true,
                nombre: true
              }
            }
          }
        },
        fechaFirma: true,
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 1,
          select: {
            latitud: true,
            longitud: true,
            timestamp: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calcular ETA estimado para cada manifiesto en tránsito
    const esperadosConETA = esperados.map(m => ({
      ...m,
      etaEstimado: m.estado === 'EN_TRANSITO' && m.tracking.length > 0
        ? 'Calculando...' // En una implementación real, usaríamos API de rutas
        : m.estado === 'ENTREGADO' ? 'Ya arribó' : 'No disponible'
    }));

    res.json({
      success: true,
      data: {
        esperados: esperadosConETA,
        total: esperados.length,
        syncTimestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// Revertir estado (solo ADMIN)
export const revertirEstado = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { estadoNuevo, motivo } = req.body;

    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    const estadosValidos = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO',
                            'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'];
    if (!estadosValidos.includes(estadoNuevo)) {
      throw new AppError('Estado destino no válido', 400);
    }

    // Valid state reversions (current state -> allowed target states)
    const VALID_REVERSIONS: Record<string, string[]> = {
      'APROBADO': ['BORRADOR'],
      'EN_TRANSITO': ['APROBADO'],
      'ENTREGADO': ['EN_TRANSITO'],
      'RECIBIDO': ['ENTREGADO'],
      'EN_TRATAMIENTO': ['RECIBIDO'],
      'TRATADO': ['EN_TRATAMIENTO', 'RECIBIDO'],
      'RECHAZADO': ['ENTREGADO'],
    };

    const currentEstado = manifiesto.estado;
    const validTargets = VALID_REVERSIONS[currentEstado];
    if (!validTargets || !validTargets.includes(estadoNuevo)) {
      throw new AppError(
        `No se puede revertir de ${currentEstado} a ${estadoNuevo}. Transiciones válidas: ${validTargets?.join(', ') || 'ninguna'}`,
        400
      );
    }

    const estadoAnterior = manifiesto.estado;
    const updated = await prisma.manifiesto.update({
      where: { id },
      data: { estado: estadoNuevo },
    });

    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'REVERSION',
        descripcion: `Reversión: ${estadoAnterior} → ${estadoNuevo}${motivo ? '. Motivo: ' + motivo : ''}`,
        usuarioId: req.user!.id,
      },
    });

    res.json({ success: true, data: { manifiesto: updated } });
  } catch (error) {
    next(error);
  }
};

// Validar QR de manifiesto (para validación offline/online) - CU-T08
export const validarQR = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      throw new AppError('Datos de QR requeridos', 400);
    }

    // Intentar parsear el QR
    let qrInfo;
    try {
      qrInfo = JSON.parse(qrData);
    } catch {
      throw new AppError('Formato de QR inválido', 400);
    }

    // Buscar manifiesto por número o ID
    const manifiesto = await prisma.manifiesto.findFirst({
      where: {
        OR: [
          { id: qrInfo.id },
          { numero: qrInfo.numero }
        ]
      },
      include: {
        generador: {
          select: {
            razonSocial: true,
            cuit: true
          }
        },
        transportista: {
          select: {
            razonSocial: true
          }
        },
        operador: {
          select: {
            razonSocial: true
          }
        },
        residuos: {
          include: {
            tipoResiduo: true
          }
        }
      }
    });

    if (!manifiesto) {
      res.json({
        success: false,
        valid: false,
        message: 'Manifiesto no encontrado'
      });
      return;
    }

    // Verificar que el QR corresponde al manifiesto
    const isValid = manifiesto.qrCode === qrData ||
      (qrInfo.numero === manifiesto.numero && qrInfo.id === manifiesto.id);

    res.json({
      success: true,
      valid: isValid,
      data: {
        manifiesto: {
          id: manifiesto.id,
          numero: manifiesto.numero,
          estado: manifiesto.estado,
          generador: manifiesto.generador.razonSocial,
          transportista: manifiesto.transportista.razonSocial,
          operador: manifiesto.operador.razonSocial,
          residuos: manifiesto.residuos.map(r => ({
            tipo: r.tipoResiduo.nombre,
            cantidad: r.cantidad,
            unidad: r.unidad
          }))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar manifiesto (solo BORRADOR)
export const updateManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'BORRADOR') {
      throw new AppError('Solo se pueden editar manifiestos en estado BORRADOR', 400);
    }

    const { transportistaId, operadorId, observaciones, residuos } = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar residuos si se proporcionan
      if (residuos && Array.isArray(residuos)) {
        await tx.manifiestoResiduo.deleteMany({ where: { manifiestoId: id } });
        for (const r of residuos) {
          await tx.manifiestoResiduo.create({
            data: {
              manifiestoId: id,
              tipoResiduoId: r.tipoResiduoId,
              cantidad: r.cantidad,
              unidad: r.unidad,
              descripcion: r.descripcion,
              estado: 'pendiente',
            },
          });
        }
      }

      return tx.manifiesto.update({
        where: { id },
        data: {
          ...(transportistaId && { transportistaId }),
          ...(operadorId && { operadorId }),
          ...(observaciones !== undefined && { observaciones }),
        },
        include: {
          generador: true,
          transportista: true,
          operador: true,
          residuos: { include: { tipoResiduo: true } },
        },
      });
    });

    res.json({ success: true, data: { manifiesto: updated } });
  } catch (error) {
    next(error);
  }
};

// Eliminar manifiesto (solo BORRADOR o CANCELADO)
export const deleteManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'BORRADOR' && manifiesto.estado !== 'CANCELADO') {
      throw new AppError('Solo se pueden eliminar manifiestos en estado BORRADOR o CANCELADO', 400);
    }

    await prisma.$transaction(async (tx) => {
      await tx.manifiestoResiduo.deleteMany({ where: { manifiestoId: id } });
      await tx.eventoManifiesto.deleteMany({ where: { manifiestoId: id } });
      await tx.trackingGPS.deleteMany({ where: { manifiestoId: id } });
      await tx.manifiesto.delete({ where: { id } });
    });

    res.json({ success: true, message: 'Manifiesto eliminado' });
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
      select: { id: true, estado: true },
    });

    if (!manifiesto) {
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
