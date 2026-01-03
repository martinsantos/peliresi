import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import { AuthRequest } from '../middlewares/auth.middleware';
import loggerService from '../services/logger.service';
import pushService from '../services/push.service';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/registro/solicitar
 * Solicitar alta de usuario (público, no requiere autenticación)
 */
router.post('/solicitar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, nombre, apellido, telefono, empresa, cuit, rol, motivoSolicitud } = req.body;

    // Validaciones básicas
    if (!email || !password || !nombre || !rol) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, nombre y rol son requeridos',
      });
    }

    // Verificar si el email ya existe
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      return res.status(400).json({
        success: false,
        error: 'El email ya está registrado',
      });
    }

    // Verificar CUIT único si se proporciona
    if (cuit) {
      const cuitExiste = await prisma.usuario.findFirst({ where: { cuit } });
      if (cuitExiste) {
        return res.status(400).json({
          success: false,
          error: 'El CUIT ya está registrado',
        });
      }
    }

    // Hash de contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear usuario con aprobado = false
    const usuario = await prisma.usuario.create({
      data: {
        email,
        password: hashedPassword,
        nombre,
        apellido,
        telefono,
        empresa,
        cuit,
        rol: rol as any,
        activo: false,
        aprobado: false,
        fechaSolicitud: new Date(),
        motivoSolicitud,
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        fechaSolicitud: true,
      },
    });

    // Notificar a admins
    await pushService.sendToRole('ADMIN', {
      title: '👤 Nueva Solicitud de Alta',
      body: `${nombre} ${apellido || ''} solicita acceso como ${rol}`,
      tag: 'solicitud-alta',
      data: { url: '/admin/usuarios/pendientes' },
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud enviada. Recibirá una notificación cuando sea aprobada.',
      data: { usuario },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/usuarios/pendientes
 * Listar usuarios pendientes de aprobación (solo admin)
 */
router.get('/admin/usuarios/pendientes', isAuthenticated, hasRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const pendientes = await prisma.usuario.findMany({
      where: { aprobado: false },
      select: {
        id: true,
        email: true,
        nombre: true,
        apellido: true,
        rol: true,
        empresa: true,
        cuit: true,
        telefono: true,
        fechaSolicitud: true,
        motivoSolicitud: true,
      },
      orderBy: { fechaSolicitud: 'desc' },
    });

    res.json({
      success: true,
      data: {
        pendientes,
        total: pendientes.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/usuarios/:id/aprobar
 * Aprobar usuario (solo admin)
 */
router.post('/admin/usuarios/:id/aprobar', isAuthenticated, hasRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        aprobado: true,
        activo: true,
        fechaAprobacion: new Date(),
        aprobadoPorId: req.user!.id,
      },
    });

    // Registrar en log de actividad
    await loggerService.registrar({
      usuarioId: req.user!.id,
      accion: 'APROBAR_USUARIO',
      modulo: 'USUARIOS',
      entidadId: id,
      detalles: { email: usuario.email, rol: usuario.rol },
      req,
    });

    // Notificar al usuario aprobado
    await pushService.sendToUser(id, {
      title: '✅ Solicitud Aprobada',
      body: 'Su cuenta ha sido activada. Ya puede iniciar sesión.',
      tag: 'aprobacion',
    });

    res.json({
      success: true,
      message: 'Usuario aprobado correctamente',
      data: { usuario: { id: usuario.id, email: usuario.email } },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/usuarios/:id/rechazar
 * Rechazar usuario (solo admin)
 */
router.post('/admin/usuarios/:id/rechazar', isAuthenticated, hasRole('ADMIN'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    const usuario = await prisma.usuario.update({
      where: { id },
      data: {
        aprobado: false,
        activo: false,
        motivoRechazo: motivo || 'Solicitud rechazada por el administrador',
      },
    });

    // Registrar en log
    await loggerService.registrar({
      usuarioId: req.user!.id,
      accion: 'RECHAZAR_USUARIO',
      modulo: 'USUARIOS',
      entidadId: id,
      detalles: { email: usuario.email, motivo },
      req,
    });

    res.json({
      success: true,
      message: 'Usuario rechazado',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
