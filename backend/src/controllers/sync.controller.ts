import { Request, Response } from 'express';
import { PrismaClient, EstadoManifiesto } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Tipo de conflicto detectado
 */
interface SyncConflict {
  manifiestoId: string;
  field: string;
  clientValue: any;
  serverValue: any;
  serverTimestamp: Date;
  resolution: 'SERVER_WINS' | 'CLIENT_WINS' | 'MERGED';
}

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
  },

  /**
   * GET /api/sync/status
   * Verificar estado de sincronización del usuario
   */
  async getSyncStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.rol;

      // Contar operaciones pendientes en el servidor
      let pendingCount = 0;
      let lastSyncInfo = null;

      if (userRole === 'TRANSPORTISTA') {
        pendingCount = await prisma.manifiesto.count({
          where: {
            transportista: { usuarioId: userId },
            estado: { in: [EstadoManifiesto.APROBADO, EstadoManifiesto.EN_TRANSITO] }
          }
        });
      } else if (userRole === 'OPERADOR') {
        pendingCount = await prisma.manifiesto.count({
          where: {
            operador: { usuarioId: userId },
            estado: { in: [EstadoManifiesto.EN_TRANSITO, EstadoManifiesto.ENTREGADO] }
          }
        });
      }

      // Verificar última actividad del usuario
      const lastActivity = await prisma.eventoManifiesto.findFirst({
        where: { usuarioId: userId },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        status: 'OK',
        serverTime: new Date().toISOString(),
        pendingManifiestos: pendingCount,
        lastServerActivity: lastActivity?.createdAt || null,
        syncRecommended: pendingCount > 0
      });
    } catch (error) {
      console.error('Error obteniendo estado de sync:', error);
      res.status(500).json({ error: 'Error al verificar estado' });
    }
  },

  /**
   * POST /api/sync/resolve-conflicts
   * Resolver conflictos de sincronización con strategy server-wins
   */
  async resolveConflicts(req: Request, res: Response) {
    try {
      const { conflicts } = req.body;
      const userId = (req as any).user?.id;

      if (!Array.isArray(conflicts)) {
        return res.status(400).json({ error: 'conflicts debe ser un array' });
      }

      const resolutions: SyncConflict[] = [];

      for (const conflict of conflicts) {
        const { manifiestoId, clientData, clientTimestamp } = conflict;

        // Obtener datos actuales del servidor
        const serverManifiesto = await prisma.manifiesto.findUnique({
          where: { id: manifiestoId },
          include: { eventos: { orderBy: { createdAt: 'desc' }, take: 1 } }
        });

        if (!serverManifiesto) {
          resolutions.push({
            manifiestoId,
            field: 'manifiesto',
            clientValue: clientData,
            serverValue: null,
            serverTimestamp: new Date(),
            resolution: 'CLIENT_WINS' // Manifiesto no existe en servidor, aceptar cliente
          });
          continue;
        }

        const serverTimestamp = serverManifiesto.updatedAt;
        const clientTs = new Date(clientTimestamp);

        // Strategy: SERVER_WINS si el servidor tiene cambios más recientes
        if (serverTimestamp > clientTs) {
          // El servidor tiene la versión más reciente
          resolutions.push({
            manifiestoId,
            field: 'estado',
            clientValue: clientData.estado,
            serverValue: serverManifiesto.estado,
            serverTimestamp,
            resolution: 'SERVER_WINS'
          });

          // Registrar el conflicto resuelto
          await prisma.eventoManifiesto.create({
            data: {
              manifiestoId,
              tipo: 'CONFLICT_RESOLVED',
              descripcion: `Conflicto resuelto: servidor ganó. Cliente tenía estado ${clientData.estado}, servidor tiene ${serverManifiesto.estado}`,
              usuarioId: userId
            }
          });
        } else {
          // El cliente tiene cambios más recientes, aplicarlos
          await prisma.manifiesto.update({
            where: { id: manifiestoId },
            data: {
              estado: clientData.estado as EstadoManifiesto,
              observaciones: clientData.observaciones || serverManifiesto.observaciones,
              updatedAt: new Date()
            }
          });

          resolutions.push({
            manifiestoId,
            field: 'estado',
            clientValue: clientData.estado,
            serverValue: serverManifiesto.estado,
            serverTimestamp,
            resolution: 'CLIENT_WINS'
          });

          await prisma.eventoManifiesto.create({
            data: {
              manifiestoId,
              tipo: 'CONFLICT_RESOLVED',
              descripcion: `Conflicto resuelto: cliente ganó. Actualizado a estado ${clientData.estado}`,
              usuarioId: userId
            }
          });
        }
      }

      res.json({
        success: true,
        syncTimestamp: new Date().toISOString(),
        resolutions,
        summary: {
          total: resolutions.length,
          serverWins: resolutions.filter(r => r.resolution === 'SERVER_WINS').length,
          clientWins: resolutions.filter(r => r.resolution === 'CLIENT_WINS').length
        }
      });
    } catch (error) {
      console.error('Error resolviendo conflictos:', error);
      res.status(500).json({ error: 'Error al resolver conflictos' });
    }
  },

  /**
   * POST /api/sync/batch
   * Sincronización en lote con detección automática de conflictos
   */
  async batchSync(req: Request, res: Response) {
    try {
      const { operations, lastSyncTimestamp } = req.body;
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.rol;

      const lastSync = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);

      const results = {
        uploaded: { success: 0, failed: 0, conflicts: [] as any[] },
        downloaded: { manifiestos: [] as any[], tiposResiduos: [] as any[] },
        conflicts: [] as SyncConflict[],
        nextSyncTimestamp: new Date().toISOString()
      };

      // 1. Procesar operaciones del cliente (upload)
      if (Array.isArray(operations)) {
        for (const op of operations) {
          try {
            // Verificar si hay conflicto
            if (op.data?.manifiestoId) {
              const serverManifiesto = await prisma.manifiesto.findUnique({
                where: { id: op.data.manifiestoId }
              });

              if (serverManifiesto && serverManifiesto.updatedAt > new Date(op.timestamp)) {
                // Conflicto detectado - servidor más reciente
                results.conflicts.push({
                  manifiestoId: op.data.manifiestoId,
                  field: 'estado',
                  clientValue: op.data,
                  serverValue: serverManifiesto.estado,
                  serverTimestamp: serverManifiesto.updatedAt,
                  resolution: 'SERVER_WINS'
                });
                results.uploaded.conflicts.push({
                  operation: op,
                  reason: 'Server has newer version'
                });
                continue;
              }
            }

            // Procesar operación
            switch (op.type) {
              case 'UPDATE_LOCATION':
                await prisma.trackingGPS.create({
                  data: {
                    manifiestoId: op.data.manifiestoId,
                    latitud: op.data.latitud,
                    longitud: op.data.longitud,
                    velocidad: op.data.velocidad || null,
                    timestamp: new Date(op.timestamp)
                  }
                });
                results.uploaded.success++;
                break;

              case 'CONFIRM_PICKUP':
                await prisma.manifiesto.update({
                  where: { id: op.data.manifiestoId },
                  data: {
                    estado: EstadoManifiesto.EN_TRANSITO,
                    fechaRetiro: new Date(op.timestamp)
                  }
                });
                results.uploaded.success++;
                break;

              case 'CONFIRM_DELIVERY':
                await prisma.manifiesto.update({
                  where: { id: op.data.manifiestoId },
                  data: {
                    estado: EstadoManifiesto.ENTREGADO,
                    fechaEntrega: new Date(op.timestamp)
                  }
                });
                results.uploaded.success++;
                break;

              case 'REGISTER_INCIDENT':
                await prisma.eventoManifiesto.create({
                  data: {
                    manifiestoId: op.data.manifiestoId,
                    tipo: 'INCIDENTE',
                    descripcion: op.data.descripcion,
                    latitud: op.data.latitud,
                    longitud: op.data.longitud,
                    usuarioId: userId
                  }
                });
                results.uploaded.success++;
                break;

              default:
                results.uploaded.failed++;
            }
          } catch (error) {
            results.uploaded.failed++;
          }
        }
      }

      // 2. Obtener cambios del servidor (download)
      let whereClause: any = { updatedAt: { gt: lastSync } };

      if (userRole === 'TRANSPORTISTA') {
        whereClause.transportista = { usuarioId: userId };
      } else if (userRole === 'OPERADOR') {
        whereClause.operador = { usuarioId: userId };
      } else if (userRole === 'GENERADOR') {
        whereClause.generador = { usuarioId: userId };
      }

      results.downloaded.manifiestos = await prisma.manifiesto.findMany({
        where: whereClause,
        include: {
          generador: { select: { id: true, razonSocial: true, cuit: true } },
          transportista: { select: { id: true, razonSocial: true } },
          operador: { select: { id: true, razonSocial: true } },
          residuos: { include: { tipoResiduo: true } }
        }
      });

      // Incluir catálogo si hay actualizaciones
      const tiposActualizados = await prisma.tipoResiduo.findMany({
        where: { updatedAt: { gt: lastSync }, activo: true }
      });
      if (tiposActualizados.length > 0) {
        results.downloaded.tiposResiduos = tiposActualizados;
      }

      res.json({
        success: true,
        ...results
      });
    } catch (error) {
      console.error('Error en batch sync:', error);
      res.status(500).json({ error: 'Error en sincronización por lotes' });
    }
  }
};

export default syncController;
