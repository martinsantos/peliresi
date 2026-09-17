import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { generarNumeroManifiesto } from '../utils/manifiestoNumber';
import { canAccessManifestRecord } from '../utils/authorization';
import { parseQrPayload } from '../utils/qrPayload';
import { normalizeUnit } from '../utils/quantities';

// Re-export split modules so existing imports (e.g. routes) continue to work
export { getManifiestos, getManifiestoById, getDashboardStats, getSyncInicial, getManifiestosEsperados } from './manifiesto-query.controller';
export { firmarManifiesto, confirmarRetiro, confirmarEntrega, confirmarRecepcion, confirmarRecepcionInSitu, registrarTratamiento, cerrarManifiesto, rechazarCarga, registrarIncidente, revertirEstado, registrarPesaje, cancelarManifiesto } from './manifiesto-workflow.controller';
export { actualizarUbicacion, getViajeActual } from './manifiesto-gps.controller';

const unitSchema = z.string().trim().transform((value, ctx) => {
  const normalized = normalizeUnit(value);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Unidad invalida. Use kg, tn, lt o un',
    });
    return z.NEVER;
  }
  return normalized;
});

const quantitySchema = z.preprocess(
  value => typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  z.number().finite('La cantidad debe ser numerica').positive('La cantidad debe ser mayor a 0'),
);

const residuoInputSchema = z.object({
  tipoResiduoId: z.string().min(1, 'El tipo de residuo es requerido'),
  cantidad: quantitySchema,
  unidad: unitSchema,
  descripcion: z.string().max(1000).optional(),
});

// Zod schemas for input validation
const createManifiestoSchema = z.object({
  generadorId: z.string().min(1, 'El generador es requerido').optional(),
  transportistaId: z.string().min(1, 'El transportista es requerido').optional(),
  operadorId: z.string().min(1, 'El operador es requerido').optional(),
  alcanceTratamiento: z.enum(['NACIONAL', 'INTERNACIONAL']).optional().default('NACIONAL'),
  transportistaExteriorId: z.string().min(1).optional(),
  operadorExteriorId: z.string().min(1).optional(),
  declaracionTratamientoInternacional: z.string().trim().max(4000).optional(),
  modalidad: z.enum(['FIJO', 'IN_SITU']).optional().default('FIJO'),
  fechaEstimadaRetiro: z.string().optional(),
  observaciones: z.string().max(1000).optional(),
  residuos: z.array(residuoInputSchema).min(1, 'Debe incluir al menos un residuo'),
});

const updateManifiestoSchema = z.object({
  transportistaId: z.string().min(1).nullable().optional(),
  operadorId: z.string().min(1).optional(),
  alcanceTratamiento: z.enum(['NACIONAL', 'INTERNACIONAL']).optional(),
  transportistaExteriorId: z.string().min(1).nullable().optional(),
  operadorExteriorId: z.string().min(1).nullable().optional(),
  declaracionTratamientoInternacional: z.string().trim().max(4000).nullable().optional(),
  observaciones: z.string().max(1000).nullable().optional(),
  residuos: z.array(residuoInputSchema).min(1, 'Debe incluir al menos un residuo').optional(),
});

