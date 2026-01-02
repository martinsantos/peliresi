import { Request, Response } from 'express';
import { PrismaClient, EstadoManifiesto } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Controlador para sincronización offline (CU-S05)
 * Permite a las apps móviles trabajar sin conexión y sincronizar después
 */
export const syncController = {
  /**
   * GET /api/sync/initial
   * Descarga inicial de datos para cache offline del usuario
   */
  async getInitialSync(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.rol;

      // Catálogo de tipos de residuos (siempre necesario)
      const tiposResiduos = await prisma.tipoResiduo.findMany({
        where: { activo: true }
      });

      // Manifiestos relevantes según rol
      let manifiestos: any[] = [];
      
      if (userRole === 'TRANSPORTISTA') {
        // Manifiestos asignados al transportista
        manifiestos = await prisma.manifiesto.findMany({
          where: {
            transportista: { usuarioId: userId },
            estado: { in: [EstadoManifiesto.APROBADO, EstadoManifiesto.EN_TRANSITO] }
          },
          include: {
            generador: true,
            operador: true,
            residuos: { include: { tipoResiduo: true } },
            eventos: { orderBy: { createdAt: 'desc' }, take: 5 }
          }
        });
      } else if (userRole === 'OPERADOR') {
        // Manifiestos en camino al operador
        manifiestos = await prisma.manifiesto.findMany({
          where: {
            operador: { usuarioId: userId },
            estado: { in: [EstadoManifiesto.EN_TRANSITO, EstadoManifiesto.ENTREGADO] }
          },
          include: {
            generador: true,
            transportista: true,
            residuos: { include: { tipoResiduo: true } }
          }
        });
      } else if (userRole === 'GENERADOR') {
        // Manifiestos recientes del generador
        manifiestos = await prisma.manifiesto.findMany({
          where: { generador: { usuarioId: userId } },
          orderBy: { fechaCreacion: 'desc' },
          take: 50,
          include: {
            transportista: true,
            operador: true,
            residuos: { include: { tipoResiduo: true } }
          }
        });
      }

      res.json({
        syncTimestamp: new Date().toISOString(),
        tiposResiduos,
        manifiestos,
        version: '1.0'
      });
    } catch (error) {
      console.error('Error en sync inicial:', error);
      res.status(500).json({ error: 'Error al sincronizar datos' });
    }
  },

  /**
   * POST /api/sync/upload
   * Subir operaciones realizadas offline
   */
  async uploadOfflineOperations(req: Request, res: Response) {
    try {
      const { operations } = req.body;
      const userId = (req as any).user?.id;
      
      if (!Array.isArray(operations)) {
        return res.status(400).json({ error: 'operations debe ser un array' });
      }

      const results = {
        processed: 0,
        success: 0,
        errors: [] as Array<{ index: number; error: string }>
      };

      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        results.processed++;

        try {
          switch (op.type) {
            case 'UPDATE_LOCATION':
              // Actualizar ubicación GPS de transporte
              await prisma.trackingGPS.create({
                data: {
                  manifiestoId: op.data.manifiestoId,
                  latitud: op.data.latitud,
                  longitud: op.data.longitud,
                  velocidad: op.data.velocidad || null,
                  timestamp: new Date(op.timestamp)
                }
              });
              results.success++;
              break;

            case 'CONFIRM_PICKUP':
              // Confirmar retiro de carga
              await prisma.manifiesto.update({
                where: { id: op.data.manifiestoId },
                data: {
                  estado: EstadoManifiesto.EN_TRANSITO,
                  fechaRetiro: new Date(op.timestamp)
                }
              });
              await prisma.eventoManifiesto.create({
                data: {
                  manifiestoId: op.data.manifiestoId,
                  tipo: 'RETIRO_CONFIRMADO',
                  descripcion: op.data.observaciones || 'Retiro confirmado (offline)',
                  usuarioId: userId
                }
              });
              results.success++;
              break;

            case 'CONFIRM_DELIVERY':
              // Confirmar entrega
              await prisma.manifiesto.update({
                where: { id: op.data.manifiestoId },
                data: {
                  estado: EstadoManifiesto.ENTREGADO,
                  fechaEntrega: new Date(op.timestamp)
                }
              });
              await prisma.eventoManifiesto.create({
                data: {
                  manifiestoId: op.data.manifiestoId,
                  tipo: 'ENTREGA_CONFIRMADA',
                  descripcion: op.data.observaciones || 'Entrega confirmada (offline)',
                  usuarioId: userId
                }
              });
              results.success++;
              break;

            default:
              results.errors.push({ index: i, error: `Tipo de operación desconocido: ${op.type}` });
          }
        } catch (error) {
          results.errors.push({ index: i, error: (error as Error).message });
        }
      }

      res.json({
        syncTimestamp: new Date().toISOString(),
        results
      });
    } catch (error) {
      console.error('Error procesando operaciones offline:', error);
      res.status(500).json({ error: 'Error al procesar operaciones' });
    }
  },

  /**
   * GET /api/sync/changes
   * Obtener cambios desde última sincronización
   */
  async getChangesSince(req: Request, res: Response) {
    try {
      const { since } = req.query;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.rol;

      const sinceDate = since ? new Date(since as string) : new Date(0);

      // Manifiestos modificados desde última sync
      let whereClause: any = { updatedAt: { gt: sinceDate } };
      
      if (userRole === 'TRANSPORTISTA') {
        whereClause.transportista = { usuarioId: userId };
      } else if (userRole === 'OPERADOR') {
        whereClause.operador = { usuarioId: userId };
      } else if (userRole === 'GENERADOR') {
        whereClause.generador = { usuarioId: userId };
      }

      const manifiestos = await prisma.manifiesto.findMany({
        where: whereClause,
        include: {
          generador: true,
          transportista: true,
          operador: true,
          residuos: { include: { tipoResiduo: true } }
        }
      });

      res.json({
        syncTimestamp: new Date().toISOString(),
        changes: {
          manifiestos
        }
      });
    } catch (error) {
      console.error('Error obteniendo cambios:', error);
      res.status(500).json({ error: 'Error al obtener cambios' });
    }
  }
};

export default syncController;
