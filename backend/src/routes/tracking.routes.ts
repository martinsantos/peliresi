import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { getActividadCentroControl } from '../controllers/tracking.controller';

const router = Router();

router.use(isAuthenticated);

// Centro de Control — actividad con capas
router.get('/actividad', getActividadCentroControl);

export default router;
