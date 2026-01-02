import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
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
import { analyticsMiddleware, flushAnalytics } from './middlewares/analytics.middleware';

// Inicializar la aplicación Express
const app = express();
const prisma = new PrismaClient();

// Middleware básico
// Soportar múltiples orígenes CORS (separados por coma)
const corsOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
  credentials: true
}));
app.use(express.json());

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
app.use('/api/sync', syncRoutes);

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
