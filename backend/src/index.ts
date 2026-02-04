import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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
import { analyticsMiddleware, flushAnalytics } from './middlewares/analytics.middleware';
import prisma from './lib/prisma';

// Inicializar la aplicación Express
const app = express();

// Security headers via Helmet
app.use(helmet({
  contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// Middleware básico
// Soportar múltiples orígenes CORS (separados por coma)
const corsOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting - General API
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
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

// Rutas
// Ruta de prueba (Health Check) - Mover al inicio para evitar conflictos de middleware
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/manifiestos', manifiestoRoutes);
app.use('/api/catalogos', catalogoRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/actores', actorRoutes);
app.use('/api', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/centro-control', trackingRoutes);

// Manejador de rutas no encontradas
app.use(notFoundHandler);

// Manejador de errores global
app.use(errorHandler);

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
