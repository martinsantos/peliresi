import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import {
  // Transportistas
  getDashboardTransportistas,
  getTransportistas,
  aprobarTransportista,
  getReportesTransportistas,
  getTransportistasFiltrosDisponibles,
  getTransportistaById,
  updateTransportistaAdmin,
  // Operadores
  getDashboardOperadores,
  getOperadores,
  aprobarOperador,
  getReportesOperadores,
  getOperadoresFiltrosDisponibles,
  getOperadorById,
  updateOperadorAdmin,
  // Generadores
  getDashboardGeneradores,
  getGeneradores,
  aprobarGenerador,
  getReportesGeneradores,
  getGeneradoresFiltrosDisponibles,
  getGeneradorById,
  updateGeneradorAdmin,
  deleteGeneradorAdmin
} from '../controllers/admin-sectorial.controller';

const router = Router();

router.use(isAuthenticated);

// ============================================================
// ADMIN TRANSPORTISTAS
// Accesible por: ADMIN, ADMIN_TRANSPORTISTAS
// ============================================================
router.get(
  '/transportistas/dashboard',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  getDashboardTransportistas
);
router.get(
  '/transportistas/lista',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  getTransportistas
);
router.post(
  '/transportistas/:id/aprobar',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  aprobarTransportista
);
router.get(
  '/transportistas/reportes',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  getReportesTransportistas
);
router.get(
  '/transportistas/filtros-disponibles',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  getTransportistasFiltrosDisponibles
);
router.get(
  '/transportistas/:id',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  getTransportistaById
);
router.patch(
  '/transportistas/:id',
  hasRole('ADMIN', 'ADMIN_TRANSPORTISTAS'),
  updateTransportistaAdmin
);

// ============================================================
// ADMIN OPERADORES
// Accesible por: ADMIN, ADMIN_OPERADORES
// ============================================================
router.get(
  '/operadores/dashboard',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  getDashboardOperadores
);
router.get(
  '/operadores/lista',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  getOperadores
);
router.post(
  '/operadores/:id/aprobar',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  aprobarOperador
);
router.get(
  '/operadores/reportes',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  getReportesOperadores
);
router.get(
  '/operadores/filtros-disponibles',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  getOperadoresFiltrosDisponibles
);
router.get(
  '/operadores/:id',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  getOperadorById
);
router.patch(
  '/operadores/:id',
  hasRole('ADMIN', 'ADMIN_OPERADORES'),
  updateOperadorAdmin
);

// ============================================================
// ADMIN GENERADORES
// Accesible por: ADMIN, ADMIN_GENERADORES
// ============================================================
router.get(
  '/generadores/dashboard',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  getDashboardGeneradores
);
router.get(
  '/generadores/lista',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  getGeneradores
);
router.post(
  '/generadores/:id/aprobar',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  aprobarGenerador
);
router.get(
  '/generadores/reportes',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  getReportesGeneradores
);
router.get(
  '/generadores/filtros-disponibles',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  getGeneradoresFiltrosDisponibles
);
router.get(
  '/generadores/:id',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  getGeneradorById
);
router.put(
  '/generadores/:id',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  updateGeneradorAdmin
);
router.delete(
  '/generadores/:id',
  hasRole('ADMIN', 'ADMIN_GENERADORES'),
  deleteGeneradorAdmin
);

export default router;
