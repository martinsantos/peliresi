import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { manifiestoService } from '../services/manifiesto.service';
import { notificationService } from '../services/notification.service';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { isProduction } from '../config/config';

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

    // Validaciones básicas
    if (!transportistaId) throw new AppError('Debe seleccionar un transportista', 400);
    if (!operadorId) throw new AppError('Debe seleccionar un operador de destino', 400);
    if (!residuos || !Array.isArray(residuos) || residuos.length === 0) {
        throw new AppError('Debe agregar al menos un residuo', 400);
    }

    // Validar cada residuo
    for (let i = 0; i < residuos.length; i++) {
        const r = residuos[i];
        if (!r.tipoResiduoId) {
            throw new AppError(`Residuo #${i + 1}: debe seleccionar un tipo de residuo`, 400);
        }
        if (!r.cantidad || r.cantidad <= 0) {
            throw new AppError(`Residuo #${i + 1}: la cantidad debe ser mayor a 0`, 400);
        }
    }

    // VALIDACIÓN: Verificar que transportista está activo
    const transportista = await prisma.transportista.findUnique({
        where: { id: transportistaId },
        select: { id: true, razonSocial: true, activo: true, numeroHabilitacion: true }
    });

    if (!transportista) {
        throw new AppError('Transportista no encontrado', 404);
    }

    if (!transportista.activo) {
        throw new AppError(`El transportista ${transportista.razonSocial} no está activo`, 400);
    }

    // VALIDACIÓN: Verificar que operador está activo y puede tratar los residuos
    const operador = await prisma.operador.findUnique({
        where: { id: operadorId },
        include: {
            tratamientos: {
                where: { activo: true },
                select: { tipoResiduoId: true, metodo: true }
            }
        }
    });

    if (!operador) {
        throw new AppError('Operador no encontrado', 404);
    }

    if (!operador.activo) {
        throw new AppError(`El operador ${operador.razonSocial} no está activo`, 400);
    }

    // VALIDACIÓN: Verificar que operador puede tratar TODOS los residuos declarados
    const tiposResiduoIds = residuos.map(r => r.tipoResiduoId);
    const tratamientosAutorizados = operador.tratamientos.map(t => t.tipoResiduoId);

    for (const tipoResiduoId of tiposResiduoIds) {
        if (!tratamientosAutorizados.includes(tipoResiduoId)) {
            const tipoResiduo = await prisma.tipoResiduo.findUnique({
                where: { id: tipoResiduoId },
                select: { codigo: true, nombre: true }
            });
            throw new AppError(
                `El operador ${operador.razonSocial} no está autorizado para tratar el residuo ${tipoResiduo?.codigo} - ${tipoResiduo?.nombre}`,
                400
            );
        }
    }

    let generadorId: string;
    if (req.user.rol === 'ADMIN') {
        generadorId = req.body.generadorId;
        if (!generadorId) throw new AppError('Admin debe especificar un generadorId', 400);
    } else {
        // Verificar que el usuario tenga un generador asociado
        if (!req.user.generador || !req.user.generador.id) {
            throw new AppError('Su cuenta de usuario no está vinculada a un Generador. Contacte al administrador para completar la configuración de su cuenta.', 400);
        }
        generadorId = req.user.generador.id;
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
    const { id } = req.params;
    const userId = req.user.id;

    // VALIDACIÓN 1: Verificar que manifiesto existe y obtener operador asignado
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: { operador: { select: { usuarioId: true } } }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // VALIDACIÓN 2: Verificar que usuario es el operador asignado (o admin)
    // En desarrollo permite demo mode, en producción se bloquea automáticamente
    const isDemoMode = !isProduction() && req.headers['x-demo-mode'] === 'true';
    if (manifiesto.operador.usuarioId !== userId && req.user.rol !== 'ADMIN' && !isDemoMode) {
      throw new AppError('No eres el operador asignado para este manifiesto', 403);
    }
    if (isDemoMode && manifiesto.operador.usuarioId !== userId) {
      console.log(`[DEMO] Usuario ${userId} confirmando recepción como operador asignado en modo demo`);
    }

    // VALIDACIÓN 3: Verificar estado correcto
    if (manifiesto.estado !== 'ENTREGADO') {
      throw new AppError('El manifiesto debe estar en estado ENTREGADO para confirmar recepción', 400);
    }

    const manifiestoActualizado = await manifiestoService.updateEstado(
      id,
      'RECIBIDO',
      userId,
      'RECEPCION',
      `Carga recibida. ${pesoReal ? `Peso: ${pesoReal} kg.` : ''} ${observaciones || ''}`
    );

    await notificationService.notificarCambioEstado(id, 'RECIBIDO', userId);
    res.json({ success: true, data: { manifiesto: manifiestoActualizado } });
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

      // OPTIMIZADO: Una sola query groupBy en lugar de 10 queries COUNT
      const statsByEstado = await prisma.manifiesto.groupBy({
        by: ['estado'],
        _count: { id: true },
        where: whereBase
      });

      // Construir objeto de stats desde el resultado del groupBy
      const statsMap = new Map(statsByEstado.map(s => [s.estado as string, s._count.id]));
      const getCount = (estado: string) => statsMap.get(estado) || 0;

      const stats = {
        total: statsByEstado.reduce((sum, s) => sum + s._count.id, 0),
        borradores: getCount('BORRADOR'),
        pendientesAprobacion: getCount('PENDIENTE_APROBACION'),
        aprobados: getCount('APROBADO'),
        enTransito: getCount('EN_TRANSITO'),
        entregados: getCount('ENTREGADO'),
        recibidos: getCount('RECIBIDO'),
        enTratamiento: getCount('EN_TRATAMIENTO'),
        tratados: getCount('TRATADO'),
        rechazados: getCount('RECHAZADO')
      };

      res.json({
        success: true,
        data: { stats }
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
                manifiestoWhere.estado = { in: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO'] };
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
    try {
        const { id } = req.params;
        const { metodoTratamiento, fechaTratamiento, observaciones, residuosTratados } = req.body;
        const userId = req.user.id;

        // Obtener manifiesto con relaciones
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                residuos: { include: { tipoResiduo: true } },
                operador: {
                    select: {
                        id: true,
                        usuarioId: true,
                        razonSocial: true,
                        tratamientos: { select: { tipoResiduoId: true, metodo: true } }
                    }
                },
                generador: { select: { usuarioId: true, razonSocial: true } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        // Validar estado
        if (!['RECIBIDO', 'EN_TRATAMIENTO'].includes(manifiesto.estado)) {
            throw new AppError('El manifiesto debe estar en estado RECIBIDO o EN_TRATAMIENTO para registrar tratamiento', 400);
        }

        // Verificar que sea el operador asignado o admin
        // En desarrollo permite demo mode, en producción se bloquea automáticamente
        const isDemoMode = !isProduction() && req.headers['x-demo-mode'] === 'true';
        if (manifiesto.operador.usuarioId !== userId && req.user.rol !== 'ADMIN' && !isDemoMode) {
            throw new AppError('No tienes permisos para registrar tratamiento en este manifiesto', 403);
        }
        if (isDemoMode && manifiesto.operador.usuarioId !== userId) {
            console.log(`[DEMO] Usuario ${userId} actuando como operador ${manifiesto.operador.id} en modo demo`);
        }

        // Validar método de tratamiento
        if (!metodoTratamiento) {
            throw new AppError('Debe especificar el método de tratamiento', 400);
        }

        // Verificar que el operador está autorizado para este tipo de tratamiento
        const tiposResiduoManifiesto = manifiesto.residuos.map(r => r.tipoResiduoId);
        const tratamientosAutorizados = manifiesto.operador.tratamientos;

        for (const tipoResiduoId of tiposResiduoManifiesto) {
            const autorizado = tratamientosAutorizados.some(
                t => t.tipoResiduoId === tipoResiduoId &&
                     t.metodo.toLowerCase().includes(metodoTratamiento.toLowerCase())
            );
            if (!autorizado) {
                // Solo advertir, no bloquear (el operador puede tener habilitación actualizada)
                console.warn(`Operador ${manifiesto.operador.id} puede no estar autorizado para tratamiento ${metodoTratamiento} del residuo ${tipoResiduoId}`);
            }
        }

        // Determinar nuevo estado
        const nuevoEstado = manifiesto.estado === 'RECIBIDO' ? 'EN_TRATAMIENTO' : manifiesto.estado;

        // Actualizar manifiesto
        const manifiestoActualizado = await prisma.manifiesto.update({
            where: { id },
            data: {
                estado: nuevoEstado,
                // Guardar info de tratamiento en observaciones si no hay campo específico
                observaciones: manifiesto.observaciones
                    ? `${manifiesto.observaciones}\n---\nTratamiento: ${metodoTratamiento} (${new Date(fechaTratamiento || Date.now()).toLocaleDateString()})`
                    : `Tratamiento: ${metodoTratamiento} (${new Date(fechaTratamiento || Date.now()).toLocaleDateString()})`
            },
            include: {
                generador: { select: { razonSocial: true, cuit: true } },
                transportista: { select: { razonSocial: true } },
                operador: { select: { razonSocial: true } },
                residuos: { include: { tipoResiduo: true } }
            }
        });

        // Actualizar estado de residuos si se especificaron
        if (residuosTratados && Array.isArray(residuosTratados)) {
            for (const rt of residuosTratados) {
                await prisma.manifiestoResiduo.update({
                    where: { id: rt.id },
                    data: { estado: 'tratado' }
                });
            }
        } else {
            // Marcar todos como tratados
            await prisma.manifiestoResiduo.updateMany({
                where: { manifiestoId: id },
                data: { estado: 'tratado' }
            });
        }

        // Registrar evento
        await prisma.eventoManifiesto.create({
            data: {
                manifiestoId: id,
                tipo: 'TRATAMIENTO',
                descripcion: `Tratamiento iniciado: ${metodoTratamiento}. Fecha: ${new Date(fechaTratamiento || Date.now()).toLocaleDateString()}. ${observaciones || ''}`,
                usuarioId: userId
            }
        });

        // Notificar cambio de estado
        await notificationService.notificarCambioEstado(id, nuevoEstado, userId);

        // Notificar al generador que su residuo está siendo tratado
        if (manifiesto.generador.usuarioId) {
            await notificationService.crearNotificacion({
                usuarioId: manifiesto.generador.usuarioId,
                tipo: 'MANIFIESTO_EN_TRANSITO', // Usamos este tipo genérico
                titulo: 'Tratamiento en Proceso',
                mensaje: `Su residuo del manifiesto ${manifiesto.numero} está siendo tratado mediante ${metodoTratamiento} por ${manifiesto.operador.razonSocial}`,
                manifiestoId: id,
                prioridad: 'NORMAL'
            });
        }

        res.json({
            success: true,
            data: {
                manifiesto: manifiestoActualizado,
                metodoTratamiento,
                fechaTratamiento: fechaTratamiento || new Date().toISOString(),
                estadoAnterior: manifiesto.estado,
                estadoNuevo: nuevoEstado
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Enviar manifiesto a aprobación DGFA
 * Transición: BORRADOR -> PENDIENTE_APROBACION
 */
export const enviarAprobacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Obtener manifiesto con validaciones
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: { select: { usuarioId: true, razonSocial: true } },
                residuos: { include: { tipoResiduo: true } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        // Validar que el usuario es el generador o admin
        if (manifiesto.generador.usuarioId !== userId && req.user.rol !== 'ADMIN') {
            throw new AppError('Solo el generador puede enviar el manifiesto a aprobación', 403);
        }

        // Validar estado actual
        if (manifiesto.estado !== 'BORRADOR') {
            throw new AppError('Solo se pueden enviar a aprobación manifiestos en estado BORRADOR', 400);
        }

        // Validar que tiene al menos un residuo
        if (!manifiesto.residuos || manifiesto.residuos.length === 0) {
            throw new AppError('El manifiesto debe tener al menos un residuo declarado', 400);
        }

        // Actualizar estado a PENDIENTE_APROBACION
        const manifiestoActualizado = await manifiestoService.updateEstado(
            id,
            'PENDIENTE_APROBACION',
            userId,
            'ENVIO_APROBACION',
            `Manifiesto enviado a aprobación por ${manifiesto.generador.razonSocial}`
        );

        // Notificar a todos los administradores DGFA
        const admins = await prisma.usuario.findMany({
            where: { rol: 'ADMIN', activo: true },
            select: { id: true }
        });

        for (const admin of admins) {
            await notificationService.crearNotificacion({
                usuarioId: admin.id,
                tipo: 'MANIFIESTO_PENDIENTE',
                titulo: 'Nuevo Manifiesto para Aprobar',
                mensaje: `El generador ${manifiesto.generador.razonSocial} ha enviado el manifiesto ${manifiesto.numero} para aprobación`,
                manifiestoId: id,
                prioridad: 'ALTA'
            });
        }

        res.json({
            success: true,
            data: {
                manifiesto: manifiestoActualizado,
                mensaje: 'Manifiesto enviado a aprobación exitosamente'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Aprobar manifiesto (DGFA Admin)
 * Transición: PENDIENTE_APROBACION -> APROBADO
 */
export const aprobarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { observaciones } = req.body;
        const userId = req.user.id;

        // Solo admins pueden aprobar
        if (req.user.rol !== 'ADMIN') {
            throw new AppError('Solo los administradores DGFA pueden aprobar manifiestos', 403);
        }

        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: { select: { usuarioId: true, razonSocial: true } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        if (manifiesto.estado !== 'PENDIENTE_APROBACION') {
            throw new AppError('Solo se pueden aprobar manifiestos en estado PENDIENTE_APROBACION', 400);
        }

        // Actualizar estado
        const manifiestoActualizado = await manifiestoService.updateEstado(
            id,
            'APROBADO',
            userId,
            'APROBACION',
            `Manifiesto aprobado por DGFA. ${observaciones || ''}`
        );

        // Notificar al generador
        if (manifiesto.generador.usuarioId) {
            await notificationService.crearNotificacion({
                usuarioId: manifiesto.generador.usuarioId,
                tipo: 'MANIFIESTO_APROBADO',
                titulo: 'Manifiesto Aprobado',
                mensaje: `Su manifiesto ${manifiesto.numero} ha sido aprobado por DGFA`,
                manifiestoId: id,
                prioridad: 'NORMAL'
            });
        }

        await notificationService.notificarCambioEstado(id, 'APROBADO', userId);

        res.json({
            success: true,
            data: {
                manifiesto: manifiestoActualizado,
                mensaje: 'Manifiesto aprobado exitosamente'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Rechazar manifiesto (DGFA Admin)
 * Transición: PENDIENTE_APROBACION -> BORRADOR (con observaciones)
 */
export const rechazarAprobacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const userId = req.user.id;

        if (req.user.rol !== 'ADMIN') {
            throw new AppError('Solo los administradores DGFA pueden rechazar manifiestos', 403);
        }

        if (!motivo || motivo.trim().length < 10) {
            throw new AppError('Debe especificar un motivo de rechazo (mínimo 10 caracteres)', 400);
        }

        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                generador: { select: { usuarioId: true, razonSocial: true } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        if (manifiesto.estado !== 'PENDIENTE_APROBACION') {
            throw new AppError('Solo se pueden rechazar manifiestos en estado PENDIENTE_APROBACION', 400);
        }

        // Volver a BORRADOR para que el generador corrija
        const manifiestoActualizado = await manifiestoService.updateEstado(
            id,
            'BORRADOR',
            userId,
            'RECHAZO_APROBACION',
            `Manifiesto devuelto para corrección. Motivo: ${motivo}`
        );

        // Notificar al generador
        if (manifiesto.generador.usuarioId) {
            await notificationService.crearNotificacion({
                usuarioId: manifiesto.generador.usuarioId,
                tipo: 'MANIFIESTO_RECHAZADO',
                titulo: 'Manifiesto Requiere Corrección',
                mensaje: `Su manifiesto ${manifiesto.numero} fue devuelto por DGFA. Motivo: ${motivo}`,
                manifiestoId: id,
                prioridad: 'ALTA'
            });
        }

        res.json({
            success: true,
            data: {
                manifiesto: manifiestoActualizado,
                mensaje: 'Manifiesto devuelto para corrección'
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener manifiestos pendientes de aprobación (DGFA)
 */
export const getManifiestosPendientes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (req.user.rol !== 'ADMIN') {
            throw new AppError('Solo los administradores pueden ver manifiestos pendientes', 403);
        }

        const manifiestos = await prisma.manifiesto.findMany({
            where: { estado: 'PENDIENTE_APROBACION' },
            orderBy: { createdAt: 'asc' }, // FIFO - primero los más antiguos
            include: {
                generador: { select: { razonSocial: true, cuit: true, domicilio: true } },
                transportista: { select: { razonSocial: true } },
                operador: { select: { razonSocial: true } },
                residuos: { include: { tipoResiduo: { select: { codigo: true, nombre: true } } } }
            }
        });

        res.json({
            success: true,
            data: {
                manifiestos,
                total: manifiestos.length
            }
        });
    } catch (error) {
        next(error);
    }
};

export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { residuosPesados, observaciones } = req.body;
        const userId = req.user.id;

        // Obtener manifiesto con residuos y operador
        const manifiesto = await prisma.manifiesto.findUnique({
            where: { id },
            include: {
                residuos: { include: { tipoResiduo: true } },
                operador: { select: { id: true, usuarioId: true, razonSocial: true } },
                generador: { select: { usuarioId: true } }
            }
        });

        if (!manifiesto) {
            throw new AppError('Manifiesto no encontrado', 404);
        }

        // Validar estado
        if (!['RECIBIDO', 'EN_TRATAMIENTO'].includes(manifiesto.estado)) {
            throw new AppError('El manifiesto debe estar en estado RECIBIDO o EN_TRATAMIENTO para registrar pesaje', 400);
        }

        // Verificar que sea el operador asignado o admin
        // En desarrollo permite demo mode, en producción se bloquea automáticamente
        const isDemoMode = !isProduction() && req.headers['x-demo-mode'] === 'true';
        if (manifiesto.operador.usuarioId !== userId && req.user.rol !== 'ADMIN' && !isDemoMode) {
            throw new AppError('No tienes permisos para registrar pesaje en este manifiesto', 403);
        }
        if (isDemoMode && manifiesto.operador.usuarioId !== userId) {
            console.log(`[DEMO] Usuario ${userId} registrando pesaje como operador asignado en modo demo`);
        }

        // Validar que se enviaron residuos
        if (!residuosPesados || !Array.isArray(residuosPesados) || residuosPesados.length === 0) {
            throw new AppError('Debe enviar al menos un residuo con su peso', 400);
        }

        // Actualizar pesos de cada residuo
        let pesoDeclaradoTotal = 0;
        let pesoRealTotal = 0;
        const resultados: any[] = [];

        for (const pesado of residuosPesados) {
            const residuo = manifiesto.residuos.find(r => r.id === pesado.id);
            if (!residuo) {
                continue; // Skip residuos no encontrados
            }

            const pesoDeclarado = residuo.cantidad;
            const pesoReal = parseFloat(pesado.pesoReal) || 0;

            pesoDeclaradoTotal += pesoDeclarado;
            pesoRealTotal += pesoReal;

            // Determinar tipo de diferencia
            let tipoDiferencia: 'FALTANTE' | 'EXCEDENTE' | 'NINGUNA' = 'NINGUNA';
            const diferencia = pesoReal - pesoDeclarado;
            const porcentajeDif = pesoDeclarado > 0 ? Math.abs(diferencia / pesoDeclarado) * 100 : 0;

            if (diferencia < -0.01 && porcentajeDif > 1) {
                tipoDiferencia = 'FALTANTE';
            } else if (diferencia > 0.01 && porcentajeDif > 1) {
                tipoDiferencia = 'EXCEDENTE';
            }

            // Actualizar residuo
            await prisma.manifiestoResiduo.update({
                where: { id: residuo.id },
                data: {
                    cantidadRecibida: pesoReal,
                    tipoDiferencia,
                    observaciones: pesado.observaciones || residuo.observaciones,
                    estado: 'pesado'
                }
            });

            resultados.push({
                id: residuo.id,
                tipoResiduo: residuo.tipoResiduo.nombre,
                pesoDeclarado,
                pesoReal,
                diferencia: diferencia.toFixed(2),
                porcentajeDif: porcentajeDif.toFixed(1),
                tipoDiferencia
            });
        }

        // Calcular diferencia total
        const diferenciaTotal = pesoRealTotal - pesoDeclaradoTotal;
        const porcentajeDifTotal = pesoDeclaradoTotal > 0
            ? (diferenciaTotal / pesoDeclaradoTotal) * 100
            : 0;

        // Registrar evento de pesaje
        await prisma.eventoManifiesto.create({
            data: {
                manifiestoId: id,
                tipo: 'PESAJE',
                descripcion: `Pesaje registrado. Declarado: ${pesoDeclaradoTotal.toFixed(2)} kg, Real: ${pesoRealTotal.toFixed(2)} kg, Diferencia: ${diferenciaTotal.toFixed(2)} kg (${porcentajeDifTotal.toFixed(1)}%). ${observaciones || ''}`,
                usuarioId: userId
            }
        });

        // Si diferencia > 10%, crear alerta para DGFA
        if (Math.abs(porcentajeDifTotal) > 10) {
            await notificationService.crearNotificacion({
                usuarioId: req.user.id, // Se notificará a admins
                tipo: 'ANOMALIA_DETECTADA',
                titulo: 'Discrepancia de Peso Detectada',
                mensaje: `Manifiesto ${manifiesto.numero}: Diferencia de ${porcentajeDifTotal.toFixed(1)}% entre peso declarado (${pesoDeclaradoTotal.toFixed(2)} kg) y peso real (${pesoRealTotal.toFixed(2)} kg)`,
                manifiestoId: id,
                prioridad: 'ALTA'
            });

            // Notificar a todos los admins
            const admins = await prisma.usuario.findMany({
                where: { rol: 'ADMIN', activo: true },
                select: { id: true }
            });

            for (const admin of admins) {
                if (admin.id !== req.user.id) {
                    await notificationService.crearNotificacion({
                        usuarioId: admin.id,
                        tipo: 'ANOMALIA_DETECTADA',
                        titulo: 'Discrepancia de Peso Detectada',
                        mensaje: `Manifiesto ${manifiesto.numero}: Diferencia de ${porcentajeDifTotal.toFixed(1)}%`,
                        manifiestoId: id,
                        prioridad: 'ALTA'
                    });
                }
            }
        }

        res.json({
            success: true,
            data: {
                pesoDeclaradoTotal: pesoDeclaradoTotal.toFixed(2),
                pesoRealTotal: pesoRealTotal.toFixed(2),
                diferenciaTotal: diferenciaTotal.toFixed(2),
                porcentajeDifTotal: porcentajeDifTotal.toFixed(1),
                alertaGenerada: Math.abs(porcentajeDifTotal) > 10,
                residuos: resultados
            }
        });
    } catch (error) {
        next(error);
    }
};
