import { iniciarRecordatorioFirmaJob } from './jobs/manifestSignatureReminder.job';
import { iniciarDuracionTransitoJob } from './jobs/transitDuration.job';
import express, { Request, Response } from 'express';
import { existsSync, readFileSync } from 'node:fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { config } from './config/config';
import { resolveListenHost } from './config/listenHost';
import { createScheduledTaskGate } from './config/scheduledTaskGate';
import { assertSyntheticPreviewDatabase, assertSyntheticPreviewRuntime, syntheticPreviewEnabled, syntheticPreviewRequestAllowed } from './config/syntheticPreview';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { isAuthenticated } from './middlewares/auth.middleware';
import authRoutes from './routes/auth.routes';
import manifiestoRoutes from './routes/manifiesto.routes';
import transportHandoffRoutes from './routes/transport-handoff.routes';
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
import logger from './utils/logger';
import { alertaSubscriber } from './subscribers/alerta.subscriber';
import { eventoManifiestoSubscriber } from './subscribers/eventoManifiesto.subscriber';
import { iniciarVencimientoJob } from './jobs/vencimiento.job';
import { iniciarBlockchainJob } from './jobs/blockchain.job';
import { iniciarRecordatorioJob } from './jobs/recordatorio.job';
import { iniciarSeguimientoCierreJob } from './jobs/seguimientoCierre.job';
import { iniciarAlertCatalogueJob } from './jobs/alertCatalogue.job';
import blockchainRoutes from './routes/blockchain.routes';
import renovacionRoutes from './routes/renovacion.routes';
import solicitudRoutes from './routes/solicitud.routes';
import inspeccionRoutes from './routes/inspeccion.routes';
import supportRoutes from './routes/support.routes';
import { startEmailFlushTimer } from './services/email.service';
import { createAuthenticationLimiters } from './middlewares/authRateLimit';
import { createApiAdmission } from './middlewares/apiAdmission';
import { PostgresAdmissionStore } from './services/apiAdmission.service';
import { trainingSession } from './middlewares/trainingSession';
import empresaRoutes from './routes/empresa.routes';

// The opt-in must pass runtime and connected database checks before traffic.
const syntheticPreview = syntheticPreviewEnabled();
if (syntheticPreview) assertSyntheticPreviewRuntime({ platform: process.platform, container: existsSync('/.dockerenv'),
  cpu: readFileSync('/sys/fs/cgroup/cpu.max', 'utf8'), memory: readFileSync('/sys/fs/cgroup/memory.max', 'utf8'),
  swap: readFileSync('/sys/fs/cgroup/memory.swap.max', 'utf8'), ipv4Routes: readFileSync('/proc/net/route', 'utf8'),
  ipv6Routes: existsSync('/proc/net/ipv6_route') ? readFileSync('/proc/net/ipv6_route', 'utf8') : '' });
const verifySyntheticPreviewDatabase = async () => {
  const rows = await prisma.$queryRaw<Array<{ name: string; port: number; address: string; schema: string; directory: string }>>`
    SELECT current_database() AS name, inet_server_port() AS port, host(inet_server_addr()) AS address,
      current_schema() AS schema, current_setting('data_directory') AS directory`;
  assertSyntheticPreviewDatabase(rows);
};

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
app.use('/api/', (req, res, next) => {
  if (!syntheticPreviewRequestAllowed(syntheticPreview, req.method, req.path, req.get('X-SITREP-Synthetic-Preview'))) {
    res.status(403).json({ success: false, message: 'No se pudo verificar la versión del entorno. Recargá la pantalla.' });
    return;
  }
  next();
});
app.use(trainingSession);

// Shared counters across workers. Valid sessions have independent work quotas;
// anonymous requests retain IP protection and login keeps its failure limits.
const admissionStore = new PostgresAdmissionStore();
app.use('/api/', createApiAdmission(admissionStore));
const authLimiters = createAuthenticationLimiters(admissionStore);
app.use('/api/auth/login', ...authLimiters.login);
app.use('/api/auth/register', authLimiters.registration);

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
app.get('/api/docs.json', (req, res, next) => {
  if (process.env.PUBLIC_DEMO_MODE === 'true') {
    return res.json(swaggerSpec);
  }

  return isAuthenticated(req, res, (error?: unknown) => {
    if (error) return next(error);
    if ((req as { user?: { rol?: string } }).user?.rol !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    return res.json(swaggerSpec);
  });
});

if (syntheticPreview) app.get('/api/preview/identity', async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await verifySyntheticPreviewDatabase();
    res.json({ mode: 'synthetic-preview-v1' });
  } catch {
    res.status(503).json({ error: 'No se pudo confirmar el entorno de práctica.' });
  }
});

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
app.use('/api/empresas',empresaRoutes);
app.use('/api/manifiestos', manifiestoRoutes);
app.use('/api/seguimiento-relevo', transportHandoffRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/actores', actorRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/solicitudes', solicitudRoutes);
app.use('/api/inspecciones', inspeccionRoutes);
app.use('/api/soporte', supportRoutes);
app.use('/api', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/centro-control', trackingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/renovaciones', renovacionRoutes);

// Manejador de rutas no encontradas
app.use(notFoundHandler);

// Manejador de errores global
app.use(errorHandler);

// Registrar suscriptores del bus de eventos de dominio
domainEvents.subscribe(eventoManifiestoSubscriber);
domainEvents.subscribe(alertaSubscriber);

// This startup-only gate does not prevent writes made by requests or other
// workers. A controlled validation window must pause every worker separately.
const scheduledTasks = createScheduledTaskGate(process.env.SITREP_PAUSE_BACKGROUND_JOBS, () => {
  logger.warn({ scope: 'cron-and-email-queue', resumeRequiresRestart: true },
    'Scheduled jobs and email queue timer paused at startup');
});
scheduledTasks.run(() => {
  iniciarVencimientoJob();
  iniciarBlockchainJob();
  iniciarRecordatorioJob();
  iniciarSeguimientoCierreJob();
  iniciarRecordatorioFirmaJob();
  iniciarAlertCatalogueJob();
  iniciarDuracionTransitoJob();
});

// Iniciar el servidor
const PORT = config.PORT;
const HOST = resolveListenHost(process.env.HOST, config.NODE_ENV);
const onListening = () => {
  logger.info({ port: PORT }, `Server running on port ${PORT}`);
  logger.info({ url: `http://localhost:${PORT}` }, 'Server URL');
  scheduledTasks.run(() => startEmailFlushTimer());
};
const listen = () => {
  if (HOST) app.listen(PORT, HOST, onListening);
  else app.listen(PORT, onListening);
};
if (syntheticPreview) {
  void verifySyntheticPreviewDatabase().then(listen).catch(() => {
    logger.fatal('Synthetic preview database identity could not be verified');
    process.exit(1);
  });
} else listen();

// Graceful shutdown handlers
const gracefulShutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down gracefully...');
  await flushAnalytics();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Catch unhandled rejections and exceptions
process.on('unhandledRejection', (reason: any) => {
  logger.error({ err: reason }, 'Unhandled Rejection');
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Uncaught Exception');
  gracefulShutdown('uncaughtException');
});
