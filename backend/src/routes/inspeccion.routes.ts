import { Router } from 'express';
import multer from 'multer';
import { isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import {
  actualizarInspeccion,
  actualizarItems,
  actualizarComparaciones,
  agregarEventoInspeccion,
  cambiarEstadoInspeccion,
  crearInspeccion,
  descargarEvidencia,
  generarActaInspeccionPdf,
  listarInspecciones,
  obtenerInspeccion,
  subirEvidencia,
} from '../controllers/inspeccion.controller';

const router = Router();
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

router.use(isAuthenticated, requireFullAccess);
router.get('/', listarInspecciones);
router.post('/', crearInspeccion);
router.get('/:id', obtenerInspeccion);
router.patch('/:id', actualizarInspeccion);
router.patch('/:id/items', actualizarItems);
router.patch('/:id/comparaciones', actualizarComparaciones);
router.post('/:id/estado', cambiarEstadoInspeccion);
router.post('/:id/eventos', agregarEventoInspeccion);
router.get('/:id/acta.pdf', generarActaInspeccionPdf);
router.post('/:id/evidencias', evidenceUpload.single('file'), subirEvidencia);
router.get('/:id/evidencias/:evidenciaId', descargarEvidencia);

export default router;