// generarNumeroManifiesto moved to ../utils/manifiestoNumber.ts (O(1) via findFirst+orderBy)

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

    const { generadorId: bodyGeneradorId, transportistaId, operadorId, alcanceTratamiento, transportistaExteriorId, operadorExteriorId, declaracionTratamientoInternacional, modalidad, residuos, observaciones, fechaEstimadaRetiro } = parsed.data;
    const userId = req.user.id;

    // Verificar que el usuario es un generador o admin
    if (req.user.rol !== 'GENERADOR' && req.user.rol !== 'ADMIN' && req.user.rol !== 'ADMIN_GENERADOR') {
      throw new AppError('Solo los generadores pueden crear manifiestos', 403);
    }

    // ADMIN can specify generadorId in body; GENERADOR uses their own
    const generadorId = (req.user.rol === 'ADMIN' || req.user.rol === 'ADMIN_GENERADOR')
      ? (bodyGeneradorId || (req.user.generador && req.user.generador.id))
      : req.user.generador?.id;

    if (!generadorId) {
      throw new AppError('Se requiere un generador para crear el manifiesto', 400);
    }

    const generador = await prisma.generador.findUnique({ where: { id: generadorId }, select: { id: true, alcanceTratamiento: true, activo: true } });
    if (!generador) throw new AppError('Generador no encontrado', 404);
    if (!generador.activo) throw new AppError('El generador está pendiente de habilitación o inactivo', 400);
    if (transportistaId) {
      const transportista = await prisma.transportista.findUnique({ where: { id: transportistaId }, select: { activo: true } });
      if (!transportista?.activo) throw new AppError('El transportista está pendiente de habilitación o inactivo', 400);
    }

    const esInternacional = alcanceTratamiento === 'INTERNACIONAL';
    if (esInternacional) {
      if (generador.alcanceTratamiento !== 'INTERNACIONAL') throw new AppError('GENERADOR_SIN_HABILITACION_INTERNACIONAL', 400);
      if (modalidad === 'IN_SITU') throw new AppError('El tratamiento internacional requiere modalidad FIJO', 400);
      if (transportistaId || operadorId) throw new AppError('No mezcle actores locales y exteriores en un manifiesto internacional', 400);
      if (!transportistaExteriorId || !operadorExteriorId) throw new AppError('ACTOR_EXTERIOR_REQUERIDO', 400);
      if (!declaracionTratamientoInternacional) throw new AppError('DECLARACION_INTERNACIONAL_REQUERIDA', 400);
      const [transportistaExterior, operadorExterior] = await Promise.all([
        prisma.entidadExterior.findUnique({ where: { id: transportistaExteriorId }, select: { tipo: true, estado: true } }),
        prisma.entidadExterior.findUnique({ where: { id: operadorExteriorId }, select: { tipo: true, estado: true } }),
      ]);
      if (transportistaExterior?.tipo !== 'TRANSPORTISTA' || transportistaExterior.estado !== 'APROBADO') throw new AppError('ACTOR_EXTERIOR_NO_APROBADO', 400);
      if (operadorExterior?.tipo !== 'OPERADOR' || operadorExterior.estado !== 'APROBADO') throw new AppError('ACTOR_EXTERIOR_NO_APROBADO', 400);
    } else if (!operadorId) {
      throw new AppError('El operador es requerido', 400);
    } else if (transportistaExteriorId || operadorExteriorId || declaracionTratamientoInternacional) {
      throw new AppError('Los datos de tratamiento internacional requieren alcance INTERNACIONAL', 400);
    }

    // Modalidad validation
    if (modalidad === 'FIJO' && !transportistaId) {
      throw new AppError('Se requiere transportista para modalidad FIJO', 400);
    }
    if (modalidad === 'IN_SITU') {
      if (transportistaId) {
        throw new AppError('No se debe asignar transportista para modalidad IN_SITU', 400);
      }
      const op = await prisma.operador.findUnique({ where: { id: operadorId! }, select: { modalidades: true } });
      if (!op?.modalidades?.includes('IN_SITU')) {
        throw new AppError('El operador no está habilitado para trabajar in situ', 400);
      }
    }

    // Validate operador can handle all selected residuos
    const tipoResiduoIds = residuos.map((r: { tipoResiduoId: string }) => r.tipoResiduoId);
    const operador = operadorId ? await prisma.operador.findUnique({
      where: { id: operadorId },
      include: { tratamientos: { where: { activo: true } } },
    }) : null;
    if (operadorId && !operador?.activo) throw new AppError('El operador está pendiente de habilitación o inactivo', 400);
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
        operadorId: esInternacional ? null : operadorId,
        alcanceTratamiento,
        transportistaExteriorId: esInternacional ? transportistaExteriorId : null,
        operadorExteriorId: esInternacional ? operadorExteriorId : null,
        declaracionTratamientoInternacional: esInternacional ? declaracionTratamientoInternacional : null,
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

    const parsed = updateManifiestoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }

    const { transportistaId, operadorId, alcanceTratamiento, transportistaExteriorId, operadorExteriorId, declaracionTratamientoInternacional, observaciones, residuos } = parsed.data;
    const nextScope = alcanceTratamiento || manifiesto.alcanceTratamiento;
    const generador = await prisma.generador.findUnique({ where: { id: manifiesto.generadorId }, select: { alcanceTratamiento: true } });
    if (nextScope === 'INTERNACIONAL') {
      if (generador?.alcanceTratamiento !== 'INTERNACIONAL') throw new AppError('GENERADOR_SIN_HABILITACION_INTERNACIONAL', 400);
      const finalTransportistaExterior = transportistaExteriorId === undefined ? manifiesto.transportistaExteriorId : transportistaExteriorId;
      const finalOperadorExterior = operadorExteriorId === undefined ? manifiesto.operadorExteriorId : operadorExteriorId;
      const finalDeclaracion = declaracionTratamientoInternacional === undefined ? manifiesto.declaracionTratamientoInternacional : declaracionTratamientoInternacional;
      if (!finalTransportistaExterior || !finalOperadorExterior) throw new AppError('ACTOR_EXTERIOR_REQUERIDO', 400);
      if (!finalDeclaracion?.trim()) throw new AppError('DECLARACION_INTERNACIONAL_REQUERIDA', 400);
      if (transportistaId || operadorId) throw new AppError('No mezcle actores locales y exteriores en un manifiesto internacional', 400);
    } else if (!operadorId && !manifiesto.operadorId) {
      throw new AppError('El operador es requerido', 400);
    }

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
          ...(transportistaId !== undefined && { transportistaId }),
          ...(operadorId !== undefined && { operadorId }),
          ...(alcanceTratamiento && { alcanceTratamiento }),
          ...(transportistaExteriorId !== undefined && { transportistaExteriorId }),
          ...(operadorExteriorId !== undefined && { operadorExteriorId }),
          ...(declaracionTratamientoInternacional !== undefined && { declaracionTratamientoInternacional }),
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
    // `code` was used by an older PWA bundle. Accept it during the rollout,
    // while the canonical contract remains `{ qrData }`.
    const qrData = typeof req.body?.qrData === 'string' ? req.body.qrData : req.body?.code;

    if (typeof qrData !== 'string' || !qrData.trim()) {
      throw new AppError('Datos de QR requeridos', 400);
    }

    const qrInfo = parseQrPayload(qrData);
    if (!qrInfo) {
      throw new AppError('Formato de QR invalido', 400);
    }

    const identityFilters = [
      qrInfo.id ? { id: qrInfo.id } : null,
      qrInfo.numero ? { numero: qrInfo.numero } : null,
    ].filter(Boolean) as Array<{ id: string } | { numero: string }>;

    // Buscar manifiesto por numero o ID
    const manifiesto = await prisma.manifiesto.findFirst({
      where: {
        OR: identityFilters,
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
        operadorExterior: {
          select: {
            razonSocial: true,
            pais: true,
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

    if (!canAccessManifestRecord(req.user, manifiesto, 'read')) {
      throw new AppError('No tiene permisos sobre este manifiesto', 403);
    }

    // The QR payload is an identity reference; authorization is still checked
    // above. URL/number payloads are supported for the public verification QR,
    // while legacy JSON remains valid when both identifiers match.
    const isValid = Boolean(
      (qrInfo.numero && qrInfo.numero === manifiesto.numero) ||
      (qrInfo.id && qrInfo.id === manifiesto.id && (!qrInfo.numero || qrInfo.numero === manifiesto.numero))
    );

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
          operador: manifiesto.operador?.razonSocial || manifiesto.operadorExterior?.razonSocial || null,
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
