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
    const { rol, generador, transportista, operador } = req.user;

    // Filtro base según rol
    const whereBase: any = {};
    if (rol === 'GENERADOR' && generador) {
      whereBase.generadorId = generador.id;
    } else if (rol === 'TRANSPORTISTA' && transportista) {
      whereBase.transportistaId = transportista.id;
    } else if (rol === 'OPERADOR' && operador) {
      whereBase.operadorId = operador.id;
    }

    // Conteos por estado
    const [
      totalManifiestos,
      borradores,
      pendientes,
      aprobados,
      enTransito,
      entregados,
      recibidos,
      enTratamiento,
      tratados,
      rechazados
    ] = await Promise.all([
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

    // Tendencias de los últimos 30 días
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const manifestosUltimos30Dias = await prisma.manifiesto.groupBy({
      by: ['estado'],
      where: {
        ...whereBase,
        createdAt: { gte: hace30Dias }
      },
      _count: { id: true }
    });

    // Manifiestos por día (últimos 7 días)
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);

    const manifestosPorDia = await prisma.manifiesto.groupBy({
      by: ['fechaCreacion'],
      where: {
        ...whereBase,
        fechaCreacion: { gte: hace7Dias }
      },
      _count: { id: true },
      orderBy: { fechaCreacion: 'asc' }
    });

    // Alertas activas
    const alertasActivas = await prisma.alertaGenerada.count({
      where: {
        estado: 'PENDIENTE',
        manifiesto: whereBase.generadorId ? { generadorId: whereBase.generadorId } :
                    whereBase.transportistaId ? { transportistaId: whereBase.transportistaId } :
                    whereBase.operadorId ? { operadorId: whereBase.operadorId } : undefined
      }
    });

    // Anomalías sin resolver
    const anomaliasPendientes = await prisma.anomaliaTransporte.count({
      where: {
        resuelta: false,
        manifiesto: whereBase.generadorId ? { generadorId: whereBase.generadorId } :
                    whereBase.transportistaId ? { transportistaId: whereBase.transportistaId } :
                    whereBase.operadorId ? { operadorId: whereBase.operadorId } : undefined
      }
    });

    const stats = {
      resumen: {
        total: totalManifiestos,
        borradores,
        pendientes,
        aprobados,
        enTransito,
        entregados,
        recibidos,
        enTratamiento,
        tratados,
        rechazados
      },
      tendencias: {
        ultimos30Dias: manifestosUltimos30Dias.reduce((acc, item) => {
          acc[item.estado] = item._count.id;
          return acc;
        }, {} as Record<string, number>),
        porDia: manifestosPorDia.map(item => ({
          fecha: item.fechaCreacion,
          cantidad: item._count.id
        }))
      },
      alertas: {
        activas: alertasActivas,
        anomaliasPendientes
      }
    };

    res.json({ success: true, data: { stats } });
  } catch (error) {
    next(error);
  }
};

