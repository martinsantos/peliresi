import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { StringValue } from 'ms';
import { z } from 'zod';
import { config } from '../config/config';
import { AppError } from '../middlewares/errorHandler';
import prisma from '../lib/prisma';
import { emailService } from '../services/email.service';
import { validatePasswordStrength } from '../utils/passwordStrength';

// CUIT normalization: accepts "30711235961" or "30-71123596-1" → "30-71123596-1"
function normalizeCuit(raw: string): string | null {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 11) return null;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

// Zod schemas
const loginSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  cuit: z.string().optional(),
  password: z.string().min(1, 'La contraseña es requerida'),
}).refine(d => d.email || d.cuit, { message: 'Ingresá email o CUIT' });

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
  rol: z.enum(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR']),
  // ADMIN solo puede asignarse desde el panel de administración, nunca por auto-registro
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().optional(),
  empresa: z.string().optional(),
  telefono: z.string().optional(),
  cuit: z.string().optional(),
});

// Generar tokens JWT
export const generateTokens = (userId: string, restricted = false) => {
  const payload: Record<string, unknown> = { id: userId };
  if (restricted) payload.restricted = true;
  const options: SignOptions = { expiresIn: config.JWT_EXPIRES_IN as StringValue };
  const accessToken = jwt.sign(payload, config.JWT_SECRET as string, options);
  const refreshOptions: SignOptions = { expiresIn: config.JWT_REFRESH_EXPIRES_IN as StringValue };
  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET as string, refreshOptions);
  return { accessToken, refreshToken };
};

// ── REGISTER (público) ─────────────────────────────────────────────
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const { email, password, rol, nombre, apellido, empresa, telefono, cuit } = parsed.data;

    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new AppError(passwordError, 400);

    // Multi-rol: si el CUIT ya existe con el mismo email, reusar el usuario
    const normalizedCuit = cuit ? (normalizeCuit(cuit) || cuit) : undefined;
    const existingByCuit = normalizedCuit ? await prisma.usuario.findUnique({ where: { cuit: normalizedCuit } }) : null;
    const existingByEmail = await prisma.usuario.findUnique({ where: { email } });

    let user: { id: string; email: string; rol: string; nombre: string };
    let isMultiRol = false;

    if (existingByCuit && existingByEmail && existingByCuit.id === existingByEmail.id) {
      // Mismo CUIT y mismo email → multi-rol legítimo
      isMultiRol = true;
      user = { id: existingByCuit.id, email: existingByCuit.email, rol, nombre: existingByCuit.nombre };
    } else if (existingByCuit) {
      // CUIT existe con otro email
      throw new AppError('El CUIT ya está registrado con otro correo electrónico', 400);
    } else if (existingByEmail) {
      // Email existe con otro CUIT
      throw new AppError('El correo electrónico ya está en uso', 400);
    } else {
      // Usuario nuevo
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const created = await prisma.usuario.create({
        data: {
          email,
          password: hashedPassword,
          rol,
          nombre,
          apellido,
          empresa,
          telefono,
          cuit: normalizedCuit || cuit,
          activo: false,
          emailVerified: false,
          emailVerificationToken: hashedToken,
        },
        select: { id: true, email: true, rol: true, nombre: true },
      });
      user = created;

      // Enviar email de verificación solo a usuarios nuevos
      await emailService.sendEmailVerification(email, nombre, rawToken);
    }

    // Auditoría de registro
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: user.id,
          accion: isMultiRol ? 'REGISTRO_MULTI_ROL' : 'REGISTRO',
          modulo: 'AUTH',
          ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          datosDespues: JSON.stringify({ nombre: user.nombre, email: user.email, rol, isMultiRol, timestamp: new Date().toISOString() }),
        },
      });
    } catch { /* ignore audit errors */ }

    res.status(201).json({
      success: true,
      message: isMultiRol
        ? 'Solicitud de nuevo perfil registrada. Pendiente de aprobación del administrador.'
        : 'Revisá tu email para verificar tu cuenta.',
    });
  } catch (error) {
    next(error);
  }
};

