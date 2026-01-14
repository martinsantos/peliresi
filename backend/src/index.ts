import express, { Request, Response } from 'express';
import { createServer } from 'http';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import prisma from './lib/prisma';
import { redisService } from './lib/redis';
import { wsService } from './lib/websocket';
import { config } from './config/config';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { flushAnalytics, analyticsMiddleware } from './middlewares/analytics.middleware';

// Rutas
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
import alertaRoutes from './routes/alerta.routes';
import logisticsRoutes from './routes/logistics.routes';
import publicRoutes from './routes/public.routes';
import viajesRoutes from './routes/viajes.routes';
import notificacionRoutes from './routes/notificacion.routes';
import adminRoutes from './routes/admin.routes';
import configRoutes from './routes/config.routes';
import cronRoutes from './routes/cron.routes';
import preferenciasRoutes from './routes/preferencias.routes';
import adminSectorialRoutes from './routes/admin-sectorial.routes';
import cronService from './services/cron.service';

const app = express();
const httpServer = createServer(app);
app.set('trust proxy', 1);

// ========================================
// RATE LIMITERS POR RUTA (ESCALABILIDAD)
// ========================================

// Auth: 10 intentos por minuto (prevenir brute force)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Demasiados intentos de login. Intente en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// API General: 100 req/min por usuario
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Límite de requests excedido. Intente en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GPS: 10 req/seg (alta frecuencia de updates de ubicación)
const gpsLimiter = rateLimit({
  windowMs: 1000, // 1 segundo
  max: 10,
  message: { error: 'Demasiadas actualizaciones GPS.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Sync inicial: 20 req/min (operación pesada)
const syncLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas sincronizaciones. Intente en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// General fallback (legacy)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

// Middlewares
app.use(cors({ origin: config.CORS_ORIGIN.split(',').map(o => o.trim()), credentials: true }));
app.use(express.json());
app.use('/api/', generalLimiter);

if (process.env.ENABLE_ANALYTICS === 'true') {
  app.use(analyticsMiddleware);
}

// Health Check
app.get('/api/health', (req: Request, res: Response) => res.json({ status: 'ok' }));

// Rutas Públicas
app.use('/api/public', publicRoutes);
app.use('/api/registro', registroRoutes);

// Rutas con Rate Limiting específico
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sync', syncLimiter, syncRoutes);
app.use('/api/viajes', gpsLimiter, viajesRoutes); // GPS tracking usa esta ruta

// Rutas con API limiter general
app.use('/api/manifiestos', apiLimiter, manifiestoRoutes);
app.use('/api/logistics', apiLimiter, logisticsRoutes);
app.use('/api/catalogos', apiLimiter, catalogoRoutes);
app.use('/api/notificaciones', apiLimiter, notificacionRoutes);
app.use('/api/pdf', apiLimiter, pdfRoutes);
app.use('/api/reportes', apiLimiter, reporteRoutes);
app.use('/api/actores', apiLimiter, actorRoutes);
app.use('/api/alertas', apiLimiter, alertaRoutes);
app.use('/api/notificaciones', apiLimiter, notificationRoutes);
app.use('/api/analytics', apiLimiter, analyticsRoutes);
app.use('/api/push', apiLimiter, pushRoutes);
app.use('/api/admin/auditoria', apiLimiter, auditoriaRoutes);
app.use('/api/admin', apiLimiter, adminRoutes);
app.use('/api/config', apiLimiter, configRoutes);
app.use('/api/cron', apiLimiter, cronRoutes);
app.use('/api/preferencias', apiLimiter, preferenciasRoutes);
app.use('/api/admin-sectorial', apiLimiter, adminSectorialRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.PORT;

// Inicializar servicios antes de escuchar
(async () => {
  // Conectar Redis (degraded mode si falla)
  await redisService.connect();
  if (redisService.connected) {
    console.log('📦 Redis cache ready');
  } else {
    console.warn('⚠️ Redis not available - running without cache');
  }

  // Inicializar WebSocket server
  wsService.initialize(httpServer);
  console.log('🔌 WebSocket server ready');

  httpServer.listen(PORT, () => {
    console.log(`🚀 Server on port ${PORT}`);

    // Inicializar tareas programadas (solo en producción o si está habilitado)
    if (process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'production') {
      cronService.initialize();
      console.log('⏰ CRON jobs initialized');
    }
  });
})();

process.on('SIGINT', async () => {
  cronService.stop();
  await flushAnalytics();
  await redisService.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});
