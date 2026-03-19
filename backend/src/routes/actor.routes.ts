import { Router } from 'express';
import { isAuthenticated, requireAdminOrTransportista, requireAdminOrGenerador, requireAdminOrOperador } from '../middlewares/auth.middleware';
import {
    getGeneradores, getGeneradorById, createGenerador, updateGenerador, deleteGenerador,
    getTransportistas, getTransportistaById, createTransportista, updateTransportista, deleteTransportista,
    addVehiculo, updateVehiculo, deleteVehiculo,
    addChofer, updateChofer, deleteChofer,
    getOperadores, getOperadorById, createOperador, updateOperador, deleteOperador
} from '../controllers/actor.controller';

const router = Router();
router.use(isAuthenticated);

// ===== GENERADORES =====

/**
 * @openapi
 * /actores/generadores:
 *   get:
 *     tags: [Actores]
 *     summary: Listar generadores
 *     description: Retorna lista de generadores de residuos peligrosos.
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
 *                   domicilio: { type: string }
 *                   numeroInscripcion: { type: string }
 */
router.get('/generadores', getGeneradores);

/**
 * @openapi
 * /actores/generadores/{id}:
 *   get:
 *     tags: [Actores]
 *     summary: Obtener generador por ID
 *     description: Retorna detalle completo de un generador.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del generador
 *       404:
 *         description: Generador no encontrado
 */
router.get('/generadores/:id', getGeneradorById);

/**
 * @openapi
 * /actores/generadores:
 *   post:
 *     tags: [Actores]
 *     summary: Crear generador
 *     description: Registra un nuevo generador de residuos peligrosos. Solo ADMIN o GENERADOR.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razonSocial, cuit]
 *             properties:
 *               razonSocial: { type: string }
 *               cuit: { type: string }
 *               telefono: { type: string }
 *               domicilio: { type: string }
 *               numeroInscripcion: { type: string }
 *               categoria: { type: string }
 *     responses:
 *       201:
 *         description: Generador creado
 *       400:
 *         description: Datos invalidos
 */
router.post('/generadores',      requireAdminOrGenerador, createGenerador);

/**
 * @openapi
 * /actores/generadores/{id}:
 *   put:
 *     tags: [Actores]
 *     summary: Actualizar generador
 *     description: Modifica datos de un generador existente. Solo ADMIN o GENERADOR.
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
 *               razonSocial: { type: string }
 *               cuit: { type: string }
 *               telefono: { type: string }
 *               domicilio: { type: string }
 *     responses:
 *       200:
 *         description: Generador actualizado
 *       404:
 *         description: No encontrado
 */
router.put('/generadores/:id',   requireAdminOrGenerador, updateGenerador);

/**
 * @openapi
 * /actores/generadores/{id}:
 *   delete:
 *     tags: [Actores]
 *     summary: Eliminar generador
 *     description: Elimina un generador. Solo ADMIN o GENERADOR.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Generador eliminado
 *       400:
 *         description: No se puede eliminar (tiene manifiestos asociados)
 */
router.delete('/generadores/:id', requireAdminOrGenerador, deleteGenerador);

// ===== TRANSPORTISTAS =====

/**
 * @openapi
 * /actores/transportistas:
 *   get:
 *     tags: [Actores]
 *     summary: Listar transportistas
 *     description: Retorna lista de transportistas con vehiculos y choferes.
 *     responses:
 *       200:
 *         description: Lista de transportistas
 */
router.get('/transportistas', getTransportistas);

/**
 * @openapi
 * /actores/transportistas/{id}:
 *   get:
 *     tags: [Actores]
 *     summary: Obtener transportista por ID
 *     description: Retorna detalle completo incluyendo vehiculos, choferes e historial.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del transportista
 *       404:
 *         description: Transportista no encontrado
 */
router.get('/transportistas/:id', getTransportistaById);

/**
 * @openapi
 * /actores/transportistas:
 *   post:
 *     tags: [Actores]
 *     summary: Crear transportista
 *     description: Registra un nuevo transportista. Solo ADMIN o TRANSPORTISTA.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razonSocial, cuit]
 *             properties:
 *               razonSocial: { type: string }
 *               cuit: { type: string }
 *               telefono: { type: string }
 *               domicilio: { type: string }
 *               numeroHabilitacion: { type: string }
 *     responses:
 *       201:
 *         description: Transportista creado
 */
router.post('/transportistas',           requireAdminOrTransportista, createTransportista);

/**
 * @openapi
 * /actores/transportistas/{id}:
 *   put:
 *     tags: [Actores]
 *     summary: Actualizar transportista
 *     description: Modifica datos de un transportista. Solo ADMIN o TRANSPORTISTA.
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
 *               razonSocial: { type: string }
 *               cuit: { type: string }
 *               telefono: { type: string }
 *               domicilio: { type: string }
 *               numeroHabilitacion: { type: string }
 *     responses:
 *       200:
 *         description: Transportista actualizado
 */
router.put('/transportistas/:id',        requireAdminOrTransportista, updateTransportista);

/**
 * @openapi
 * /actores/transportistas/{id}:
 *   delete:
 *     tags: [Actores]
 *     summary: Eliminar transportista
 *     description: Elimina un transportista. Verifica que no tenga manifiestos. Cascade delete de vehiculos y choferes.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Transportista eliminado
 *       400:
 *         description: No se puede eliminar (tiene manifiestos asociados)
 */
router.delete('/transportistas/:id',     requireAdminOrTransportista, deleteTransportista);

