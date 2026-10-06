import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import { soporteAcceso, equipoSoporte, candidatosSoporte, configurarAgente, listarTickets, obtenerTicket, crearTicket, accionarTicket, descargarAdjuntoSoporte, comprobarEnvioTicket } from '../controllers/support.controller';
import { SUPPORT_FILE_LIMIT } from '../services/supportFile.service';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: SUPPORT_FILE_LIMIT, files: 3, fields: 8, fieldSize: 40000 } });
const writes = rateLimit({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Demasiados envíos. Conservá el borrador y reintentá en un momento.' } });
router.use(isAuthenticated, requireFullAccess);
router.get('/acceso', soporteAcceso);
router.get('/equipo', equipoSoporte);
router.get('/candidatos', candidatosSoporte);
router.get('/envios/:key', comprobarEnvioTicket);
router.patch('/equipo/:userId', writes, configurarAgente);
router.get('/', listarTickets);
router.post('/', writes, upload.array('files', 3), crearTicket);
router.get('/:id', obtenerTicket);
router.post('/:id/acciones', writes, upload.array('files', 3), accionarTicket);
router.get('/:id/adjuntos/:fileId', descargarAdjuntoSoporte);
export default router;
