/**
 * Controller para funciones de DEMO
 * Permite cambio de perfiles para pruebas sin logout/login
 */
import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { isDemoEnvironment } from '../config/config';
import { AppErrorWithCode, ERROR_CODES, getRoleName } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * Verificar si el modo demo está habilitado
 */
export const getDemoStatus = async (req: AuthRequest, res: Response) => {
  const enabled = isDemoEnvironment();

  res.json({
    success: true,
    data: {
      demoEnabled: enabled,
      currentUser: {
        id: req.user.id,
        email: req.user.email,
        rol: req.user.rol,
        rolName: getRoleName(req.user.rol)
      },
      demoProfile: req.demoProfile || null
    }
  });
};

/**
 * Obtener todos los perfiles disponibles para cambio en modo demo
 */
export const getAvailableProfiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verificar que demo mode está habilitado
    if (!isDemoEnvironment()) {
      throw new AppErrorWithCode(ERROR_CODES.FORBIDDEN_DEMO_MODE_PROD);
    }

    // Obtener todos los actores de cada tipo
    const [generadores, transportistas, operadores] = await Promise.all([
      prisma.generador.findMany({
        where: { activo: true },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true
        },
        orderBy: { razonSocial: 'asc' },
        take: 50
      }),
      prisma.transportista.findMany({
        where: { activo: true },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          numeroHabilitacion: true
        },
        orderBy: { razonSocial: 'asc' },
        take: 50
      }),
      prisma.operador.findMany({
        where: { activo: true },
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true
        },
        orderBy: { razonSocial: 'asc' },
        take: 50
      })
    ]);

    res.json({
      success: true,
      data: {
        currentProfile: {
          id: req.user.id,
          email: req.user.email,
          rol: req.user.rol,
          rolName: getRoleName(req.user.rol),
          actor: req.user.generador || req.user.transportista || req.user.operador || null
        },
        demoProfile: req.demoProfile || null,
        availableRoles: [
          {
            role: 'ADMIN',
            name: 'Administrador DGFA',
            description: 'Control total del sistema',
            actors: [] // Admin no tiene actores
          },
          {
            role: 'GENERADOR',
            name: 'Generador de Residuos',
            description: 'Crea y firma manifiestos',
            actors: generadores.map(g => ({
              id: g.id,
              name: g.razonSocial,
              cuit: g.cuit,
              detail: g.categoria || 'Sin categoría'
            }))
          },
          {
            role: 'TRANSPORTISTA',
            name: 'Transportista',
            description: 'Retira y entrega residuos',
            actors: transportistas.map(t => ({
              id: t.id,
              name: t.razonSocial,
              cuit: t.cuit,
              detail: t.numeroHabilitacion || 'Sin habilitación'
            }))
          },
          {
            role: 'OPERADOR',
            name: 'Operador de Tratamiento',
            description: 'Recibe, pesa y trata residuos',
            actors: operadores.map(o => ({
              id: o.id,
              name: o.razonSocial,
              cuit: o.cuit,
              detail: o.categoria || 'Sin categoría'
            }))
          }
        ],
        instructions: {
          howToUse: 'Para cambiar de perfil, envía el header X-Demo-Profile con el formato JSON',
          headerName: 'X-Demo-Profile',
          headerFormat: '{"role": "OPERADOR", "actorId": "uuid-del-actor"}',
          example: {
            asGenerador: '{"role": "GENERADOR", "actorId": "' + (generadores[0]?.id || 'uuid') + '"}',
            asTransportista: '{"role": "TRANSPORTISTA", "actorId": "' + (transportistas[0]?.id || 'uuid') + '"}',
            asOperador: '{"role": "OPERADOR", "actorId": "' + (operadores[0]?.id || 'uuid') + '"}'
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar actores por rol con búsqueda de texto
 * Permite buscar en todos los actores sin límite de 50
 */
export const searchActors = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isDemoEnvironment()) {
      throw new AppErrorWithCode(ERROR_CODES.FORBIDDEN_DEMO_MODE_PROD);
    }

    const { role, q = '', limit = '50' } = req.query;
    const searchTerm = (q as string).trim();
    const take = Math.min(parseInt(limit as string) || 50, 100); // Max 100 por request

    if (!role || !['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(role as string)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Rol requerido: GENERADOR, TRANSPORTISTA u OPERADOR' }
      });
    }

    let actors: any[] = [];

    const whereClause = {
      activo: true,
      ...(searchTerm ? {
        OR: [
          { razonSocial: { contains: searchTerm, mode: 'insensitive' as const } },
          { cuit: { contains: searchTerm } }
        ]
      } : {})
    };

    if (role === 'GENERADOR') {
      const results = await prisma.generador.findMany({
        where: whereClause,
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true
        },
        orderBy: { razonSocial: 'asc' },
        take
      });
      actors = results.map(g => ({
        id: g.id,
        name: g.razonSocial,
        cuit: g.cuit,
        detail: g.categoria || 'Sin categoría'
      }));
    } else if (role === 'TRANSPORTISTA') {
      const results = await prisma.transportista.findMany({
        where: whereClause,
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          numeroHabilitacion: true
        },
        orderBy: { razonSocial: 'asc' },
        take
      });
      actors = results.map(t => ({
        id: t.id,
        name: t.razonSocial,
        cuit: t.cuit,
        detail: t.numeroHabilitacion || 'Sin habilitación'
      }));
    } else if (role === 'OPERADOR') {
      const results = await prisma.operador.findMany({
        where: whereClause,
        select: {
          id: true,
          razonSocial: true,
          cuit: true,
          categoria: true
        },
        orderBy: { razonSocial: 'asc' },
        take
      });
      actors = results.map(o => ({
        id: o.id,
        name: o.razonSocial,
        cuit: o.cuit,
        detail: o.categoria || 'Sin categoría'
      }));
    }

    // Obtener total para mostrar si hay más resultados
    let total = 0;
    if (role === 'GENERADOR') {
      total = await prisma.generador.count({ where: whereClause });
    } else if (role === 'TRANSPORTISTA') {
      total = await prisma.transportista.count({ where: whereClause });
    } else if (role === 'OPERADOR') {
      total = await prisma.operador.count({ where: whereClause });
    }

    res.json({
      success: true,
      data: {
        actors,
        total,
        hasMore: total > take,
        searchTerm: searchTerm || null
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validar un perfil demo antes de usarlo
 */
export const validateDemoProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!isDemoEnvironment()) {
      throw new AppErrorWithCode(ERROR_CODES.FORBIDDEN_DEMO_MODE_PROD);
    }

    const { role, actorId } = req.body;

    if (!role) {
      return res.status(400).json({
        success: false,
        error: { message: 'Se requiere especificar un rol' }
      });
    }

    // Validar que el rol existe
    const validRoles = ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: { message: `Rol inválido. Usar: ${validRoles.join(', ')}` }
      });
    }

    // Si no es ADMIN, validar el actor
    let actor = null;
    if (role !== 'ADMIN' && actorId) {
      if (role === 'GENERADOR') {
        actor = await prisma.generador.findUnique({
          where: { id: actorId },
          select: { id: true, razonSocial: true, activo: true }
        });
      } else if (role === 'TRANSPORTISTA') {
        actor = await prisma.transportista.findUnique({
          where: { id: actorId },
          select: { id: true, razonSocial: true, activo: true }
        });
      } else if (role === 'OPERADOR') {
        actor = await prisma.operador.findUnique({
          where: { id: actorId },
          select: { id: true, razonSocial: true, activo: true }
        });
      }

      if (!actor) {
        return res.status(404).json({
          success: false,
          error: { message: `${getRoleName(role)} no encontrado con ID: ${actorId}` }
        });
      }

      if (!actor.activo) {
        return res.status(400).json({
          success: false,
          error: { message: `${actor.razonSocial} no está activo` }
        });
      }
    }

    // Generar el header que debe usar el frontend
    const profileHeader = JSON.stringify({ role, actorId });

    res.json({
      success: true,
      data: {
        valid: true,
        profile: {
          role,
          roleName: getRoleName(role),
          actor: actor ? {
            id: actor.id,
            name: actor.razonSocial
          } : null
        },
        headerToUse: {
          name: 'X-Demo-Profile',
          value: profileHeader
        },
        message: actor
          ? `Perfil válido: ${getRoleName(role)} - ${actor.razonSocial}`
          : `Perfil válido: ${getRoleName(role)}`
      }
    });
  } catch (error) {
    next(error);
  }
};
