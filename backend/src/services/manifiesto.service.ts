import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { config } from '../config/config';
import { signatureService } from './signature.service';
import { wsService, WS_EVENTS } from '../lib/websocket';
import { redisService } from '../lib/redis';

export class ManifiestoService {
  /**
   * Generar número de manifiesto único (Formato: AAAA-000001)
   */
  async generarNumeroManifiesto(): Promise<string> {
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

    let numeroNum = 1;
    if (ultimoManifiesto) {
      const ultimoNumeroStr = ultimoManifiesto.numero.split('-')[1];
      numeroNum = parseInt(ultimoNumeroStr) + 1;
    }

    return `${año}-${numeroNum.toString().padStart(6, '0')}`;
  }

  /**
   * Obtener manifiestos con filtros y paginación
   */
  async getManifiestos(filters: {
    estado?: string;
    generadorId?: string;
    transportistaId?: string;
    operadorId?: string;
    page?: number;
    limit?: number;
  }) {
    const { estado, generadorId, transportistaId, operadorId, page = 1, limit = 10 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (estado) where.estado = estado;
    if (generadorId) where.generadorId = generadorId;
    if (transportistaId) where.transportistaId = transportistaId;
    if (operadorId) where.operadorId = operadorId;

    const [manifiestos, total] = await Promise.all([
      prisma.manifiesto.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          generador: true,
          transportista: true,
          operador: true,
          residuos: {
            include: { tipoResiduo: true }
          },
          eventos: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      }),
      prisma.manifiesto.count({ where })
    ]);

    return {
      manifiestos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Obtener manifiesto detallado por ID
   */
  async getManifiestoById(id: string) {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        generador: true,
        transportista: { include: { vehiculos: true, choferes: true } },
        operador: true,
        residuos: { include: { tipoResiduo: true } },
        eventos: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: { select: { nombre: true, apellido: true, rol: true } }
          }
        },
        tracking: { orderBy: { timestamp: 'desc' }, take: 100 }
      }
    });

    if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
    return manifiesto;
  }

  /**
   * Crear nuevo manifiesto (Borrador)
   */
  async createManifiesto(data: {
    transportistaId: string;
    operadorId: string;
    residuos: any[];
    observaciones?: string;
    generadorId: string;
    userId: string;
  }) {
    const numero = await this.generarNumeroManifiesto();

    const manifiesto = await prisma.manifiesto.create({
      data: {
        numero,
        generadorId: data.generadorId,
        transportistaId: data.transportistaId,
        operadorId: data.operadorId,
        observaciones: data.observaciones,
        estado: 'BORRADOR',
        creadoPorId: data.userId,
        residuos: {
          create: data.residuos.map((r: any) => ({
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
        residuos: { include: { tipoResiduo: true } }
      }
    });

    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: manifiesto.id,
        tipo: 'CREACION',
        descripcion: 'Manifiesto creado',
        usuarioId: data.userId
      }
    });

    return manifiesto;
  }

  /**
   * Firmar digitalmente un manifiesto y generar QR
   */
  async firmarManifiesto(id: string, usuario: { id: string; nombre: string; apellido?: string; email: string; cuit?: string }) {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        generador: true,
        residuos: { include: { tipoResiduo: true } }
      }
    });

    if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
    if (manifiesto.estado !== 'BORRADOR') throw new AppError('Solo se pueden firmar manifiestos en estado borrador', 400);

    const contenidoFirma = JSON.stringify({
      numero: manifiesto.numero,
      generador: manifiesto.generador.razonSocial,
      fecha: new Date().toISOString(),
      residuos: manifiesto.residuos.map(r => ({
        tipo: r.tipoResiduo.nombre,
        cantidad: r.cantidad
      }))
    });

    const firmaDigital = signatureService.firmar(contenidoFirma, {
      nombre: `${usuario.nombre} ${usuario.apellido || ''}`.trim(),
      email: usuario.email,
      cuit: usuario.cuit || undefined
    });

    const baseUrl = config.CORS_ORIGIN.split(',')[0].trim();
    const verificationUrl = `${baseUrl}/verify/${manifiesto.id}`;
    
    let qrCode = '';
    try {
      qrCode = await QRCode.toDataURL(verificationUrl);
    } catch (qrErr) {
      qrCode = `data:text/plain;base64,${Buffer.from(verificationUrl).toString('base64')}`;
    }

    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
      data: {
        estado: 'APROBADO',
        fechaFirma: new Date(),
        qrCode,
        firmaDigital: firmaDigital as any
      },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        residuos: { include: { tipoResiduo: true } }
      }
    });

    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'FIRMA',
        descripcion: `Manifiesto firmado digitalmente. Certificado: ${firmaDigital.certificadoSerial}`,
        usuarioId: usuario.id
      }
    });

    return {
      manifiesto: manifiestoActualizado,
      firma: signatureService.formatearParaMostrar(firmaDigital)
    };
  }

  /**
   * Métodos de transición de estado
   */
  async updateEstado(id: string, nuevoEstado: any, userId: string, eventoTipo: any, descripcion: string) {
    const manifiesto = await prisma.manifiesto.update({
      where: { id },
      data: { estado: nuevoEstado, ...this.getFechaCampo(nuevoEstado) },
      include: {
        generador: { include: { usuario: { select: { id: true } } } },
        transportista: { include: { usuario: { select: { id: true } } } },
        operador: { include: { usuario: { select: { id: true } } } }
      }
    });

    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: eventoTipo,
        descripcion,
        usuarioId: userId
      }
    });

    // WEBSOCKET: Notificar cambio de estado en tiempo real
    wsService.notifyManifiestoEstadoChanged(
      id,
      nuevoEstado,
      manifiesto.numero,
      {
        generadorUserId: manifiesto.generador.usuario?.id,
        transportistaUserId: manifiesto.transportista.usuario?.id,
        operadorUserId: manifiesto.operador.usuario?.id
      }
    );

    // CACHE: Invalidar caché del manifiesto y stats
    await redisService.invalidateManifiesto(id);

    return manifiesto;
  }

  private getFechaCampo(estado: string): any {
    if (estado === 'ENTREGADO') return { fechaEntrega: new Date() };
    if (estado === 'RECIBIDO') return { fechaRecepcion: new Date() };
    if (estado === 'TRATADO') return { fechaCierre: new Date() };
    return {};
  }
}

export const manifiestoService = new ManifiestoService();