// ── VERIFY EMAIL (público) ─────────────────────────────────────────
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') throw new AppError('Token inválido', 400);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.usuario.findFirst({
      where: { emailVerificationToken: hashedToken },
    });

    if (!user) throw new AppError('Token inválido o expirado', 400);

    // Verificar expiración (24h desde creación — usamos updatedAt como proxy)
    const hoursElapsed = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 24) {
      throw new AppError('El enlace de verificación expiró. Contactá al administrador.', 400);
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });

    // Notificar al usuario que falta aprobación admin
    await emailService.sendRegistroPendienteEmail(user.email, user.nombre, user.rol);

    // Notificación in-app + email a todos los ADMIN activos
    const admins = await prisma.usuario.findMany({
      where: { rol: 'ADMIN', activo: true },
      select: { id: true, email: true, nombre: true, notifNuevoRegistro: true },
    });

    await Promise.all(admins.map(admin =>
      prisma.notificacion.create({
        data: {
          usuarioId: admin.id,
          tipo: 'ALERTA_SISTEMA',
          titulo: 'Nuevo usuario pendiente de aprobación',
          mensaje: `${user.nombre} (${user.rol}) verificó su email y aguarda tu aprobación.`,
          prioridad: 'ALTA',
          datos: JSON.stringify({
            tipo: 'nuevo_registro',
            usuarioId: user.id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
          }),
        },
      })
    ));

    // Email solo a admins que tienen activada la preferencia
    await Promise.all(
      admins
        .filter(a => a.notifNuevoRegistro)
        .map(admin => emailService.sendNuevoRegistroAdminEmail(admin.email, user.nombre, user.rol))
    );

    // Auditoría de email verificado
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: user.id,
          accion: 'EMAIL_VERIFICADO',
          modulo: 'AUTH',
          ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          datosDespues: JSON.stringify({ nombre: user.nombre, email: user.email, rol: user.rol, timestamp: new Date().toISOString() }),
        },
      });
    } catch { /* ignore audit errors */ }

    res.json({ success: true, message: 'Email verificado. Tu cuenta está pendiente de aprobación del administrador.' });
  } catch (error) {
    next(error);
  }
};

// ── LOGIN ──────────────────────────────────────────────────────────
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const { email, cuit, password } = parsed.data;

    const normalizedCuit = cuit ? (normalizeCuit(cuit) || cuit) : undefined;
    const user = await prisma.usuario.findFirst({
      where: normalizedCuit ? { cuit: normalizedCuit } : { email },
      include: { generador: true, transportista: true, operador: true },
    });

    if (!user) throw new AppError('Credenciales inválidas', 401);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError('Credenciales inválidas', 401);

    if (!user.emailVerified) {
      throw new AppError('Verificá tu email antes de iniciar sesión', 403);
    }

    // Restricted access for candidates with pending solicitudes
    if (!user.activo && user.emailVerified) {
      const solicitudPendiente = await prisma.solicitudInscripcion.findFirst({
        where: {
          usuarioId: user.id,
          estado: { in: ['BORRADOR', 'ENVIADA', 'EN_REVISION', 'OBSERVADA'] },
        },
        select: { id: true },
      });
      if (solicitudPendiente) {
        // Issue restricted token
        const { accessToken, refreshToken } = generateTokens(user.id, true);

        const userData = {
          id: user.id, email: user.email, rol: user.rol, nombre: user.nombre,
          apellido: user.apellido, empresa: user.empresa, telefono: user.telefono,
          activo: user.activo, esInspector: user.esInspector, generador: user.generador,
          transportista: user.transportista, operador: user.operador, createdAt: user.createdAt,
        };

        // Audit restricted login
        try {
          await prisma.auditoria.create({
            data: {
              usuarioId: user.id,
              accion: 'LOGIN_RESTRINGIDO',
              modulo: 'AUTH',
              ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
              userAgent: req.headers['user-agent'] || 'unknown',
              datosDespues: JSON.stringify({ email: user.email, rol: user.rol, solicitudId: solicitudPendiente.id, timestamp: new Date().toISOString() }),
            },
          });
        } catch { /* ignore audit errors */ }

        return res.json({
          success: true,
          data: {
            user: userData,
            tokens: { accessToken, refreshToken },
            restricted: true,
            solicitudId: solicitudPendiente.id,
          },
        });
      }
      throw new AppError('Tu cuenta esta pendiente de aprobacion del administrador', 403);
    }

    if (!user.activo) {
      throw new AppError('Tu cuenta esta pendiente de aprobacion del administrador', 403);
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: user.id,
          accion: 'LOGIN',
          modulo: 'AUTH',
          ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          datosDespues: JSON.stringify({ email: user.email, rol: user.rol, timestamp: new Date().toISOString() }),
        },
      });
    } catch { /* ignore audit errors */ }

    const userData = {
      id: user.id, email: user.email, rol: user.rol, nombre: user.nombre,
      apellido: user.apellido, empresa: user.empresa, telefono: user.telefono,
      activo: user.activo, esInspector: user.esInspector, generador: user.generador,
      transportista: user.transportista, operador: user.operador, createdAt: user.createdAt,
    };

    res.json({ success: true, data: { user: userData, tokens: { accessToken, refreshToken } } });
  } catch (error) {
    next(error);
  }
};

