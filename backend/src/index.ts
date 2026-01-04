import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import prisma from './lib/prisma';
import { config } from './config/config';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import authRoutes from './routes/auth.routes';
import manifiestoRoutes from './routes/manifiesto.routes';
import catalogoRoutes from './routes/catalogo.routes';
import pdfRoutes from './routes/pdf.routes';
import reporteRoutes from './routes/reporte.routes';
import actorRoutes from './routes/actor.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import syncRoutes from './routes/sync.routes';
import pushRoutes from './routes/push.routes';
import registroRoutes from './routes/registro.routes';
import auditoriaRoutes from './routes/auditoria.routes';
import { analyticsMiddleware, flushAnalytics } from './middlewares/analytics.middleware';

// Inicializar la aplicación Express
const app = express();

// Confiar en el proxy (Nginx) para obtener la IP real del cliente
app.set('trust proxy', 1);

// Limitador de peticiones general
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Límite de 1000 peticiones por ventana por IP (Aumentado tras feedback UAT)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiadas peticiones, por favor intente de nuevo más tarde.'
  }
});

// Limitador estricto para Auth (fuerza bruta)
// NOTA: Temporalmente aumentado a 100 para permitir testing exhaustivo
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 100, // 100 intentos de login por hora (Aumentado para testing)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Demasiados intentos de acceso, su IP ha sido limitada por una hora.'
  }
});

// Limitador para recursos pesados (PDF, Sync)
const resourceLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // 30 peticiones por minuto (Aumentado para permitir uso intensivo ocasional)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Por favor, espere antes de generar otra solicitud de recurso pesado.'
  }
});

// Middleware básico
// Soportar múltiples orígenes CORS (separados por coma)
const corsOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
}));
app.use(express.json());

// Aplicar limitador general a toda la API
app.use('/api/', generalLimiter);
// Aplicar limitador estricto a autenticación
app.use('/api/auth/', authLimiter);

// Analytics middleware (tracks all API requests)
if (process.env.ENABLE_ANALYTICS === 'true') {
  app.use(analyticsMiddleware);
}

// Rutas
// Ruta de prueba (Health Check) - Mover al inicio para evitar conflictos de middleware
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'API is running' });
});

// ========== RUTA PÚBLICA DE VERIFICACIÓN (Sin autenticación - para auditoría QR) ==========
app.get('/api/public/verify/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaCreacion: true,
        fechaFirma: true,
        fechaRetiro: true,
        fechaEntrega: true,
        fechaRecepcion: true,
        fechaCierre: true,
        qrCode: true,
        firmaDigital: true,
        generador: { select: { razonSocial: true, cuit: true } },
        transportista: { select: { razonSocial: true, cuit: true } },
        operador: { select: { razonSocial: true, cuit: true } },
        residuos: {
          select: {
            cantidad: true,
            unidad: true,
            tipoResiduo: { select: { nombre: true, codigo: true } }
          }
        },
        eventos: {
          select: { tipo: true, descripcion: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!manifiesto) {
      return res.status(404).json({
        success: false,
        error: 'Manifiesto no encontrado'
      });
    }

    res.json({
      success: true,
      verificacion: {
        manifiestoId: manifiesto.id,
        numero: manifiesto.numero,
        estado: manifiesto.estado,
        cadenaResponsabilidad: {
          generador: manifiesto.generador.razonSocial,
          transportista: manifiesto.transportista.razonSocial,
          operador: manifiesto.operador.razonSocial
        },
        timeline: {
          creacion: manifiesto.fechaCreacion,
          firma: manifiesto.fechaFirma,
          retiro: manifiesto.fechaRetiro,
          entrega: manifiesto.fechaEntrega,
          recepcion: manifiesto.fechaRecepcion,
          cierre: manifiesto.fechaCierre
        },
        residuos: manifiesto.residuos.map(r => ({
          tipo: r.tipoResiduo.nombre,
          codigo: r.tipoResiduo.codigo,
          cantidad: r.cantidad,
          unidad: r.unidad
        })),
        firmaDigital: manifiesto.firmaDigital ? 'FIRMADO DIGITALMENTE' : 'SIN FIRMA',
        eventos: manifiesto.eventos,
        verificadoEn: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error en verificación pública:', error);
    res.status(500).json({ success: false, error: 'Error al verificar manifiesto' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/manifiestos', manifiestoRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/pdf', resourceLimiter, pdfRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/actores', actorRoutes);

// Rutas públicas de registro (ANTES de notificationRoutes que tiene auth global)
app.use('/api/registro', registroRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin/auditoria', auditoriaRoutes);
app.use('/api', registroRoutes);  // Para rutas /admin/usuarios

// Rutas que requieren autenticación global
app.use('/api', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sync', resourceLimiter, syncRoutes);

// Manejador de rutas no encontradas
app.use(notFoundHandler);

// Manejador de errores global
app.use(errorHandler);

// Iniciar el servidor
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

// Manejo de cierre de la aplicación
process.on('SIGINT', async () => {
  // Flush analytics before exit
  await flushAnalytics();
  await prisma.$disconnect();
  console.log('Cerrando servidor...');
  process.exit(0);
});
