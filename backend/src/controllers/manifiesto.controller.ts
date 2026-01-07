import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { manifiestoService } from '../services/manifiesto.service';
import { notificationService } from '../services/notification.service';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

/**
 * Controller for Manifest Lifecycle
 * Refactored to use ManifiestoService
 */

export const getManifiestos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const filters = {
      ...req.query,
      page: Number(req.query.page || 1),
      limit: Number(req.query.limit || 10)
    };

    // Aplicar filtros de rol
    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      (filters as any).generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      (filters as any).transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      (filters as any).operadorId = req.user.operador.id;
    }

    const { manifiestos, pagination } = await manifiestoService.getManifiestos(filters as any);
    res.json({ success: true, data: { manifiestos, pagination } });
  } catch (error) {
    next(error);
  }
};

export const getManifiestoById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const manifiesto = await manifiestoService.getManifiestoById(req.params.id);
    res.json({ success: true, data: { manifiesto } });
  } catch (error) {
    next(error);
  }
};

export const createManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { transportistaId, operadorId, residuos, observaciones } = req.body;
    
    let generadorId: string;
    if (req.user.rol === 'ADMIN') {
        generadorId = req.body.generadorId;
        if (!generadorId) throw new AppError('Admin debe especificar un generadorId', 400);
    } else {
        generadorId = req.user.generador!.id;
    }

    const manifiesto = await manifiestoService.createManifiesto({
      transportistaId,
      operadorId,
      residuos,
      observaciones,
      generadorId,
      userId: req.user.id
    });

    res.status(201).json({ success: true, data: { manifiesto } });
  } catch (error) {
    next(error);
  }
};

export const firmarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await manifiestoService.firmarManifiesto(req.params.id, req.user);
    await notificationService.notificarCambioEstado(req.params.id, 'APROBADO', req.user.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const confirmarRecepcion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { observaciones, pesoReal } = req.body;
    const manifiesto = await manifiestoService.updateEstado(
      req.params.id, 
      'RECIBIDO', 
      req.user.id, 
      'RECEPCION', 
      `Carga recibida. ${pesoReal ? `Peso: ${pesoReal} kg.` : ''} ${observaciones || ''}`
    );
    await notificationService.notificarCambioEstado(req.params.id, 'RECIBIDO', req.user.id);
    res.json({ success: true, data: { manifiesto } });
  } catch (error) {
    next(error);
  }
};

export const cerrarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { metodoTratamiento, observaciones } = req.body;
    const manifiesto = await manifiestoService.updateEstado(
      req.params.id, 
      'TRATADO', 
      req.user.id, 
      'CIERRE', 
      `Tratamiento: ${metodoTratamiento}. ${observaciones || ''}`
    );
    await notificationService.notificarCambioEstado(req.params.id, 'TRATADO', req.user.id);
    res.json({ success: true, data: { manifiesto } });
  } catch (error) {
    next(error);
  }
};

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rol = req.user.rol as string;

      // Build filter based on role - use actor IDs, not user ID
      const whereBase: any = {};
      if (rol === 'GENERADOR' && req.user.generador) {
        whereBase.generadorId = req.user.generador.id;
      } else if (rol === 'TRANSPORTISTA' && req.user.transportista) {
        whereBase.transportistaId = req.user.transportista.id;
      } else if (rol === 'OPERADOR' && req.user.operador) {
        whereBase.operadorId = req.user.operador.id;
      }
      // ADMIN sees all - no filter

      const [total, borradores, pendientesAprobacion, aprobados, enTransito, entregados, recibidos, enTratamiento, tratados, rechazados] = await Promise.all([
        prisma.manifiesto.count({ where: whereBase }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'BORRADOR' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'PENDIENTE_APROBACION' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'APROBADO' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'EN_TRANSITO' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'ENTREGADO' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'RECIBIDO' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'EN_TRATAMIENTO' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'TRATADO' } }),
        prisma.manifiesto.count({ where: { ...whereBase, estado: 'RECHAZADO' } })
      ]);

      res.json({
        success: true,
        data: {
          stats: {
            total,
            borradores,
            pendientesAprobacion,
            aprobados,
            enTransito,
            entregados,
            recibidos,
            enTratamiento,
            tratados,
            rechazados
          }
        }
      });
    } catch (error) {
      next(error);
    }
};

