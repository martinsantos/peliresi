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

// Admin: list all blockchain registrations
router.get('/registro', isAuthenticated, hasRole('ADMIN'), getRegistroBlockchain);

// Admin: verify integrity of a single manifest
router.get('/verificar-integridad/:id', isAuthenticated, hasRole('ADMIN'), getVerificarIntegridad);

// Admin: batch integrity verification
router.get('/verificar-lote', isAuthenticated, hasRole('ADMIN'), getVerificarLote);

export default router;
