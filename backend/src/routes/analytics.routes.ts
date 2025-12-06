// Analytics Routes - Superadmin only
import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    isSuperAdmin,
    getAnalyticsSummary,
    getAnalyticsLogs,
    getUserActivity
} from '../controllers/analytics.controller';

const router = Router();

// All routes require authentication and superadmin
router.use(isAuthenticated);
router.use(isSuperAdmin);

// GET /api/analytics/summary - Get analytics summary
router.get('/summary', getAnalyticsSummary);

// GET /api/analytics/logs - Get detailed logs
router.get('/logs', getAnalyticsLogs);

// GET /api/analytics/user/:email - Get user activity
router.get('/user/:email', getUserActivity);

export default router;
