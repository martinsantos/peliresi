import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { globalSearch } from '../controllers/search.controller';

const router = Router();

router.use(isAuthenticated);

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Busqueda global
 *     description: Busca manifiestos, actores y usuarios por texto libre. Retorna resultados agrupados por tipo.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Texto de busqueda
 *     responses:
 *       200:
 *         description: Resultados de busqueda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 manifiestos: { type: array, items: { type: object } }
 *                 generadores: { type: array, items: { type: object } }
 *                 transportistas: { type: array, items: { type: object } }
 *                 operadores: { type: array, items: { type: object } }
 *       400:
 *         description: Parametro q requerido
 */
router.get('/', globalSearch);

export default router;
