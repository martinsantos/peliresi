import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/auth.middleware';

// Mock prisma
const { mockFindUnique, mockFindMany, mockCount } = vi.hoisted(() => {
  return {
    mockFindUnique: vi.fn(),
    mockFindMany: vi.fn(),
    mockCount: vi.fn(),
  };
});

vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    manifiesto: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
    },
    blockchainSello: {
      findMany: mockFindMany,
    },
  },
}));

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../config/config', () => ({
  config: {
    BLOCKCHAIN_ENABLED: false,
    BLOCKCHAIN_CONTRACT_ADDRESS: '0x1234567890123456789012345678901234567890',
    BLOCKCHAIN_RPC_URL: 'https://sepolia.infura.io/v3/test',
  },
}));

vi.mock('../../services/blockchain.service', () => ({
  verificarEnBlockchain: vi.fn().mockResolvedValue({ exists: false, timestamp: 0 }),
  registrarEnBlockchain: vi.fn().mockResolvedValue(undefined),
  verificarIntegridad: vi.fn().mockResolvedValue({
    manifiestoId: 'man-1',
    numero: 'MAN-001',
    genesisVerificado: true,
    integridad: 'COMPLETA',
    discrepancias: [],
  }),
  verificarLote: vi.fn().mockResolvedValue({
    totalVerificados: 5,
    integridadCompleta: 5,
    integridadParcial: 0,
    integridadFallida: 0,
    sinBlockchain: 0,
    detalle: [],
  }),
}));

import {
  getBlockchainStatus,
  registrarBlockchain,
  verificarBlockchainPublico,
  getRegistroBlockchain,
  getVerificarIntegridad,
  getVerificarLote,
} from '../../controllers/blockchain.controller';

function createMocks(userOverrides = {}) {
  const req = {
    params: {},
    query: {},
    user: { id: 'user-1', rol: 'ADMIN', ...userOverrides },
  } as unknown as AuthRequest;
  const res = {
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('BlockchainController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('exported functions', () => {
    it('getBlockchainStatus is a function', () => { expect(typeof getBlockchainStatus).toBe('function'); });
    it('registrarBlockchain is a function', () => { expect(typeof registrarBlockchain).toBe('function'); });
    it('verificarBlockchainPublico is a function', () => { expect(typeof verificarBlockchainPublico).toBe('function'); });
    it('getRegistroBlockchain is a function', () => { expect(typeof getRegistroBlockchain).toBe('function'); });
    it('getVerificarIntegridad is a function', () => { expect(typeof getVerificarIntegridad).toBe('function'); });
    it('getVerificarLote is a function', () => { expect(typeof getVerificarLote).toBe('function'); });
  });

  describe('getBlockchainStatus', () => {
    it('throws 404 when manifiesto is not found', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'nonexistent' };

      await getBlockchainStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('returns blockchain status when manifiesto exists', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'man-1' };
      mockFindUnique.mockResolvedValue({
        blockchainHash: 'abc123',
        blockchainTxHash: '0xdef456',
        blockchainBlockNumber: 12345,
        blockchainTimestamp: new Date('2025-06-01'),
        blockchainStatus: 'CONFIRMADO',
        rollingHash: 'rolling-hash-xyz',
      });

      await getBlockchainStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            blockchain: expect.objectContaining({
              blockchainStatus: 'CONFIRMADO',
            }),
          }),
        })
      );
    });
  });

  describe('registrarBlockchain', () => {
    it('throws 400 when blockchain is disabled', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'man-1' };

      await registrarBlockchain(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: expect.stringContaining('no esta habilitado') })
      );
    });
  });

  describe('verificarBlockchainPublico', () => {
    it('returns enabled:false when blockchain is disabled', async () => {
      const { req, res, next } = createMocks();
      req.params = { hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1' };

      await verificarBlockchainPublico(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ enabled: false, exists: false }),
        })
      );
    });

    it('throws 400 when hash is not 64 chars', async () => {
      const { req, res, next } = createMocks();
      req.params = { hash: 'short-hash' };

      await verificarBlockchainPublico(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400, message: expect.stringContaining('invalido') })
      );
    });
  });

  describe('getRegistroBlockchain', () => {
    it('returns paginated blockchain registry', async () => {
      const { req, res, next } = createMocks();
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await getRegistroBlockchain(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            manifiestos: [],
            total: 0,
          }),
        })
      );
    });
  });

  describe('getVerificarIntegridad', () => {
    it('throws 404 when manifiesto not found', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'nonexistent' };

      // verificarIntegridad is mocked to return non-null by default
      // We need to override it for this test — but it's already set up via vi.mock
      // So we import and override:
      const blockchainService = await import('../../services/blockchain.service');
      vi.mocked(blockchainService.verificarIntegridad).mockResolvedValueOnce(null as any);

      await getVerificarIntegridad(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 404 })
      );
    });

    it('returns integridad result', async () => {
      const { req, res, next } = createMocks();
      req.params = { id: 'man-1' };

      await getVerificarIntegridad(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            integridad: 'COMPLETA',
          }),
        })
      );
    });
  });

  describe('getVerificarLote', () => {
    it('returns batch verification results', async () => {
      const { req, res, next } = createMocks();

      await getVerificarLote(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalVerificados: 5,
          }),
        })
      );
    });
  });
});