/**
 * @openapi
 * /actores/transportistas/{id}/vehiculos:
 *   post:
 *     tags: [Actores]
 *     summary: Agregar vehiculo a transportista
 *     description: Registra un nuevo vehiculo para el transportista. Solo ADMIN o TRANSPORTISTA.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del transportista
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patente, tipo]
 *             properties:
 *               patente: { type: string }
 *               tipo: { type: string }
 *               marca: { type: string }
 *               modelo: { type: string }
 *               capacidad: { type: number }
 *     responses:
 *       201:
 *         description: Vehiculo agregado
 */
router.post('/transportistas/:id/vehiculos',           requireAdminOrTransportista, addVehiculo);

/**
 * @openapi
 * /actores/transportistas/{id}/vehiculos/{vehiculoId}:
 *   put:
 *     tags: [Actores]
 *     summary: Actualizar vehiculo
 *     description: Modifica datos de un vehiculo del transportista.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del transportista
 *       - in: path
 *         name: vehiculoId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               patente: { type: string }
 *               tipo: { type: string }
 *               marca: { type: string }
 *               modelo: { type: string }
 *     responses:
 *       200:
 *         description: Vehiculo actualizado
 */
router.put('/transportistas/:id/vehiculos/:vehiculoId', requireAdminOrTransportista, updateVehiculo);

/**
 * @openapi
 * /actores/transportistas/{id}/vehiculos/{vehiculoId}:
 *   delete:
 *     tags: [Actores]
 *     summary: Eliminar vehiculo
 *     description: Elimina un vehiculo del transportista.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del transportista
 *       - in: path
 *         name: vehiculoId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vehiculo eliminado
 */
router.delete('/transportistas/:id/vehiculos/:vehiculoId', requireAdminOrTransportista, deleteVehiculo);

/**
 * @openapi
 * /actores/transportistas/{id}/choferes:
 *   post:
 *     tags: [Actores]
 *     summary: Agregar chofer a transportista
 *     description: Registra un nuevo chofer para el transportista.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del transportista
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nombre, dni]
 *             properties:
 *               nombre: { type: string }
 *               dni: { type: string }
 *               licencia: { type: string }
 *     responses:
 *       201:
 *         description: Chofer agregado
 */
router.post('/transportistas/:id/choferes',          requireAdminOrTransportista, addChofer);

/**
 * @openapi
 * /actores/transportistas/{id}/choferes/{choferId}:
 *   put:
 *     tags: [Actores]
 *     summary: Actualizar chofer
 *     description: Modifica datos de un chofer del transportista.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del transportista
 *       - in: path
 *         name: choferId
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
 *               dni: { type: string }
 *               licencia: { type: string }
 *     responses:
 *       200:
 *         description: Chofer actualizado
 */
router.put('/transportistas/:id/choferes/:choferId', requireAdminOrTransportista, updateChofer);

/**
 * @openapi
 * /actores/transportistas/{id}/choferes/{choferId}:
 *   delete:
 *     tags: [Actores]
 *     summary: Eliminar chofer
 *     description: Elimina un chofer del transportista.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: ID del transportista
 *       - in: path
 *         name: choferId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Chofer eliminado
 */
router.delete('/transportistas/:id/choferes/:choferId', requireAdminOrTransportista, deleteChofer);

// ===== OPERADORES =====

/**
 * @openapi
 * /actores/operadores:
 *   get:
 *     tags: [Actores]
 *     summary: Listar operadores
 *     description: Retorna lista de operadores de tratamiento.
 *     responses:
 *       200:
 *         description: Lista de operadores
 */
router.get('/operadores', getOperadores);

/**
 * @openapi
 * /actores/operadores/{id}:
 *   get:
 *     tags: [Actores]
 *     summary: Obtener operador por ID
 *     description: Retorna detalle completo de un operador incluyendo tratamientos autorizados.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Detalle del operador
 *       404:
 *         description: Operador no encontrado
 */
router.get('/operadores/:id', getOperadorById);

/**
 * @openapi
 * /actores/operadores:
 *   post:
 *     tags: [Actores]
 *     summary: Crear operador
 *     description: Registra un nuevo operador de tratamiento. Solo ADMIN u OPERADOR.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razonSocial, cuit]
 *             properties:
 *               razonSocial: { type: string }
 *               cuit: { type: string }
 *               telefono: { type: string }
 *               domicilio: { type: string }
 *               numeroHabilitacion: { type: string }
 *               categoria: { type: string }
 *     responses:
 *       201:
 *         description: Operador creado
 */
router.post('/operadores',       requireAdminOrOperador, createOperador);

/**
 * @openapi
 * /actores/operadores/{id}:
 *   put:
 *     tags: [Actores]
 *     summary: Actualizar operador
 *     description: Modifica datos de un operador. Solo ADMIN u OPERADOR.
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
 *               razonSocial: { type: string }
 *               cuit: { type: string }
 *               telefono: { type: string }
 *               domicilio: { type: string }
 *     responses:
 *       200:
 *         description: Operador actualizado
 */
router.put('/operadores/:id',    requireAdminOrOperador, updateOperador);

/**
 * @openapi
 * /actores/operadores/{id}:
 *   delete:
 *     tags: [Actores]
 *     summary: Eliminar operador
 *     description: Elimina un operador. Solo ADMIN u OPERADOR.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Operador eliminado
 *       400:
 *         description: No se puede eliminar (tiene manifiestos asociados)
 */
router.delete('/operadores/:id', requireAdminOrOperador, deleteOperador);

export default router;
