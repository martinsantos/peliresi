import { Request, Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { config } from '../config/config';

// Generar número de manifiesto único
const generarNumeroManifiesto = async (): Promise<string> => {
  const año = new Date().getFullYear();
  const ultimoManifiesto = await prisma.manifiesto.findFirst({
    where: {
      numero: {
        startsWith: `${año}-`
      }
    },
    orderBy: {
      numero: 'desc'
    }
  });

  let numero = 1;
  if (ultimoManifiesto) {
    const ultimoNumero = parseInt(ultimoManifiesto.numero.split('-')[1]);
    numero = ultimoNumero + 1;
  }

  return `${año}-${numero.toString().padStart(6, '0')}`;
};

// Obtener todos los manifiestos
export const getManifiestos = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { estado, generadorId, transportistaId, operadorId, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (estado) where.estado = estado;
    if (generadorId) where.generadorId = generadorId;
    if (transportistaId) where.transportistaId = transportistaId;
    if (operadorId) where.operadorId = operadorId;

    // Filtrar según el rol del usuario
    if (req.user.rol === 'GENERADOR' && req.user.generador) {
      where.generadorId = req.user.generador.id;
    } else if (req.user.rol === 'TRANSPORTISTA' && req.user.transportista) {
      where.transportistaId = req.user.transportista.id;
    } else if (req.user.rol === 'OPERADOR' && req.user.operador) {
      where.operadorId = req.user.operador.id;
    }

    const [manifiestos, total] = await Promise.all([
      prisma.manifiesto.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
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
    const { transportistaId, operadorId, residuos, observaciones } = req.body;
    const userId = req.user.id;

    // Determinar generadorId
    let generadorId: string;
    if (req.user.rol === 'ADMIN') {
      generadorId = req.body.generadorId || (req.user.generador ? req.user.generador.id : null);
      
      // Fallback para ADMIN si no hay generadorId: tomar el primero que exista
      if (!generadorId) {
        const fallbackGenerador = await prisma.generador.findFirst({ select: { id: true } });
        if (!fallbackGenerador) {
          throw new AppError('No existen generadores registrados en el sistema', 400);
        }
        generadorId = fallbackGenerador.id;
        console.log(`[ADMIN] Asignando generadorId fallback: ${generadorId}`);
      }
    } else if (req.user.rol === 'GENERADOR' && req.user.generador) {
      generadorId = req.user.generador.id;
    } else {
      throw new AppError('Solo los generadores o administradores pueden crear manifiestos', 403);
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

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        generador: true,
        residuos: { include: { tipoResiduo: true } }
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'BORRADOR') {
      throw new AppError('Solo se pueden firmar manifiestos en estado borrador', 400);
    }

    // Obtener usuario firmante
    const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
    if (!usuario) {
      throw new AppError('Usuario no encontrado', 404);
    }

    // Generar contenido a firmar (resumen del manifiesto)
    const contenidoFirma = JSON.stringify({
      numero: manifiesto.numero,
      generador: manifiesto.generador.razonSocial,
      fecha: new Date().toISOString(),
      residuos: manifiesto.residuos.map(r => ({
        tipo: r.tipoResiduo.nombre,
        cantidad: r.cantidad
      }))
    });

    // Generar firma digital PKI simulada
    const { signatureService } = await import('../services/signature.service');
    const firmaDigital = signatureService.firmar(contenidoFirma, {
      nombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
      email: usuario.email,
      cuit: usuario.cuit || undefined
    });

    // Generar código QR con URL de verificación PÚBLICA (sin login)
    const baseUrl = config.CORS_ORIGIN.split(',')[0].trim();
    const verificationUrl = `${baseUrl}/verify/${manifiesto.id}`;
    
    // El contenido del QR será la URL directa
    const qrData = verificationUrl;
    
    let qrCode = '';
    try {
      qrCode = await QRCode.toDataURL(qrData);
    } catch (qrErr) {
      console.error('Error generating QR code:', qrErr);
      // Fallback simple si falla la generación de imagen
      qrCode = `data:text/plain;base64,${Buffer.from(qrData).toString('base64')}`;
    }

    // Actualizar manifiesto con firma digital
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
      data: {
        estado: 'APROBADO',
        fechaFirma: new Date(),
        qrCode,
        firmaDigital: firmaDigital as any  // JSON field
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
        manifiestoId: id,
        tipo: 'FIRMA',
        descripcion: `Manifiesto firmado digitalmente. Certificado: ${firmaDigital.certificadoSerial}`,
        usuarioId: userId
      }
    });

    res.json({
      success: true,
      data: { 
        manifiesto: manifiestoActualizado,
        firma: signatureService.formatearParaMostrar(firmaDigital)
      }
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
      throw new AppError('Solo los transportistas o administradores pueden confirmar retiros', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'APROBADO') {
      throw new AppError('El manifiesto debe estar aprobado para confirmar retiro', 400);
    }

    // Actualizar manifiesto
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
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

    // Registrar evento con ubicación
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'RETIRO',
        descripcion: observaciones || 'Carga retirada del generador',
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    // Registrar primer punto de tracking
    if (latitud && longitud) {
      await prisma.trackingGPS.create({
        data: {
          manifiestoId: id,
          latitud,
          longitud
        }
      });
    }

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Actualizar ubicación GPS
export const actualizarUbicacion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, velocidad, direccion } = req.body;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto || manifiesto.estado !== 'EN_TRANSITO') {
      throw new AppError('Manifiesto no encontrado o no está en tránsito', 404);
    }

    const tracking = await prisma.trackingGPS.create({
      data: {
        manifiestoId: id,
        latitud,
        longitud,
        velocidad,
        direccion
      }
    });

    res.json({
      success: true,
      data: { tracking }
    });
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
      throw new AppError('Solo los transportistas o administradores pueden confirmar entregas', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'EN_TRANSITO') {
      throw new AppError('El manifiesto debe estar en tránsito', 400);
    }

    // Actualizar manifiesto
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
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

    // Registrar evento
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'ENTREGA',
        descripcion: observaciones || 'Carga entregada en planta de tratamiento',
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
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
      throw new AppError('Solo los operadores o administradores pueden confirmar recepciones', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'ENTREGADO') {
      throw new AppError('El manifiesto debe estar en estado entregado', 400);
    }

    // Actualizar manifiesto
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
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

    // Registrar evento
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'RECEPCION',
        descripcion: `Carga recibida. ${pesoReal ? `Peso registrado: ${pesoReal} kg` : ''} ${observaciones || ''}`,
        usuarioId: userId
      }
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Registrar tratamiento y cerrar manifiesto
export const cerrarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metodoTratamiento, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores o administradores pueden cerrar manifiestos', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'RECIBIDO' && manifiesto.estado !== 'EN_TRATAMIENTO') {
      throw new AppError('El manifiesto debe estar recibido o en tratamiento', 400);
    }

    // Actualizar manifiesto
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
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

    // Registrar evento de cierre
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'CIERRE',
        descripcion: `Tratamiento aplicado: ${metodoTratamiento}. ${observaciones || ''}`,
        usuarioId: userId
      }
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
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
      throw new AppError('Solo los operadores o administradores pueden rechazar cargas', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'ENTREGADO') {
      throw new AppError('Solo se pueden rechazar cargas en estado entregado', 400);
    }

    // Actualizar manifiesto
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
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

    // Registrar evento
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'RECHAZO',
        descripcion: `Carga rechazada. Motivo: ${motivo}. ${cantidadRechazada ? `Cantidad rechazada: ${cantidadRechazada}` : ''} ${descripcion || ''}`,
        usuarioId: userId
      }
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Registrar incidente (transportista) - CU-T06
export const registrarIncidente = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { tipoIncidente, descripcion, latitud, longitud } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas o administradores pueden registrar incidentes', 403);
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
        descripcion: `INCIDENTE: ${tipoIncidente}. ${descripcion}`,
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    // Marcar manifiesto con incidente
    await prisma.manifiesto.update({
      where: { id },
      data: {
        observaciones: `${manifiesto.observaciones || ''} [INCIDENTE: ${tipoIncidente}]`
      }
    });

    res.json({
      success: true,
      data: { evento }
    });
  } catch (error) {
    next(error);
  }
};