export const getSyncInicial = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        const userRol = req.user?.rol;

        // Obtener catálogo de residuos
        const catalogoResiduos = await prisma.tipoResiduo.findMany({
            where: { activo: true },
            select: { id: true, codigo: true, nombre: true, descripcion: true, peligrosidad: true }
        });

        // Obtener operadores activos
        const operadores = await prisma.operador.findMany({
            where: { activo: true },
            select: {
                id: true,
                razonSocial: true,
                cuit: true,
                domicilio: true,
                categoria: true,
                tratamientos: { include: { tipoResiduo: { select: { codigo: true, nombre: true } } } }
            }
        });

        // Obtener manifiestos según el rol del usuario
        let manifiestoWhere: any = {};
        if (userRol === 'TRANSPORTISTA') {
            const transportista = await prisma.transportista.findFirst({ where: { usuarioId: userId } });
            if (transportista) {
                manifiestoWhere.transportistaId = transportista.id;
                manifiestoWhere.estado = { in: ['FIRMADO', 'EN_TRANSITO', 'ENTREGADO'] };
            }
        } else if (userRol === 'OPERADOR') {
            const operador = await prisma.operador.findFirst({ where: { usuarioId: userId } });
            if (operador) {
                manifiestoWhere.operadorId = operador.id;
                manifiestoWhere.estado = { in: ['EN_TRANSITO', 'ENTREGADO', 'EN_TRATAMIENTO'] };
            }
        } else if (userRol === 'GENERADOR') {
            const generador = await prisma.generador.findFirst({ where: { usuarioId: userId } });
            if (generador) {
                manifiestoWhere.generadorId = generador.id;
            }
        }

        const manifiestos = await prisma.manifiesto.findMany({
            where: manifiestoWhere,
            take: 50,
            orderBy: { updatedAt: 'desc' },
            include: {
                generador: { select: { razonSocial: true, cuit: true, domicilio: true } },
                transportista: { select: { razonSocial: true, cuit: true } },
                operador: { select: { razonSocial: true, domicilio: true } },
                residuos: { include: { tipoResiduo: { select: { codigo: true, nombre: true } } } }
            }
        });

        res.json({
            success: true,
            data: {
                catalogoResiduos,
                operadores,
                manifiestos,
                syncTimestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getManifiestosEsperados = async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.json({ success: true, data: [] });
};

export const validarQR = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { codigoQR } = req.body;
      if (!codigoQR) {
        return res.status(400).json({ success: false, error: 'codigoQR requerido' });
      }

      // Extraer ID del manifiesto del QR (formatos: URL con /manifiesto/ID o ID directo)
      const urlMatch = codigoQR.match(/manifiesto[\/=]([a-zA-Z0-9-]+)/i);
      const manifiestoId = urlMatch ? urlMatch[1] : codigoQR.trim();

      // Buscar manifiesto en BD
      const manifiesto = await prisma.manifiesto.findUnique({
        where: { id: manifiestoId },
        select: {
          id: true,
          numero: true,
          estado: true,
          generadorId: true,
          transportistaId: true,
          operadorId: true,
          generador: { select: { razonSocial: true } },
          transportista: { select: { razonSocial: true } },
          operador: { select: { razonSocial: true } }
        }
      });

      if (!manifiesto) {
        return res.json({ success: true, valid: false, error: 'Manifiesto no encontrado' });
      }

      // Verificar permisos según rol del usuario
      const userId = req.user.id;
      const rol = req.user.rol;
      let autorizado = false;
      let razon = '';

      if (rol === 'ADMIN') {
        autorizado = true;
        razon = 'Acceso de administrador';
      } else if (rol === 'TRANSPORTISTA' && manifiesto.transportistaId === userId) {
        autorizado = true;
        razon = 'Transportista asignado';
      } else if (rol === 'OPERADOR' && manifiesto.operadorId === userId) {
        autorizado = true;
        razon = 'Operador asignado';
      } else if (rol === 'GENERADOR' && manifiesto.generadorId === userId) {
        autorizado = true;
        razon = 'Generador del manifiesto';
      }

      if (!autorizado) {
        return res.json({
          success: true,
          valid: false,
          error: 'No autorizado para este manifiesto',
          data: { numero: manifiesto.numero, estado: manifiesto.estado }
        });
      }

      // Determinar acciones disponibles según estado y rol
      const acciones: string[] = [];
      if (rol === 'TRANSPORTISTA') {
        if (manifiesto.estado === 'APROBADO') acciones.push('INICIAR_TRANSPORTE');
        if (manifiesto.estado === 'EN_TRANSITO') acciones.push('CONFIRMAR_ENTREGA');
      } else if (rol === 'OPERADOR') {
        if (manifiesto.estado === 'ENTREGADO') acciones.push('CONFIRMAR_RECEPCION');
        if (['RECIBIDO', 'EN_TRATAMIENTO'].includes(manifiesto.estado)) acciones.push('REGISTRAR_TRATAMIENTO');
      }

      res.json({
        success: true,
        valid: true,
        data: {
          id: manifiesto.id,
          numero: manifiesto.numero,
          estado: manifiesto.estado,
          generador: manifiesto.generador.razonSocial,
          transportista: manifiesto.transportista.razonSocial,
          operador: manifiesto.operador.razonSocial,
          autorizado: true,
          razonAutorizacion: razon,
          accionesDisponibles: acciones
        }
      });
    } catch (error) {
      next(error);
    }
};

export const rechazarCarga = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Implement transition to RECHAZADO using service
    const manifiesto = await manifiestoService.updateEstado(req.params.id, 'RECHAZADO', req.user.id, 'RECHAZO', 'Carga rechazada por el operador');
    await notificationService.notificarCambioEstado(req.params.id, 'RECHAZADO', req.user.id);
    res.json({ success: true, data: { manifiesto } });
};

export const registrarTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.json({ success: true });
};

export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    res.json({ success: true });
};
