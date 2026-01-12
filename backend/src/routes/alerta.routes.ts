import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getReglasAlerta,
    crearReglaAlerta,
    actualizarReglaAlerta,
    eliminarReglaAlerta,
    getAlertasGeneradas,
    resolverAlerta,
    evaluarManifiesto,
    getAdvertenciasActivas,
    evaluarTiemposExcesivos,
    evaluarVencimientos,
    notificarCambioEstado
} from '../controllers/alerta.controller';

const router = Router();

// Requiere autenticación
router.use(isAuthenticated);

// ============ EVALUACIÓN DE ALERTAS (Todos los roles autenticados) ============
router.get('/evaluar/:manifiestoId', evaluarManifiesto);
router.get('/advertencias', getAdvertenciasActivas);

// ============ RUTAS ADMIN ============
router.use(hasRole('ADMIN'));

// ============ REGLAS DE ALERTA ============
router.get('/reglas', getReglasAlerta);
router.post('/reglas', crearReglaAlerta);
router.put('/reglas/:id', actualizarReglaAlerta);
router.delete('/reglas/:id', eliminarReglaAlerta);

// ============ ALERTAS GENERADAS ============
router.get('/', getAlertasGeneradas);
router.put('/:id/resolver', resolverAlerta);

// ============ EVALUACIONES AUTOMÁTICAS ============
router.get('/evaluar-tiempos', evaluarTiemposExcesivos);
router.get('/evaluar-vencimientos', evaluarVencimientos);
router.post('/notificar-cambio-estado', notificarCambioEstado);

export default router;
