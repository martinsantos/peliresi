import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { previewDocument, previewUpload } from '../controllers/documentPreview.controller';
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
  editarDatosRevision,
} from '../controllers/solicitud.controller';

const router = Router();

// ── Public (no auth) ────────────────────────────────────────────────
router.post('/iniciar', iniciarSolicitud);
router.get('/requisitos/:tipoActor', getRequisitosSolicitud);
router.post('/analizar-documento', rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-8', legacyHeaders: false,
  message: { success: false, message: 'La lectura llegó al límite de este minuto. Esperá un momento o completá los datos manualmente.' } }), previewUpload.single('file'), previewDocument);

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
router.patch('/:id/datos-revision', isAuthenticated, requireAnyAdmin, editarDatosRevision);
router.post('/:id/revisar', isAuthenticated, requireAnyAdmin, revisarSolicitud);
router.post('/:id/observar', isAuthenticated, requireAnyAdmin, observarSolicitud);
router.post('/:id/aprobar', isAuthenticated, requireAnyAdmin, aprobarSolicitud);
router.post('/:id/rechazar', isAuthenticated, requireAnyAdmin, rechazarSolicitud);
router.patch('/:id/documentos/:docId/revisar', isAuthenticated, requireAnyAdmin, revisarDocumento);

export default router;
