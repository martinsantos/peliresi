import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    getNotificaciones,
    marcarLeida,
    marcarTodasLeidas,
    eliminarNotificacion,
    getReglasAlerta,
    crearReglaAlerta,
    actualizarReglaAlerta,
    eliminarReglaAlerta,
    getAlertasGeneradas,
    resolverAlerta,
    detectarAnomalias,
    getAnomalias,
    resolverAnomalia,
    cargaMasivaGeneradores,
    cargaMasivaTransportistas,
    cargaMasivaOperadores,
    descargarPlantilla
} from '../controllers/notification.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Todas las rutas requieren autenticación
router.use(isAuthenticated);

// ============ NOTIFICACIONES ============
router.get('/notificaciones', getNotificaciones);
router.put('/notificaciones/:id/leida', marcarLeida);
router.put('/notificaciones/todas-leidas', marcarTodasLeidas);
router.delete('/notificaciones/:id', eliminarNotificacion);

// ============ REGLAS DE ALERTA (Solo Admin) ============
router.get('/alertas/reglas', hasRole('ADMIN'), getReglasAlerta);
router.post('/alertas/reglas', hasRole('ADMIN'), crearReglaAlerta);
router.put('/alertas/reglas/:id', hasRole('ADMIN'), actualizarReglaAlerta);
router.delete('/alertas/reglas/:id', hasRole('ADMIN'), eliminarReglaAlerta);

// ============ ALERTAS GENERADAS ============
router.get('/alertas', hasRole('ADMIN'), getAlertasGeneradas);
router.put('/alertas/:id/resolver', hasRole('ADMIN'), resolverAlerta);

// ============ ANOMALÍAS DE TRANSPORTE ============
router.post('/anomalias/detectar/:manifiestoId', hasRole('ADMIN'), detectarAnomalias);
router.get('/anomalias/:manifiestoId', getAnomalias);
router.put('/anomalias/:id/resolver', hasRole('ADMIN'), resolverAnomalia);

// ============ CARGA MASIVA (Solo Admin) ============
router.post('/carga-masiva/generadores', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaGeneradores);
router.post('/carga-masiva/transportistas', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaTransportistas);
router.post('/carga-masiva/operadores', hasRole('ADMIN'), upload.single('archivo'), cargaMasivaOperadores);
router.get('/carga-masiva/plantilla/:tipo', hasRole('ADMIN'), descargarPlantilla);

export default router;
