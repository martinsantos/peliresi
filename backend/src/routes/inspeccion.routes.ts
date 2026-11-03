import { createActShare, revokeActShare, readSharedAct, downloadSharedAct, presentSharedAct, respondSharedAct } from '../controllers/inspectionActShare.controller';
import { listInspectionManagement, setInspectionManagement } from '../controllers/inspectionManagementRole.controller';
import { previewInspectionSignature, signInspectionAct, downloadSignedInspectionAct } from '../controllers/inspectionSignature.controller';
import { Router } from 'express';
import { listInspectionIntakes, decideInspectionIntake } from '../controllers/inspection-intake.controller';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import { candidatosTerritorialesInspeccion, listarInspectores, operacionesInspecciones, organizarInspeccion } from '../controllers/inspectionOperations.controller';
import {
  describirEvidencia,
  actualizarInspeccion,
  actualizarInformeTecnico,
  actualizarItems,
  actualizarComparaciones,
  anularEvidencia,
  agregarEventoInspeccion,
  cambiarEstadoInspeccion,
  crearInspeccion,
  descargarEvidencia,
  generarActaInspeccionPdf,
  generarExpedienteInspeccionPdf,
  generarInformeTecnicoInspeccionPdf,
  guardarBorradorInspeccion,
  listarInspecciones,
  obtenerInspeccion,
  subirEvidencia,
  verificarInspeccionPublica,
} from '../controllers/inspeccion.controller';
import {
  decidirIntercambioInspeccion,
  descargarAdjuntoIntercambio,
  listarParticipacionInspeccionado,
  obtenerIntercambiosInspeccion,
  presentarIntercambioInspeccion,
} from '../controllers/inspectionExchange.controller';

const router = Router();
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
const exchangeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 5, fields: 12 },
});

const inspectionTraceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas verificaciones, intente de nuevo en un momento' },
});

// Must remain before the authenticated router middleware: the QR landing page
// is public, while the detailed trace remains protected below.
router.get('/verificar/:token', inspectionTraceLimiter, verificarInspeccionPublica);

router.get('/acta-compartida/:accesoId', inspectionTraceLimiter, readSharedAct);
router.get('/acta-compartida/:accesoId/pdf', inspectionTraceLimiter, downloadSharedAct);
router.post('/acta-compartida/:accesoId/presentaciones', inspectionTraceLimiter, presentSharedAct);

router.use(isAuthenticated);
router.use(requireFullAccess);
router.get('/participacion', listarParticipacionInspeccionado);
router.get('/antecedentes', listInspectionIntakes);
router.post('/antecedentes/:antecedenteId/decisiones', decideInspectionIntake);
router.get('/operaciones', operacionesInspecciones);
router.get('/operaciones/exportar', operacionesInspecciones);
router.get('/jefatura', listInspectionManagement);
router.put('/jefatura', setInspectionManagement);
router.get('/inspectores', listarInspectores);
router.get('/', listarInspecciones);
router.post('/', crearInspeccion);
router.get('/:id/intercambios', obtenerIntercambiosInspeccion);
router.post('/:id/intercambios', exchangeUpload.array('files', 5), presentarIntercambioInspeccion);
router.post('/:id/intercambios/decision', exchangeUpload.array('files', 5), decidirIntercambioInspeccion);
router.get('/:id/intercambios/:intercambioId/adjuntos/:evidenciaId', descargarAdjuntoIntercambio);
router.post('/:id/accesos-acta', createActShare);
router.post('/:id/accesos-acta/:accesoId/revocar', revokeActShare);
router.post('/:id/presentaciones-acta/responder', respondSharedAct);
router.get('/:id/firma/vista', previewInspectionSignature);
router.post('/:id/firmas', signInspectionAct);
router.get('/:id/firmas/:firmaId/acta.pdf', downloadSignedInspectionAct);
router.get('/:id', obtenerInspeccion);
router.patch('/:id', actualizarInspeccion);
router.patch('/:id/organizacion', organizarInspeccion);
router.get('/:id/candidatos', candidatosTerritorialesInspeccion);
router.patch('/:id/borrador', guardarBorradorInspeccion);
router.patch('/:id/informe-tecnico', actualizarInformeTecnico);
router.patch('/:id/items', actualizarItems);
router.patch('/:id/comparaciones', actualizarComparaciones);
router.post('/:id/estado', cambiarEstadoInspeccion);
router.post('/:id/eventos', agregarEventoInspeccion);
router.get('/:id/acta.pdf', generarActaInspeccionPdf);
router.get('/:id/expediente.pdf', generarExpedienteInspeccionPdf);
router.get('/:id/informe-tecnico.pdf', generarInformeTecnicoInspeccionPdf);
router.post('/:id/evidencias', evidenceUpload.single('file'), subirEvidencia);
router.patch('/:id/evidencias/:evidenciaId/descripcion', describirEvidencia);
router.patch('/:id/evidencias/:evidenciaId/anular', anularEvidencia);
router.get('/:id/evidencias/:evidenciaId', descargarEvidencia);

export default router;
