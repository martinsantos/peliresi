import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    reporteManifiestosPorPeriodo,
    reporteResiduosTratados,
    reporteTransporte,
    getLogAuditoria,
    exportarCSV
} from '../controllers/reporte.controller';

const router = Router();

router.use(isAuthenticated);

// Reportes disponibles para todos los roles autenticados
router.get('/manifiestos', reporteManifiestosPorPeriodo);

// Reportes de operador
router.get('/tratados', reporteResiduosTratados);

// Reportes de transporte
router.get('/transporte', reporteTransporte);

// Log de auditoría (solo admin)
router.get('/auditoria', hasRole('ADMIN'), getLogAuditoria);

// Exportación CSV (solo admin)
router.get('/exportar/:tipo', hasRole('ADMIN'), exportarCSV);

export default router;
