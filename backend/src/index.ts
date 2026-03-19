import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
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
import trackingRoutes from './routes/tracking.routes';
import adminRoutes from './routes/admin.routes';
import searchRoutes from './routes/search.routes';
import { analyticsMiddleware, flushAnalytics } from './middlewares/analytics.middleware';
import prisma from './lib/prisma';
import { domainEvents } from './services/domainEvent.service';
import { alertaSubscriber } from './subscribers/alerta.subscriber';
import { eventoManifiestoSubscriber } from './subscribers/eventoManifiesto.subscriber';
import { iniciarVencimientoJob } from './jobs/vencimiento.job';

// Inicializar la aplicación Express
const app = express();

// Trust proxy (required behind Nginx reverse proxy for rate limiting & IP detection)
app.set('trust proxy', 1);

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// Response compression (gzip/brotli) — reduces payload size ~5-10x
app.use(compression());

// Middleware básico
// Soportar múltiples orígenes CORS (separados por coma)
const corsOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting - General API (600 req/min to support 50+ phones behind shared NAT/CGNAT)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 600, // 600 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes, intente de nuevo en un momento' },
});
app.use('/api/', generalLimiter);

// Rate limiting - Auth endpoints (stricter)
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos de autenticación, intente de nuevo en un minuto' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Analytics middleware (tracks all API requests)
if (process.env.ENABLE_ANALYTICS === 'true') {
  app.use(analyticsMiddleware);
}

// Request timeout — prevents hanging queries from blocking the event loop
app.use((req, res, next) => {
  req.setTimeout(30000);
  res.setTimeout(30000);
  next();
});

// OpenAPI docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'SITREP API Docs',
}));
app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

// Rutas
/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Estado del sistema
 *     description: Verifica conectividad a la base de datos y retorna uptime.
 *     security: []
 *     responses:
 *       200:
 *         description: Sistema operativo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 db: { type: string, example: connected }
 *                 uptime: { type: number, example: 3600 }
 *       503:
 *         description: Base de datos desconectada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: error }
 *                 db: { type: string, example: disconnected }
 */
// Health Check with DB connectivity verification
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', uptime: process.uptime() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

/**
 * @openapi
 * /health/live:
 *   get:
 *     tags: [Health]
 *     summary: Liveness probe
 *     description: Retorna 200 si el proceso está vivo y acepta requests.
 *     security: []
 *     responses:
 *       200:
 *         description: Proceso vivo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: alive }
 *                 pid: { type: number, example: 12345 }
 *                 uptime: { type: number, example: 3600 }
 */
// Liveness probe — process is alive and accepting requests
app.get('/api/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive', pid: process.pid, uptime: process.uptime() });
});

/**
 * @openapi
 * /health/ready:
 *   get:
 *     tags: [Health]
 *     summary: Readiness probe
 *     description: Retorna 200 si DB conectada, memoria < 450MB y uptime > 10s. 503 si algún check falla.
 *     security: []
 *     responses:
 *       200:
 *         description: Listo para recibir tráfico
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ready }
 *                 checks:
 *                   type: object
 *                   properties:
 *                     db: { type: boolean }
 *                     memory: { type: boolean }
 *                     uptime: { type: boolean }
 *                 memoryMB: { type: number, example: 98 }
 *                 uptime: { type: number, example: 3600 }
 *       503:
 *         description: No listo (algún check falló)
 */
// Readiness probe — process is ready to serve traffic
app.get('/api/health/ready', async (_req: Request, res: Response) => {
  const memMB = process.memoryUsage().rss / 1024 / 1024;
  const uptime = process.uptime();
  const checks = { db: false, memory: memMB < 450, uptime: uptime > 10 };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch { /* db unreachable */ }

  const ready = checks.db && checks.memory && checks.uptime;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    memoryMB: Math.round(memMB),
    uptime: Math.round(uptime),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/manifiestos', manifiestoRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/actores', actorRoutes);
app.use('/api', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/centro-control', trackingRoutes);
app.use('/api/search', searchRoutes);

// Manejador de rutas no encontradas
app.use(notFoundHandler);

// Manejador de errores global
app.use(errorHandler);

// Registrar suscriptores del bus de eventos de dominio
domainEvents.subscribe(eventoManifiestoSubscriber);
domainEvents.subscribe(alertaSubscriber);

// Iniciar jobs cron
iniciarVencimientoJob();

// Iniciar el servidor
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`URL: http://localhost:${PORT}`);
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received. Shutting down gracefully...`);
  await flushAnalytics();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled Rejection:', reason?.message || reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error.message);
  gracefulShutdown('uncaughtException');
});