// ── FORGOT PASSWORD (público) ──────────────────────────────────────
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, cuit } = req.body;
    if (!email && !cuit) throw new AppError('Indicá tu email o CUIT', 400);

    const normalizedCuit = cuit ? (normalizeCuit(cuit) || cuit) : undefined;
    const user = await prisma.usuario.findFirst({
      where: email ? { email } : { cuit: normalizedCuit },
    });

    // Responder 200 siempre (no revelar existencia)
    if (!user) {
      return res.json({ success: true, message: 'Si el email/CUIT existe, recibirás un enlace.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await prisma.usuario.update({
      where: { id: user.id },
      data: { passwordResetToken: hashedToken, passwordResetExpires: expires },
    });

    await emailService.sendPasswordResetEmail(user.email, user.nombre, rawToken);

    res.json({ success: true, message: 'Si el email/CUIT existe, recibirás un enlace.' });
  } catch (error) {
    next(error);
  }
};

// ── RESET PASSWORD (público) ──────────────────────────────────────
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) throw new AppError('Token y nueva contraseña son requeridos', 400);

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) throw new AppError(passwordError, 400);

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.usuario.findFirst({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) throw new AppError('El enlace de recuperación es inválido o expiró', 400);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.usuario.update({
      where: { id: user.id },
      data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null },
    });

    res.json({ success: true, message: 'Contraseña restablecida correctamente.' });
  } catch (error) {
    next(error);
  }
};

// ── GET PROFILE ────────────────────────────────────────────────────
export const getProfile = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, email: true, rol: true, nombre: true, apellido: true,
        empresa: true, telefono: true, activo: true, esInspector: true,
        createdAt: true, generador: true, transportista: true, operador: true,
        notifNuevoRegistro: true, notifEmail: true,
      },
    });
    if (!user) throw new AppError('Usuario no encontrado', 404);
    res.json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Blacklist the access token so it can't be used again
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (token && (req as any).user?.id) {
      try {
        const decoded = jwt.decode(token) as { exp?: number } | null;
        if (decoded?.exp) {
          await prisma.refreshToken.create({
            data: {
              token,
              usuarioId: (req as any).user.id,
              revocado: true,
              expiresAt: new Date(decoded.exp * 1000),
            },
          });
        }
      } catch {
        // If token decode fails, skip blacklisting — still return success
      }
    }
    res.json({ success: true, message: 'Sesión cerrada correctamente' });
  } catch (error) {
    next(error);
  }
};

// ── CHANGE PASSWORD ────────────────────────────────────────────────
export const changePassword = async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError('Se requieren la contraseña actual y la nueva', 400);

    const user = await prisma.usuario.findUnique({ where: { id: req.user.id } });
    if (!user) throw new AppError('Usuario no encontrado', 404);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new AppError('La contraseña actual es incorrecta', 400);

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) throw new AppError(passwordError, 400);

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.usuario.update({ where: { id: req.user.id }, data: { password: hashedPassword } });
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    next(error);
  }
};

