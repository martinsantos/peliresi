import { Router } from 'express';
import { isAuthenticated, requireAnyAdmin } from '../middlewares/auth.middleware';
import {
  iniciarSolicitud,
  getMisSolicitudes,
  getSolicitud,
  updateSolicitud,
  enviarSolicitud,
  uploadDocumento,
  analizarDocumentoSolicitud,
  downloadDocumentoSolicitud,
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
  getRequisitosSolicitud,
} from '../controllers/solicitud.controller';

const router = Router();

// ── Public (no auth) ────────────────────────────────────────────────
router.post('/iniciar', iniciarSolicitud);
router.get('/requisitos/:tipoActor', getRequisitosSolicitud);

// ── Admin list (MUST be before /:id to avoid route conflict) ────────
router.get('/', isAuthenticated, requireAnyAdmin, listarSolicitudes);

// ── Candidate auth ──────────────────────────────────────────────────
router.get('/mis-solicitudes', isAuthenticated, getMisSolicitudes);
router.get('/:id', isAuthenticated, getSolicitud);
router.put('/:id', isAuthenticated, updateSolicitud);
router.post('/:id/enviar', isAuthenticated, enviarSolicitud);
router.post('/:id/documentos', isAuthenticated, upload.single('file'), uploadDocumento);
router.post('/:id/documentos/:docId/analizar', isAuthenticated, analizarDocumentoSolicitud);
router.get('/:id/documentos/:docId/download', isAuthenticated, downloadDocumentoSolicitud);
router.delete('/:id/documentos/:docId', isAuthenticated, deleteDocumento);
router.get('/:id/mensajes', isAuthenticated, getMensajes);
router.post('/:id/mensajes', isAuthenticated, crearMensaje);

// ── Admin actions ───────────────────────────────────────────────────
router.post('/:id/revisar', isAuthenticated, requireAnyAdmin, revisarSolicitud);
router.post('/:id/observar', isAuthenticated, requireAnyAdmin, observarSolicitud);
router.post('/:id/aprobar', isAuthenticated, requireAnyAdmin, aprobarSolicitud);
router.post('/:id/rechazar', isAuthenticated, requireAnyAdmin, rechazarSolicitud);
router.patch('/:id/documentos/:docId/revisar', isAuthenticated, requireAnyAdmin, revisarDocumento);

export default router;
