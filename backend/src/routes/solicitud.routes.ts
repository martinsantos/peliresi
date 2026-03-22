import { Router } from 'express';
import { isAuthenticated, hasRole } from '../middlewares/auth.middleware';
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
router.post('/iniciar', iniciarSolicitud);

// ── Admin list (MUST be before /:id to avoid route conflict) ────────
router.get('/', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), listarSolicitudes);

// ── Candidate auth ──────────────────────────────────────────────────
router.get('/mis-solicitudes', isAuthenticated, getMisSolicitudes);
router.get('/:id', isAuthenticated, getSolicitud);
router.put('/:id', isAuthenticated, updateSolicitud);
router.post('/:id/enviar', isAuthenticated, enviarSolicitud);
router.post('/:id/documentos', isAuthenticated, upload.single('file'), uploadDocumento);
router.delete('/:id/documentos/:docId', isAuthenticated, deleteDocumento);
router.get('/:id/mensajes', isAuthenticated, getMensajes);
router.post('/:id/mensajes', isAuthenticated, crearMensaje);

// ── Admin actions ───────────────────────────────────────────────────
router.post('/:id/revisar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), revisarSolicitud);
router.post('/:id/observar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), observarSolicitud);
router.post('/:id/aprobar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), aprobarSolicitud);
router.post('/:id/rechazar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), rechazarSolicitud);
router.patch('/:id/documentos/:docId/revisar', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'), revisarDocumento);

export default router;
