import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    actualizarUbicacion,
    registrarIncidente,
    detectarAnomalias
} from '../controllers/logistics.controller';

const router = Router();

router.use(isAuthenticated);

// ============ TRACKING Y GPS ============
router.post('/ubicacion/:id', actualizarUbicacion);
router.post('/incidente/:id', registrarIncidente);

// ============ ANOMALÍAS (Solo Admin) ============
router.post('/anomalias/detectar/:manifiestoId', hasRole('ADMIN'), detectarAnomalias);

export default router;
