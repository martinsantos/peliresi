import { Router } from 'express';
import { isAuthenticated } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/auth.middleware';
import {
  getBlockchainStatus,
  registrarBlockchain,
  verificarBlockchainPublico,
  getRegistroBlockchain,
  getVerificarIntegridad,
  getVerificarLote,
} from '../controllers/blockchain.controller';

const router = Router();

// Public: verify a manifest hash on blockchain (no auth required)
router.get('/verificar/:hash', verificarBlockchainPublico);

// Authenticated: get blockchain status for a manifest
router.get('/manifiesto/:id', isAuthenticated, getBlockchainStatus);

// Authenticated: register a manifest on blockchain on-demand
router.post('/registrar/:id', isAuthenticated, registrarBlockchain);

// Admin + sectorial: list all blockchain registrations
router.get('/registro', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), getRegistroBlockchain);

// Admin + sectorial: verify integrity of a single manifest
router.get('/verificar-integridad/:id', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), getVerificarIntegridad);

// Admin + sectorial: batch integrity verification
router.get('/verificar-lote', isAuthenticated, hasRole('ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'), getVerificarLote);

export default router;
