import { Router } from 'express';
import { handoffEnabled, limitedTransportState, limitedTransportGps } from '../controllers/transport-handoff.controller';
const router=Router();
// A signed, revocable per-leg capability, never a user authentication session.
router.use(handoffEnabled);
router.get('/:tramoId',limitedTransportState);
router.post('/:tramoId/ubicacion',limitedTransportGps);
export default router;