// Registrar tratamiento (operador) - CU-O08
export const registrarTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metodoTratamiento, fechaTratamiento, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores o administradores pueden registrar tratamientos', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'RECIBIDO') {
      throw new AppError('El manifiesto debe estar recibido para registrar tratamiento', 400);
    }

    // Actualizar manifiesto a EN_TRATAMIENTO
    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
      data: {
        estado: 'EN_TRATAMIENTO'
      },
      include: {
        generador: true,
        transportista: true,
        operador: true
      }
    });

    // Registrar evento
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'TRATAMIENTO',
        descripcion: `Tratamiento iniciado: ${metodoTratamiento}. Fecha: ${fechaTratamiento || new Date().toISOString()}. ${observaciones || ''}`,
        usuarioId: userId
      }
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });
  } catch (error) {
    next(error);
  }
};

// Registrar pesaje (operador) - CU-O04
export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { residuosPesados, observaciones } = req.body; // Array de { id: string, pesoReal: number }
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores o administradores pueden registrar pesajes', 403);
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

    if (manifiesto.estado !== 'ENTREGADO') {
      throw new AppError('El manifiesto debe estar entregado para registrar pesaje', 400);
    }

    // Validar input
    if (!residuosPesados || !Array.isArray(residuosPesados)) {
      throw new AppError('Formato de residuos incorrecto', 400);
    }

    let pesoDeclaradoTotal = 0;
    let pesoRealTotal = 0;

    // Actualizar cada residuo en una transacción
    await prisma.$transaction(
      residuosPesados.map((item: any) => {
        const residuoOriginal = manifiesto.residuos.find(r => r.id === item.id);
        if (!residuoOriginal) return prisma.manifiestoResiduo.findMany({ where: { id: 'dummy' } }); // Skip invalid IDs safely? or throw.

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
    // Verificar que sea transportista u operador o admin
    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Endpoint disponible solo para transportistas, operadores y administradores', 403);
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
    if ((req.user.rol !== 'OPERADOR' || !req.user.operador) && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores o administradores pueden acceder a esta función', 403);
    }

    // Obtener manifiestos que están en camino o ya llegaron (pendientes de recepción)
    const esperados = await prisma.manifiesto.findMany({
      where: {
        operadorId: req.user.operador.id,
        estado: { in: ['EN_TRANSITO', 'ENTREGADO'] }
      },
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

// Validar QR de manifiesto (para validación offline/online) - CU-T08
export const validarQR = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Aceptar tanto qrData como qrCode para compatibilidad
    const qrData = req.body.qrData || req.body.qrCode;

    if (!qrData) {
      throw new AppError('Datos de QR requeridos (qrData o qrCode)', 400);
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
