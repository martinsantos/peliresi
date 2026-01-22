import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
    reporteManifiestosPorPeriodo,
    reporteResiduosTratados,
    reporteTransporte,
    getLogAuditoria,
    exportarCSV,
    getReporteGeneradoresDepartamento,
    getReporteGeneradoresVolumen,
    getReporteTiposResiduos,
    getReporteFiltrosDisponibles,
    getReporteGeneradoresFiltrado
} from '../controllers/reporte.controller';

const router = Router();

router.use(isAuthenticated);

// Reportes disponibles para todos los roles autenticados
router.get('/manifiestos', reporteManifiestosPorPeriodo);

// Alias para estadísticas generales (CU-A11, CU-O12)
router.get('/estadisticas', reporteManifiestosPorPeriodo);

// Reportes de operador
router.get('/tratados', reporteResiduosTratados);

// Reportes de transporte
router.get('/transporte', reporteTransporte);

// Log de auditoría (solo admin)
router.get('/auditoria', hasRole('ADMIN'), getLogAuditoria);

// Reportes de generadores (admin y admin_generadores)
router.get('/generadores-departamento', hasRole('ADMIN', 'ADMIN_GENERADORES'), getReporteGeneradoresDepartamento);
router.get('/generadores-volumen', hasRole('ADMIN', 'ADMIN_GENERADORES'), getReporteGeneradoresVolumen);
router.get('/tipos-residuos', hasRole('ADMIN', 'ADMIN_GENERADORES', 'ADMIN_OPERADORES'), getReporteTiposResiduos);

// Filtros y reportes avanzados de generadores
router.get('/generadores-filtros', hasRole('ADMIN', 'ADMIN_GENERADORES'), getReporteFiltrosDisponibles);
router.get('/generadores-filtrado', hasRole('ADMIN', 'ADMIN_GENERADORES'), getReporteGeneradoresFiltrado);

// Exportación CSV (solo admin)
router.get('/exportar/:tipo', hasRole('ADMIN'), exportarCSV);

export default router;