export const getSyncInicial = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rol, generador, transportista, operador } = req.user;

    // Filtro base según rol
    const whereBase: any = {};
    if (rol === 'GENERADOR' && generador) {
      whereBase.generadorId = generador.id;
    } else if (rol === 'TRANSPORTISTA' && transportista) {
      whereBase.transportistaId = transportista.id;
    } else if (rol === 'OPERADOR' && operador) {
      whereBase.operadorId = operador.id;
    }

    // Obtener manifiestos activos (no cerrados)
    const manifiestos = await prisma.manifiesto.findMany({
      where: {
        ...whereBase,
        estado: {
          notIn: ['TRATADO', 'RECHAZADO', 'CANCELADO']
        }
      },
      include: {
        generador: { select: { id: true, razonSocial: true, cuit: true } },
        transportista: { select: { id: true, razonSocial: true, cuit: true } },
        operador: { select: { id: true, razonSocial: true, cuit: true } },
        residuos: {
          include: {
            tipoResiduo: { select: { id: true, codigo: true, nombre: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    // Catálogo de tipos de residuos
    const tiposResiduos = await prisma.tipoResiduo.findMany({
      where: { activo: true },
      orderBy: { codigo: 'asc' }
    });

    // Últimos eventos relevantes
    const eventos = await prisma.eventoManifiesto.findMany({
      where: {
        manifiesto: whereBase
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        manifiesto: { select: { numero: true } }
      }
    });

    res.json({
      success: true,
      data: {
        manifiestos,
        tiposResiduos,
        eventos,
        syncTimestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getManifiestosEsperados = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { rol, operador, transportista } = req.user;

    let whereClause: any = {};

    // Para operadores: manifiestos en camino hacia ellos
    if (rol === 'OPERADOR' && operador) {
      whereClause = {
        operadorId: operador.id,
        estado: {
          in: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO']
        }
      };
    }
    // Para transportistas: manifiestos pendientes de retiro
    else if (rol === 'TRANSPORTISTA' && transportista) {
      whereClause = {
        transportistaId: transportista.id,
        estado: {
          in: ['APROBADO', 'EN_TRANSITO']
        }
      };
    }
    // Para admin: todos los en tránsito
    else if (rol === 'ADMIN') {
      whereClause = {
        estado: {
          in: ['APROBADO', 'EN_TRANSITO', 'ENTREGADO']
        }
      };
    }

    const manifiestos = await prisma.manifiesto.findMany({
      where: whereClause,
      include: {
        generador: { select: { id: true, razonSocial: true, domicilio: true } },
        transportista: { select: { id: true, razonSocial: true } },
        operador: { select: { id: true, razonSocial: true, domicilio: true } },
        residuos: {
          include: {
            tipoResiduo: { select: { codigo: true, nombre: true } }
          }
        },
        tracking: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      },
      orderBy: { fechaCreacion: 'desc' }
    });

    // Agregar última ubicación y ETA estimado
    const manifestosConETA = manifiestos.map(m => ({
      ...m,
      ultimaUbicacion: m.tracking[0] || null,
      etaEstimado: m.estado === 'EN_TRANSITO' ? calcularETAEstimado(m) : null
    }));

    res.json({ success: true, data: manifestosConETA });
  } catch (error) {
    next(error);
  }
};

// Función auxiliar para estimar ETA (simplificada)
function calcularETAEstimado(manifiesto: any): string | null {
  if (!manifiesto.fechaRetiro) return null;
  // Estimación simple: 4 horas después del retiro
  const eta = new Date(manifiesto.fechaRetiro);
  eta.setHours(eta.getHours() + 4);
  return eta.toISOString();
}

export const validarQR = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { qrCode, manifiestoId } = req.body;

    if (!qrCode && !manifiestoId) {
      throw new AppError('Se requiere qrCode o manifiestoId', 400);
    }

    // Extraer ID del manifiesto del QR si es una URL
    let idToSearch = manifiestoId;
    if (qrCode) {
      // El QR puede ser una URL como: https://sitrep.ultimamilla.com.ar/manifiesto/XXXXX
      // o simplemente el ID/número del manifiesto
      const urlMatch = qrCode.match(/manifiesto[\/=]([a-zA-Z0-9-]+)/);
      if (urlMatch) {
        idToSearch = urlMatch[1];
      } else {
        idToSearch = qrCode;
      }
    }

    // Buscar por ID o número de manifiesto
    const manifiesto = await prisma.manifiesto.findFirst({
      where: {
        OR: [
          { id: idToSearch },
          { numero: idToSearch }
        ]
      },
      include: {
        generador: { select: { id: true, razonSocial: true, cuit: true } },
        transportista: { select: { id: true, razonSocial: true, cuit: true } },
        operador: { select: { id: true, razonSocial: true, cuit: true } },
        residuos: {
          include: {
            tipoResiduo: { select: { codigo: true, nombre: true, categoria: true } }
          }
        }
      }
    });

    if (!manifiesto) {
      return res.json({
        success: true,
        valid: false,
        error: 'Manifiesto no encontrado',
        codigo: 'NOT_FOUND'
      });
    }

    // Verificar que el QR coincida si el manifiesto tiene uno guardado
    if (manifiesto.qrCode && qrCode && !qrCode.includes(manifiesto.id) && !qrCode.includes(manifiesto.numero)) {
      return res.json({
        success: true,
        valid: false,
        error: 'El código QR no coincide con el manifiesto',
        codigo: 'QR_MISMATCH'
      });
    }

    // Verificar permisos del usuario para operar con este manifiesto
    const { rol, transportista, operador } = req.user;
    let tienePermiso = rol === 'ADMIN';

    if (rol === 'TRANSPORTISTA' && transportista) {
      tienePermiso = manifiesto.transportistaId === transportista.id;
    } else if (rol === 'OPERADOR' && operador) {
      tienePermiso = manifiesto.operadorId === operador.id;
    }

    res.json({
      success: true,
      valid: true,
      manifiesto: {
        id: manifiesto.id,
        numero: manifiesto.numero,
        estado: manifiesto.estado,
        generador: manifiesto.generador,
        transportista: manifiesto.transportista,
        operador: manifiesto.operador,
        residuos: manifiesto.residuos,
        fechaCreacion: manifiesto.fechaCreacion,
        fechaFirma: manifiesto.fechaFirma,
        fechaRetiro: manifiesto.fechaRetiro,
        observaciones: manifiesto.observaciones
      },
      tienePermiso,
      accionesDisponibles: obtenerAccionesDisponibles(manifiesto.estado, rol, tienePermiso)
    });
  } catch (error) {
    next(error);
  }
};

// Determinar qué acciones puede realizar el usuario según estado y rol
function obtenerAccionesDisponibles(estado: string, rol: string, tienePermiso: boolean): string[] {
  if (!tienePermiso && rol !== 'ADMIN') return ['VER'];

  const acciones: string[] = ['VER'];

  switch (estado) {
    case 'APROBADO':
      if (rol === 'TRANSPORTISTA' || rol === 'ADMIN') {
        acciones.push('CONFIRMAR_RETIRO', 'INICIAR_TRANSPORTE');
      }
      break;
    case 'EN_TRANSITO':
      if (rol === 'TRANSPORTISTA' || rol === 'ADMIN') {
        acciones.push('REGISTRAR_INCIDENTE', 'CONFIRMAR_ENTREGA');
      }
      break;
    case 'ENTREGADO':
      if (rol === 'OPERADOR' || rol === 'ADMIN') {
        acciones.push('CONFIRMAR_RECEPCION', 'REGISTRAR_PESAJE', 'RECHAZAR');
      }
      break;
    case 'RECIBIDO':
      if (rol === 'OPERADOR' || rol === 'ADMIN') {
        acciones.push('REGISTRAR_TRATAMIENTO');
      }
      break;
    case 'EN_TRATAMIENTO':
      if (rol === 'OPERADOR' || rol === 'ADMIN') {
        acciones.push('CERRAR_MANIFIESTO');
      }
      break;
  }

  return acciones;
}

export const rechazarCarga = async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Implement transition to RECHAZADO using service
    const manifiesto = await manifiestoService.updateEstado(req.params.id, 'RECHAZADO', req.user.id, 'RECHAZO', 'Carga rechazada por el operador');
    await notificationService.notificarCambioEstado(req.params.id, 'RECHAZADO', req.user.id);
    res.json({ success: true, data: { manifiesto } });
};

export const registrarTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metodoTratamiento, descripcion, fechaTratamiento, observaciones } = req.body;
    const { rol, operador } = req.user;

    // Verificar permisos
    if (rol !== 'OPERADOR' && rol !== 'ADMIN') {
      throw new AppError('Solo operadores pueden registrar tratamientos', 403);
    }

    // Obtener el manifiesto con sus residuos
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        residuos: {
          include: {
            tipoResiduo: true
          }
        },
        operador: {
          include: {
            tratamientos: true
          }
        }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Verificar que el operador sea el correcto
    if (rol === 'OPERADOR' && operador && manifiesto.operadorId !== operador.id) {
      throw new AppError('No tiene permiso para operar este manifiesto', 403);
    }

    // Verificar estado válido
    if (manifiesto.estado !== 'RECIBIDO' && manifiesto.estado !== 'EN_TRATAMIENTO') {
      throw new AppError(`No se puede registrar tratamiento en estado ${manifiesto.estado}`, 400);
    }

    // Verificar que el método de tratamiento esté autorizado para los tipos de residuos
    const tiposResiduoIds = manifiesto.residuos.map(r => r.tipoResiduoId);
    const tratamientosAutorizados = manifiesto.operador?.tratamientos.filter(t =>
      tiposResiduoIds.includes(t.tipoResiduoId) && t.metodo === metodoTratamiento
    );

    if (!tratamientosAutorizados || tratamientosAutorizados.length === 0) {
      // Advertir pero no bloquear en modo demo
      console.warn(`Advertencia: Método ${metodoTratamiento} no autorizado para este operador/residuo`);
    }

    // Actualizar estado a EN_TRATAMIENTO y registrar evento
    const manifiestoActualizado = await manifiestoService.updateEstado(
      id,
      'EN_TRATAMIENTO',
      req.user.id,
      'TRATAMIENTO',
      `Tratamiento iniciado: ${metodoTratamiento}. ${descripcion || ''} ${observaciones || ''}`
    );

    // Registrar evento de tratamiento
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'TRATAMIENTO_INICIADO',
        descripcion: `Método: ${metodoTratamiento}. ${descripcion || ''}`,
        usuarioId: req.user.id
      }
    });

    // Notificar al generador
    await notificationService.notificarCambioEstado(id, 'EN_TRATAMIENTO', req.user.id);

    res.json({
      success: true,
      data: {
        manifiesto: manifiestoActualizado,
        tratamiento: {
          metodo: metodoTratamiento,
          descripcion,
          fecha: fechaTratamiento || new Date(),
          registradoPor: req.user.id
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { pesajes, observaciones } = req.body;
    // pesajes: [{ residuoId, pesoReal, observaciones }]
    const { rol, operador } = req.user;

    // Verificar permisos
    if (rol !== 'OPERADOR' && rol !== 'ADMIN') {
      throw new AppError('Solo operadores pueden registrar pesajes', 403);
    }

    // Obtener el manifiesto con sus residuos
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        residuos: {
          include: {
            tipoResiduo: true
          }
        }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Verificar que el operador sea el correcto
    if (rol === 'OPERADOR' && operador && manifiesto.operadorId !== operador.id) {
      throw new AppError('No tiene permiso para operar este manifiesto', 403);
    }

    // Verificar estado válido
    if (manifiesto.estado !== 'ENTREGADO' && manifiesto.estado !== 'RECIBIDO') {
      throw new AppError(`No se puede registrar pesaje en estado ${manifiesto.estado}`, 400);
    }

    const resultadosPesaje: any[] = [];
    const alertas: string[] = [];
    const UMBRAL_DIFERENCIA = 5; // 5% de diferencia para generar alerta

    // Procesar cada pesaje
    for (const pesaje of pesajes) {
      const residuo = manifiesto.residuos.find(r => r.id === pesaje.residuoId);
      if (!residuo) continue;

      const cantidadDeclarada = residuo.cantidad;
      const cantidadRecibida = pesaje.pesoReal;
      const diferencia = cantidadRecibida - cantidadDeclarada;
      const diferenciaPorcentaje = (diferencia / cantidadDeclarada) * 100;

      // Determinar tipo de diferencia
      let tipoDiferencia: 'FALTANTE' | 'EXCEDENTE' | 'NINGUNA' = 'NINGUNA';
      if (diferencia < -0.01) tipoDiferencia = 'FALTANTE';
      else if (diferencia > 0.01) tipoDiferencia = 'EXCEDENTE';

      // Actualizar el residuo con el peso recibido
      await prisma.manifiestoResiduo.update({
        where: { id: residuo.id },
        data: {
          cantidadRecibida,
          tipoDiferencia,
          observaciones: pesaje.observaciones || residuo.observaciones
        }
      });

      resultadosPesaje.push({
        residuoId: residuo.id,
        tipoResiduo: residuo.tipoResiduo,
        cantidadDeclarada,
        cantidadRecibida,
        diferencia,
        diferenciaPorcentaje: Math.round(diferenciaPorcentaje * 100) / 100,
        tipoDiferencia
      });

      // Generar alerta si la diferencia supera el umbral
      if (Math.abs(diferenciaPorcentaje) > UMBRAL_DIFERENCIA) {
        alertas.push(`${residuo.tipoResiduo.nombre}: Diferencia de ${diferenciaPorcentaje.toFixed(1)}%`);

        // Crear alerta en el sistema
        const reglaAlerta = await prisma.reglaAlerta.findFirst({
          where: { evento: 'DIFERENCIA_PESO', activa: true }
        });

        if (reglaAlerta) {
          await prisma.alertaGenerada.create({
            data: {
              reglaId: reglaAlerta.id,
              manifiestoId: id,
              datos: JSON.stringify({
                residuoId: residuo.id,
                cantidadDeclarada,
                cantidadRecibida,
                diferenciaPorcentaje
              }),
              estado: 'PENDIENTE'
            }
          });
        }
      }
    }

    // Registrar evento de pesaje
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'PESAJE_REGISTRADO',
        descripcion: `Pesaje completado. ${alertas.length > 0 ? `Alertas: ${alertas.join(', ')}` : 'Sin diferencias significativas.'}`,
        usuarioId: req.user.id
      }
    });

    res.json({
      success: true,
      data: {
        manifiestoId: id,
        pesajes: resultadosPesaje,
        alertas,
        tieneAlertas: alertas.length > 0,
        observaciones
      }
    });
  } catch (error) {
    next(error);
  }
};
