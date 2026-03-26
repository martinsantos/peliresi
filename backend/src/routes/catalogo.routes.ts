import { Router } from 'express';
import { isAuthenticated, requireAdminOrGenerador, requireAdminOrOperador } from '../middlewares/auth.middleware';
import {
    getTiposResiduos,
    createTipoResiduo,
    updateTipoResiduo,
    deleteTipoResiduo,
    getGeneradores,
    getTransportistas,
    getOperadores,
    getAllVehiculos,
    getAllChoferes,
    getVehiculos,
    getChoferes,
    getAllTratamientos,
    getTratamientos,
    createTratamiento,
    updateTratamiento,
    deleteTratamiento,
    getGeneradoresEnrichment,
    getOperadoresEnrichment,
} from '../controllers/catalogo.controller';

const router = Router();

/**
 * @openapi
 * /catalogos/tipos-residuos:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar tipos de residuos
 *     description: Retorna el catalogo completo de tipos de residuos peligrosos. Endpoint publico para uso en formularios.
 *     security: []
 *     responses:
 *       200:
 *         description: Lista de tipos de residuos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   nombre: { type: string }
 *                   codigo: { type: string }
 *                   categoria: { type: string }
 */
// Rutas publicas (para selectores en formularios)
router.get('/tipos-residuos', getTiposResiduos);

// Enrichment data (static JSON, public — non-sensitive reference data)
router.get('/enrichment/generadores', getGeneradoresEnrichment);
router.get('/enrichment/operadores', getOperadoresEnrichment);

// Rutas protegidas
router.use(isAuthenticated);

/**
 * @openapi
 * /catalogos/generadores:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar generadores (catalogo)
 *     description: Retorna generadores con datos de usuario asociado. Para selectores en formularios.
 *     responses:
 *       200:
 *         description: Lista de generadores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   razonSocial: { type: string }
 *                   cuit: { type: string }
 *                   telefono: { type: string }
 *                   domicilio: { type: string }
 *                   numeroInscripcion: { type: string }
 *                   categoria: { type: string }
 */
router.get('/generadores', getGeneradores);

/**
 * @openapi
 * /catalogos/transportistas:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar transportistas (catalogo)
 *     description: Retorna transportistas con vehiculos, choferes y usuario asociado.
 *     responses:
 *       200:
 *         description: Lista de transportistas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   razonSocial: { type: string }
 *                   cuit: { type: string }
 *                   numeroHabilitacion: { type: string }
 *                   vehiculos: { type: array, items: { type: object } }
 *                   choferes: { type: array, items: { type: object } }
 */
router.get('/transportistas', getTransportistas);

/**
 * @openapi
 * /catalogos/operadores:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar operadores (catalogo)
 *     description: Retorna operadores con tratamientos autorizados y usuario asociado.
 *     responses:
 *       200:
 *         description: Lista de operadores
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   razonSocial: { type: string }
 *                   cuit: { type: string }
 *                   numeroHabilitacion: { type: string }
 *                   tratamientos: { type: array, items: { type: object } }
 */
router.get('/operadores', getOperadores);

/**
 * @openapi
 * /catalogos/vehiculos:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar todos los vehiculos
 *     description: Lista global de vehiculos activos con transportista asociado.
 *     responses:
 *       200:
 *         description: Lista de vehiculos
 */
router.get('/vehiculos', getAllVehiculos);

/**
 * @openapi
 * /catalogos/choferes:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar todos los choferes
 *     description: Lista global de choferes activos con transportista asociado.
 *     responses:
 *       200:
 *         description: Lista de choferes
 */
router.get('/choferes', getAllChoferes);

/**
 * @openapi
 * /catalogos/transportistas/{transportistaId}/vehiculos:
 *   get:
 *     tags: [Catalogos]
 *     summary: Vehiculos de un transportista
 *     description: Lista vehiculos de un transportista especifico.
 *     parameters:
 *       - in: path
 *         name: transportistaId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de vehiculos del transportista
 */
router.get('/transportistas/:transportistaId/vehiculos', getVehiculos);

