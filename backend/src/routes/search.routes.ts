import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { globalSearch } from '../controllers/search.controller';

const router = Router();

router.use(isAuthenticated);
router.get('/', globalSearch);

export default router;
