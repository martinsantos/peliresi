import { Router } from 'express';
import syncController from '../controllers/sync.controller';
import { isAuthenticated } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

/**
 * Rutas de sincronización offline (CU-S05)
 */

// GET /api/sync/initial - Descarga inicial para cache offline
router.get('/initial', syncController.getInitialSync);

// POST /api/sync/upload - Subir operaciones realizadas offline
router.post('/upload', syncController.uploadOfflineOperations);

// GET /api/sync/changes?since=ISO_DATE - Obtener cambios desde fecha
router.get('/changes', syncController.getChangesSince);

// GET /api/sync/status - Estado de sincronización del usuario
router.get('/status', syncController.getSyncStatus);

// POST /api/sync/resolve-conflicts - Resolver conflictos de sincronización
router.post('/resolve-conflicts', syncController.resolveConflicts);

// POST /api/sync/batch - Sincronización en lote bidireccional
router.post('/batch', syncController.batchSync);

export default router;
