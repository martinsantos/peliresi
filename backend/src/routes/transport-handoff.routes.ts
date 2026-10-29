import { Router } from 'express';
import { handoffEnabled, limitedTransportState, limitedTransportGps, limitedTransportGpsIdempotent } from '../controllers/transport-handoff.controller';
const router=Router();
// A signed, revocable per-leg capability, never a user authentication session.
router.use(handoffEnabled);
router.get('/:tramoId',limitedTransportState);
router.post('/:tramoId/ubicacion',limitedTransportGps);
// New clients fail closed against older servers, rather than silently losing the retry reference.
router.post('/:tramoId/ubicacion-idempotente',limitedTransportGpsIdempotent);
export default router;
