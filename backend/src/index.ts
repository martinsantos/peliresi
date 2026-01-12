import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import prisma from './lib/prisma';
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

const app = express();
app.set('trust proxy', 1);

// Limitadores
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

// Rutas Autenticadas
app.use('/api/auth', authRoutes);
app.use('/api/manifiestos', manifiestoRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/viajes', viajesRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/actores', actorRoutes);
app.use('/api/alertas', alertaRoutes);
app.use('/api/notificaciones', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin/auditoria', auditoriaRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.PORT;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));

process.on('SIGINT', async () => {
  await flushAnalytics();
  await prisma.$disconnect();
  process.exit(0);
});
