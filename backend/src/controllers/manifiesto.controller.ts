import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

// Re-export split modules so existing imports (e.g. routes) continue to work
export { getManifiestos, getManifiestoById, getDashboardStats, getSyncInicial, getManifiestosEsperados } from './manifiesto-query.controller';
export { firmarManifiesto, confirmarRetiro, confirmarEntrega, confirmarRecepcion, confirmarRecepcionInSitu, registrarTratamiento, cerrarManifiesto, rechazarCarga, registrarIncidente, revertirEstado, registrarPesaje, cancelarManifiesto } from './manifiesto-workflow.controller';
export { actualizarUbicacion, getViajeActual } from './manifiesto-gps.controller';

// Zod schemas for input validation
const createManifiestoSchema = z.object({
  generadorId: z.string().min(1, 'El generador es requerido').optional(),
  transportistaId: z.string().min(1, 'El transportista es requerido').optional(),
  operadorId: z.string().min(1, 'El operador es requerido'),
  modalidad: z.enum(['FIJO', 'IN_SITU']).optional().default('FIJO'),
  fechaEstimadaRetiro: z.string().optional(),
  observaciones: z.string().max(1000).optional(),
  residuos: z.array(z.object({
    tipoResiduoId: z.string().min(1, 'El tipo de residuo es requerido'),
    cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
    unidad: z.string().min(1, 'La unidad es requerida'),
    descripcion: z.string().optional(),
  })).min(1, 'Debe incluir al menos un residuo'),
});

// Generar numero de manifiesto unico
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

// Verificar manifiesto publicamente (sin auth) — usado por QR codes
export const verificarManifiesto = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numero } = req.params;

    if (!numero) {
      throw new AppError('Numero de manifiesto requerido', 400);
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
        blockchainHash: true,
        blockchainTxHash: true,
        blockchainBlockNumber: true,
        blockchainTimestamp: true,
        blockchainStatus: true,
        rollingHash: true,
        sellosBlockchain: {
          select: { tipo: true, hash: true, txHash: true, blockNumber: true, blockTimestamp: true, status: true }
        },
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

// Crear nuevo manifiesto
export const createManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = createManifiestoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { generadorId: bodyGeneradorId, transportistaId, operadorId, modalidad, residuos, observaciones, fechaEstimadaRetiro } = parsed.data;
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

    // Modalidad validation
    if (modalidad === 'FIJO' && !transportistaId) {
      throw new AppError('Se requiere transportista para modalidad FIJO', 400);
    }
    if (modalidad === 'IN_SITU') {
      if (transportistaId) {
        throw new AppError('No se debe asignar transportista para modalidad IN_SITU', 400);
      }
      const op = await prisma.operador.findUnique({ where: { id: operadorId }, select: { modalidades: true } });
      if (!op?.modalidades?.includes('IN_SITU')) {
        throw new AppError('El operador no está habilitado para trabajar in situ', 400);
      }
    }

    // Validate operador can handle all selected residuos
    const tipoResiduoIds = residuos.map((r: { tipoResiduoId: string }) => r.tipoResiduoId);
    const operador = await prisma.operador.findUnique({
      where: { id: operadorId },
      include: { tratamientos: { where: { activo: true } } },
    });
    if (operador) {
      const operadorResiduoIds = new Set(operador.tratamientos.map((t: any) => t.tipoResiduoId));
      const unsupported = tipoResiduoIds.filter((id: string) => !operadorResiduoIds.has(id));
      if (unsupported.length > 0) {
        const tipos = await prisma.tipoResiduo.findMany({ where: { id: { in: unsupported } }, select: { codigo: true, nombre: true } });
        const names = tipos.map((t: any) => `${t.codigo} - ${t.nombre}`).join(', ');
        throw new AppError(`El operador no está habilitado para tratar: ${names}`, 400);
      }
    }

    // Generar numero de manifiesto
    const numero = await generarNumeroManifiesto();

    // Crear manifiesto con residuos
    const manifiesto = await prisma.manifiesto.create({
      data: {
        numero,
        generadorId,
        transportistaId: modalidad === 'IN_SITU' ? null : transportistaId,
        operadorId,
        modalidad,
        observaciones,
        fechaEstimadaRetiro: fechaEstimadaRetiro ? new Date(fechaEstimadaRetiro) : null,
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

// Validar QR de manifiesto (para validacion offline/online) - CU-T08
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
      throw new AppError('Formato de QR invalido', 400);
    }

    // Buscar manifiesto por numero o ID
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
          transportista: manifiesto.transportista?.razonSocial ?? null,
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
