/**
 * Viajes Routes
 * Endpoints para manejo de viajes desde la app móvil
 */

import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import {
    iniciarViaje,
    finalizarViaje,
    getMisViajes,
    getViaje,
    agregarEvento,
    actualizarRuta,
    syncViaje,
    getViajesPorManifiesto
} from '../controllers/viajes.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// ============ CRUD VIAJES ============

// Iniciar un nuevo viaje
router.post('/', iniciarViaje);

// Obtener mis viajes (historial)
router.get('/mis-viajes', getMisViajes);

// Sincronizar viaje completo desde offline
router.post('/sync', syncViaje);

// Obtener viaje por ID
router.get('/:id', getViaje);

// Finalizar viaje
router.put('/:id/finalizar', finalizarViaje);

// Agregar evento a un viaje
router.post('/:id/evento', agregarEvento);

// Actualizar ruta (agregar puntos GPS)
router.post('/:id/ruta', actualizarRuta);

// Obtener viajes por manifiesto
router.get('/manifiesto/:manifiestoId', getViajesPorManifiesto);

export default router;
