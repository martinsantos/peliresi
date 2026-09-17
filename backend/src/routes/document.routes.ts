import { Router } from 'express';
import { hasRole, isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import { rejectUnsafePathParams } from '../utils/authorization';
import {
  confirmDocumentOcr,
  createAtmReceipt,
  documentUpload,
  downloadSolicitudDocument,
  listActorDocuments,
  reviewSolicitudDocument,
  runDocumentOcr,
  uploadActorDocument,
  reviewRegulatoryDocument,
  listActorRegulatoryDocuments,
  uploadActorRegulatoryDocument,
} from '../controllers/document-management.controller';
import {
  createCredential,
  downloadCertificate,
  issueCertificate,
  revokeCredential,
  verifyCertificate,
} from '../controllers/certificate.controller';
import { getActorCredentials } from '../controllers/document-management.controller';
import { aprobarSolicitud } from '../controllers/solicitud.controller';
import { requireSolicitudAccess } from '../utils/authorization';

const router = Router();

// Public verification intentionally exposes only the signed certificate
// snapshot fields; it never serves the PDF or underlying documents.
router.get('/certificados/verificar/:token', rejectUnsafePathParams('token'), verifyCertificate);

router.use(isAuthenticated);

router.post('/documentos/:id/ocr', rejectUnsafePathParams('id'), runDocumentOcr);
router.patch('/documentos/:id/confirmar', rejectUnsafePathParams('id'), confirmDocumentOcr);
router.get('/documentos/:id/download', rejectUnsafePathParams('id'), downloadSolicitudDocument);
// Administrative alias kept alongside /api/solicitudes/:id/aprobar so API
// clients can use the documented namespace without changing the legacy UI.
router.post('/admin/solicitudes/:id/aprobar', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), requireSolicitudAccess('admin'), rejectUnsafePathParams('id'), aprobarSolicitud);
router.get('/actores/transportistas/:id/:subjectType/:subjectId/documentos', requireFullAccess, rejectUnsafePathParams('id', 'subjectType', 'subjectId'), listActorDocuments);
router.post('/actores/transportistas/:id/:subjectType/:subjectId/documentos', requireFullAccess, documentUpload.single('file'), rejectUnsafePathParams('id', 'subjectType', 'subjectId'), uploadActorDocument);
router.patch('/admin/documentos-regulatorios/:id/revisar', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), rejectUnsafePathParams('id'), reviewRegulatoryDocument);
router.get('/actores/:tipo/:id/documentos-regulatorios', requireFullAccess, rejectUnsafePathParams('tipo', 'id'), listActorRegulatoryDocuments);
router.post('/actores/:tipo/:id/documentos-regulatorios', requireFullAccess, documentUpload.single('file'), rejectUnsafePathParams('tipo', 'id'), uploadActorRegulatoryDocument);
router.post('/actores/:tipo/:id/comprobantes-atm', requireFullAccess, documentUpload.single('file'), rejectUnsafePathParams('tipo', 'id'), createAtmReceipt);

router.patch('/admin/documentos/:id/revisar', hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), rejectUnsafePathParams('id'), reviewSolicitudDocument);
router.post('/admin/actores/:tipo/:id/credenciales', requireFullAccess, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), rejectUnsafePathParams('tipo', 'id'), createCredential);
router.get('/actores/:tipo/:id/credenciales', requireFullAccess, rejectUnsafePathParams('tipo', 'id'), getActorCredentials);
router.post('/admin/credenciales/:id/emitir-certificado', requireFullAccess, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), rejectUnsafePathParams('id'), issueCertificate);
router.patch('/admin/credenciales/:id/revocar', requireFullAccess, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), rejectUnsafePathParams('id'), revokeCredential);
router.get('/certificados/:id/download', requireFullAccess, rejectUnsafePathParams('id'), downloadCertificate);

export default router;
