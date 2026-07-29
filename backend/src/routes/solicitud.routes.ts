import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
import { verifyCaptcha } from '../middlewares/captcha.middleware';
import { rejectUnsafePathParams, requireSolicitudAccess } from '../utils/authorization';
import {
  iniciarSolicitud,
  getMisSolicitudes,
  getSolicitud,
  updateSolicitud,
  enviarSolicitud,
  uploadDocumento,
  deleteDocumento,
  getMensajes,
  crearMensaje,
  listarSolicitudes,
  revisarSolicitud,
  observarSolicitud,
  aprobarSolicitud,
  rechazarSolicitud,
  revisarDocumento,
  upload,
} from '../controllers/solicitud.controller';

const router = Router();

// ── Public (no auth) ────────────────────────────────────────────────
router.post('/iniciar', verifyCaptcha, iniciarSolicitud);

// ── Admin list (MUST be before /:id to avoid route conflict) ────────
router.get('/', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), listarSolicitudes);

// ── Candidate auth ──────────────────────────────────────────────────
router.get('/mis-solicitudes', isAuthenticated, getMisSolicitudes);
router.get('/:id', isAuthenticated, requireSolicitudAccess('read'), getSolicitud);
router.put('/:id', isAuthenticated, requireSolicitudAccess('write'), updateSolicitud);
router.post('/:id/enviar', isAuthenticated, requireSolicitudAccess('write'), enviarSolicitud);
router.post('/:id/documentos', isAuthenticated, requireSolicitudAccess('write'), upload.single('file'), uploadDocumento);
router.delete('/:id/documentos/:docId', isAuthenticated, requireSolicitudAccess('write'), rejectUnsafePathParams('docId'), deleteDocumento);
router.get('/:id/mensajes', isAuthenticated, requireSolicitudAccess('read'), getMensajes);
router.post('/:id/mensajes', isAuthenticated, requireSolicitudAccess('read'), crearMensaje);

// ── Admin actions ───────────────────────────────────────────────────
router.post('/:id/revisar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), requireSolicitudAccess('admin'), revisarSolicitud);
router.post('/:id/observar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), requireSolicitudAccess('admin'), observarSolicitud);
router.post('/:id/aprobar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), requireSolicitudAccess('admin'), aprobarSolicitud);
router.post('/:id/rechazar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), requireSolicitudAccess('admin'), rechazarSolicitud);
router.patch('/:id/documentos/:docId/revisar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), requireSolicitudAccess('admin'), rejectUnsafePathParams('docId'), revisarDocumento);

export default router;