/**
 * @openapi
 * /catalogos/transportistas/{transportistaId}/choferes:
 *   get:
 *     tags: [Catalogos]
 *     summary: Choferes de un transportista
 *     description: Lista choferes de un transportista especifico.
 *     parameters:
 *       - in: path
 *         name: transportistaId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de choferes del transportista
 */
router.get('/transportistas/:transportistaId/choferes', getChoferes);

/**
 * @openapi
 * /catalogos/operadores/{operadorId}/tratamientos:
 *   get:
 *     tags: [Catalogos]
 *     summary: Tratamientos de un operador
 *     description: Lista tratamientos autorizados de un operador especifico.
 *     parameters:
 *       - in: path
 *         name: operadorId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lista de tratamientos del operador
 */
router.get('/operadores/:operadorId/tratamientos', getTratamientos);

/**
 * @openapi
 * /catalogos/tipos-residuos:
 *   post:
 *     tags: [Catalogos]
 *     summary: Crear tipo de residuo
 *     description: Agrega un nuevo tipo de residuo al catalogo. Solo ADMIN o GENERADOR.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, codigo]
 *             properties:
 *               nombre: { type: string }
 *               codigo: { type: string }
 *               categoria: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       201:
 *         description: Tipo de residuo creado
 *       403:
 *         description: Rol no autorizado
 */
// CRUD tipos-residuos (ADMIN o ADMIN_GENERADOR)
router.post('/tipos-residuos', requireAdminOrGenerador, createTipoResiduo);

/**
 * @openapi
 * /catalogos/tipos-residuos/{id}:
 *   put:
 *     tags: [Catalogos]
 *     summary: Actualizar tipo de residuo
 *     description: Modifica un tipo de residuo existente. Solo ADMIN o GENERADOR.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               codigo: { type: string }
 *               categoria: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       200:
 *         description: Tipo de residuo actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/tipos-residuos/:id', requireAdminOrGenerador, updateTipoResiduo);

/**
 * @openapi
 * /catalogos/tipos-residuos/{id}:
 *   delete:
 *     tags: [Catalogos]
 *     summary: Eliminar tipo de residuo
 *     description: Elimina un tipo de residuo del catalogo. Solo ADMIN o GENERADOR.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tipo de residuo eliminado
 *       404:
 *         description: No encontrado
 */
router.delete('/tipos-residuos/:id', requireAdminOrGenerador, deleteTipoResiduo);

/**
 * @openapi
 * /catalogos/tratamientos:
 *   get:
 *     tags: [Catalogos]
 *     summary: Listar todos los tratamientos
 *     description: Lista global de tratamientos autorizados. Solo ADMIN u OPERADOR.
 *     responses:
 *       200:
 *         description: Lista de tratamientos
 */
// Tratamientos autorizados (ADMIN o ADMIN_OPERADOR)
router.get('/tratamientos', requireAdminOrOperador, getAllTratamientos);

/**
 * @openapi
 * /catalogos/tratamientos:
 *   post:
 *     tags: [Catalogos]
 *     summary: Crear tratamiento
 *     description: Agrega un nuevo tratamiento autorizado. Solo ADMIN u OPERADOR.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre]
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               operadorId: { type: string }
 *     responses:
 *       201:
 *         description: Tratamiento creado
 */
router.post('/tratamientos', requireAdminOrOperador, createTratamiento);

/**
 * @openapi
 * /catalogos/tratamientos/{id}:
 *   put:
 *     tags: [Catalogos]
 *     summary: Actualizar tratamiento
 *     description: Modifica un tratamiento existente. Solo ADMIN u OPERADOR.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *     responses:
 *       200:
 *         description: Tratamiento actualizado
 */
router.put('/tratamientos/:id', requireAdminOrOperador, updateTratamiento);

/**
 * @openapi
 * /catalogos/tratamientos/{id}:
 *   delete:
 *     tags: [Catalogos]
 *     summary: Eliminar tratamiento
 *     description: Elimina un tratamiento del catalogo. Solo ADMIN u OPERADOR.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tratamiento eliminado
 */
router.delete('/tratamientos/:id', requireAdminOrOperador, deleteTratamiento);

export default router;