// ── REFRESH TOKEN ──────────────────────────────────────────────────
export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AppError('Refresh token es requerido', 400);

    let decoded: { id: string; restricted?: boolean };
    try {
      decoded = jwt.verify(token, config.JWT_REFRESH_SECRET as string) as { id: string; restricted?: boolean };
    } catch {
      throw new AppError('Refresh token inválido o expirado', 401);
    }

    // Check token revocation (blacklist)
    const blacklisted = await prisma.refreshToken.findFirst({
      where: { token, revocado: true },
    });
    if (blacklisted) {
      throw new AppError('Refresh token revocado', 401);
    }

    const user = await prisma.usuario.findUnique({ where: { id: decoded.id } });
    if (!user) throw new AppError('Usuario no encontrado o inactivo', 401);

    // Allow refresh for restricted tokens (inactive users with pending solicitudes)
    if (!user.activo && !decoded.restricted) {
      throw new AppError('Usuario no encontrado o inactivo', 401);
    }

    if (decoded.restricted) {
      return res.json({ success: true, data: generateTokens(user.id, true) });
    }

    res.json({ success: true, data: generateTokens(user.id) });
  } catch (error) {
    next(error);
  }
};

// ── CLAIM ACCOUNT (público) ──────────────────────────────────────
const claimSchema = z.object({
  cuit: z.string().min(8, 'CUIT es requerido'),
  razonSocial: z.string().min(2, 'Razón Social es requerida'),
  nuevoEmail: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña es requerida'),
});

export const claimAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = claimSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);

    const { cuit, razonSocial, nuevoEmail, password } = parsed.data;
    const genericMsg = 'Si los datos coinciden con un registro existente, recibirás un email de verificación.';

    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new AppError(passwordError, 400);

    const normalizedCuit = normalizeCuit(cuit) || cuit;

    const user = await prisma.usuario.findFirst({
      where: { cuit: normalizedCuit },
      include: { generador: true, transportista: true, operador: true },
    });

    // Don't reveal whether the CUIT exists
    if (!user) {
      return res.json({ success: true, message: genericMsg });
    }

    // Verify razonSocial against linked actor (case-insensitive)
    const actorRazonSocial =
      user.generador?.razonSocial ||
      user.transportista?.razonSocial ||
      user.operador?.razonSocial ||
      user.empresa;

    if (!actorRazonSocial || actorRazonSocial.trim().toLowerCase() !== razonSocial.trim().toLowerCase()) {
      return res.json({ success: true, message: genericMsg });
    }

    // Verify nuevoEmail is not used by another user
    const existingEmail = await prisma.usuario.findUnique({ where: { email: nuevoEmail } });
    if (existingEmail && existingEmail.id !== user.id) {
      throw new AppError('El email ya está en uso por otro usuario', 400);
    }

    // Update user: new email, new password, deactivate until verified
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    await prisma.usuario.update({
      where: { id: user.id },
      data: {
        email: nuevoEmail,
        password: hashedPassword,
        emailVerified: false,
        activo: false,
        emailVerificationToken: hashedToken,
      },
    });

    // Send verification email
    await emailService.sendEmailVerification(nuevoEmail, user.nombre, rawToken);

    // Notify admins via in-app notification
    const admins = await prisma.usuario.findMany({
      where: { rol: 'ADMIN', activo: true },
      select: { id: true },
    });
    await Promise.all(admins.map(admin =>
      prisma.notificacion.create({
        data: {
          usuarioId: admin.id,
          tipo: 'ALERTA_SISTEMA',
          titulo: 'Cuenta reclamada',
          mensaje: `${user.nombre} (${user.rol}) reclamó su cuenta con el email ${nuevoEmail}.`,
          prioridad: 'ALTA',
          datos: JSON.stringify({
            tipo: 'cuenta_reclamada',
            usuarioId: user.id,
            nombre: user.nombre,
            cuit: normalizedCuit,
            nuevoEmail,
            rol: user.rol,
          }),
        },
      })
    ));

    // Audit log
    try {
      await prisma.auditoria.create({
        data: {
          usuarioId: user.id,
          accion: 'CLAIM_ACCOUNT',
          modulo: 'AUTH',
          ip: req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          datosDespues: JSON.stringify({ cuit: normalizedCuit, nuevoEmail, rol: user.rol, timestamp: new Date().toISOString() }),
        },
      });
    } catch { /* ignore audit errors */ }

    res.json({ success: true, message: genericMsg });
  } catch (error) {
    next(error);
  }
};
