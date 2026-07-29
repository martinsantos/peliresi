import { Router } from 'express';
import { isAuthenticated, requireFullAccess } from '../middlewares/auth.middleware';
import { hasRole } from '../middlewares/auth.middleware';
import { requireManifestAccess } from '../utils/authorization';
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
router.get('/manifiesto/:id', isAuthenticated, requireFullAccess, requireManifestAccess('read'), getBlockchainStatus);

// Authenticated: register a manifest on blockchain on-demand
router.post('/registrar/:id', isAuthenticated, requireFullAccess, requireManifestAccess('read'), registrarBlockchain);

// Admin + sectorial: list all blockchain registrations
router.get('/registro', isAuthenticated, requireFullAccess, hasRole('ADMIN'), getRegistroBlockchain);

// Admin + sectorial: verify integrity of a single manifest
router.get('/verificar-integridad/:id', isAuthenticated, requireFullAccess, hasRole('ADMIN'), requireManifestAccess('read'), getVerificarIntegridad);

// Admin + sectorial: batch integrity verification
router.get('/verificar-lote', isAuthenticated, requireFullAccess, hasRole('ADMIN'), getVerificarLote);

export default router;
