// Analytics Routes
import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    isSuperAdmin,
    getAnalyticsSummary,
    getAnalyticsLogs,
    getUserActivity,
    getManifiestosPorMes,
    getResiduosPorTipo,
    getManifiestosPorEstado,
    getTiempoPromedioPorEtapa
} from '../controllers/analytics.controller';

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

// Dashboard analytics (any authenticated user)
router.get('/manifiestos-por-mes', getManifiestosPorMes);
router.get('/residuos-por-tipo', getResiduosPorTipo);
router.get('/manifiestos-por-estado', getManifiestosPorEstado);
router.get('/tiempo-promedio', getTiempoPromedioPorEtapa);

// Superadmin-only routes
router.use(isSuperAdmin);
router.get('/summary', getAnalyticsSummary);
router.get('/logs', getAnalyticsLogs);
router.get('/user/:email', getUserActivity);

export default router;
