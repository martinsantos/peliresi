import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import {
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
  generarInformeTecnicoInspeccionPdf,
  listarInspecciones,
  obtenerInspeccion,
  subirEvidencia,
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

router.use(isAuthenticated);
router.use(requireFullAccess);
router.get('/participacion', listarParticipacionInspeccionado);
router.get('/', listarInspecciones);
router.post('/', crearInspeccion);
router.get('/:id/intercambios', obtenerIntercambiosInspeccion);
router.post('/:id/intercambios', exchangeUpload.array('files', 5), presentarIntercambioInspeccion);
router.post('/:id/intercambios/decision', exchangeUpload.array('files', 5), decidirIntercambioInspeccion);
router.get('/:id/intercambios/:intercambioId/adjuntos/:evidenciaId', descargarAdjuntoIntercambio);
router.get('/:id', obtenerInspeccion);
router.patch('/:id', actualizarInspeccion);
router.patch('/:id/informe-tecnico', actualizarInformeTecnico);
router.patch('/:id/items', actualizarItems);
router.patch('/:id/comparaciones', actualizarComparaciones);
router.post('/:id/estado', cambiarEstadoInspeccion);
router.post('/:id/eventos', agregarEventoInspeccion);
router.get('/:id/acta.pdf', generarActaInspeccionPdf);
router.get('/:id/informe-tecnico.pdf', generarInformeTecnicoInspeccionPdf);
router.post('/:id/evidencias', evidenceUpload.single('file'), subirEvidencia);
router.patch('/:id/evidencias/:evidenciaId/anular', anularEvidencia);
router.get('/:id/evidencias/:evidenciaId', descargarEvidencia);

export default router;
