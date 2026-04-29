import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ethers — must be before importing the module under test
vi.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: vi.fn(),
    Wallet: vi.fn(),
    Contract: vi.fn(),
  },
}));

// Mock prisma
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();
vi.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    manifiesto: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    blockchainSello: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    eventoManifiesto: {
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

// Mock config — blockchain disabled by default for tests
vi.mock('../../config/config', () => ({
  config: {
    BLOCKCHAIN_ENABLED: false,
    BLOCKCHAIN_RPC_URL: '',
    BLOCKCHAIN_CONTRACT_ADDRESS: '',
  },
}));

import {
  hashManifiesto,
  computeRollingHash,
  computeClosureHash,
  registrarSello,
  verificarEnBlockchain,
  verificarIntegridad,
  verificarLote,
  registrarEnBlockchain,
  procesarPendientes,
} from '../../services/blockchain.service';

describe('BlockchainService — pure hash functions', () => {
  describe('hashManifiesto', () => {
    const baseManifiesto = {
      numero: 'MAN-2025-001',
      generadorId: 'gen-1',
      generador: { cuit: '30-12345678-9' },
      transportistaId: 'trans-1',
      transportista: { cuit: '30-87654321-0' },
      operadorId: 'oper-1',
      operador: { cuit: '30-11223344-5' },
      residuos: [
        { tipoResiduoId: 'Y12', cantidad: 100, unidad: 'kg' },
        { tipoResiduoId: 'Y8', cantidad: 50, unidad: 'kg' },
      ],
      fechaFirma: new Date('2025-06-01T10:00:00Z'),
    };

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = hashManifiesto(baseManifiesto);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces deterministic results for identical input', () => {
      const hash1 = hashManifiesto(baseManifiesto);
      const hash2 = hashManifiesto(baseManifiesto);
      expect(hash1).toBe(hash2);
    });

    it('sorts residuos alphabetically by tipoResiduoId for canonical form', () => {
      const swapped = {
        ...baseManifiesto,
        residuos: [
          { tipoResiduoId: 'Y8', cantidad: 50, unidad: 'kg' },
          { tipoResiduoId: 'Y12', cantidad: 100, unidad: 'kg' },
        ],
      };
      expect(hashManifiesto(swapped)).toBe(hashManifiesto(baseManifiesto));
    });

    it('produces different hashes when numero changes', () => {
      const modified = { ...baseManifiesto, numero: 'MAN-2025-002' };
      expect(hashManifiesto(modified)).not.toBe(hashManifiesto(baseManifiesto));
    });

    it('produces different hashes when cantidad changes', () => {
      const modified = { ...baseManifiesto, residuos: [{ tipoResiduoId: 'Y12', cantidad: 200, unidad: 'kg' }] };
      expect(hashManifiesto(modified)).not.toBe(hashManifiesto(baseManifiesto));
    });

    it('handles null transportista', () => {
      const withoutTransportista = {
        ...baseManifiesto,
        transportistaId: null,
        transportista: null,
      };
      const hash = hashManifiesto(withoutTransportista);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles null fechaFirma', () => {
      const withoutFecha = { ...baseManifiesto, fechaFirma: null };
      const hash = hashManifiesto(withoutFecha);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles empty residuos array', () => {
      const emptyResiduos = { ...baseManifiesto, residuos: [] };
      const hash = hashManifiesto(emptyResiduos);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('computeRollingHash', () => {
    const baseInput = {
      previousHash: 'abc123def456',
      genesisBlockchainTimestamp: '2025-06-01T10:00:00.000Z',
      estado: 'APROBADO',
      fecha: '2025-06-01T10:30:00.000Z',
      eventCount: 1,
      observaciones: null,
    };

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = computeRollingHash(baseInput);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces deterministic results for identical input', () => {
      const hash1 = computeRollingHash(baseInput);
      const hash2 = computeRollingHash(baseInput);
      expect(hash1).toBe(hash2);
    });

    it('changes when estado changes', () => {
      const modified = { ...baseInput, estado: 'EN_TRANSITO' };
      expect(computeRollingHash(modified)).not.toBe(computeRollingHash(baseInput));
    });

    it('changes when previousHash changes', () => {
      const modified = { ...baseInput, previousHash: 'xyz789' };
      expect(computeRollingHash(modified)).not.toBe(computeRollingHash(baseInput));
    });

    it('changes when eventCount changes', () => {
      const modified = { ...baseInput, eventCount: 2 };
      expect(computeRollingHash(modified)).not.toBe(computeRollingHash(baseInput));
    });

    it('handles null previousHash (genesis rolling hash)', () => {
      const modified = { ...baseInput, previousHash: null };
      const hash = computeRollingHash(modified);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles observaciones string', () => {
      const modified = { ...baseInput, observaciones: 'Carga verificada sin novedades' };
      const hash = computeRollingHash(modified);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('computeClosureHash', () => {
    const baseInput = {
      genesisHash: 'genesis-hash-abc',
      rollingHash: 'rolling-hash-def',
      numero: 'MAN-2025-001',
      generadorCuit: '30-12345678-9',
      transportistaCuit: '30-87654321-0',
      operadorCuit: '30-11223344-5',
      residuos: [
        { tipoResiduoId: 'Y12', cantidad: 100, unidad: 'kg' },
        { tipoResiduoId: 'Y8', cantidad: 50, unidad: 'kg' },
      ],
      fechaFirma: '2025-06-01T10:00:00.000Z',
      fechaRetiro: '2025-06-02T08:00:00.000Z',
      fechaEntrega: '2025-06-02T14:00:00.000Z',
      fechaRecepcion: '2025-06-02T15:00:00.000Z',
      fechaCierre: '2025-06-05T12:00:00.000Z',
      eventCount: 8,
    };

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = computeClosureHash(baseInput);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces deterministic results for identical input', () => {
      const hash1 = computeClosureHash(baseInput);
      const hash2 = computeClosureHash(baseInput);
      expect(hash1).toBe(hash2);
    });

    it('sorts residuos alphabetically by tipoResiduoId', () => {
      const swapped = {
        ...baseInput,
        residuos: [
          { tipoResiduoId: 'Y8', cantidad: 50, unidad: 'kg' },
          { tipoResiduoId: 'Y12', cantidad: 100, unidad: 'kg' },
        ],
      };
      expect(computeClosureHash(swapped)).toBe(computeClosureHash(baseInput));
    });

    it('changes when genesisHash changes', () => {
      const modified = { ...baseInput, genesisHash: 'different-genesis' };
      expect(computeClosureHash(modified)).not.toBe(computeClosureHash(baseInput));
    });

    it('changes when rollingHash changes', () => {
      const modified = { ...baseInput, rollingHash: 'different-rolling' };
      expect(computeClosureHash(modified)).not.toBe(computeClosureHash(baseInput));
    });

    it('handles null fechaRetiro, fechaEntrega, fechaRecepcion', () => {
      const modified = {
        ...baseInput,
        fechaRetiro: null,
        fechaEntrega: null,
        fechaRecepcion: null,
      };
      const hash = computeClosureHash(modified);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});

describe('BlockchainService — async functions (blockchain disabled)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registrarSello', () => {
    it('returns early without error when BLOCKCHAIN_ENABLED=false', async () => {
      // Should not throw when blockchain is disabled
      await expect(registrarSello('manifiesto-1', 'GENESIS', 'hash123')).resolves.toBeUndefined();
      // Should not call prisma when blockchain is disabled
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe('registrarEnBlockchain', () => {
    it('returns early without error when BLOCKCHAIN_ENABLED=false', async () => {
      await expect(registrarEnBlockchain('manifiesto-1')).resolves.toBeUndefined();
    });
  });

  describe('verificarEnBlockchain', () => {
    it('returns {exists:false, timestamp:0} when BLOCKCHAIN_ENABLED=false', async () => {
      const result = await verificarEnBlockchain('hash123');
      expect(result).toEqual({ exists: false, timestamp: 0 });
    });
  });

  describe('verificarLote', () => {
    it('is a function', () => {
      expect(typeof verificarLote).toBe('function');
    });
  });

  describe('procesarPendientes', () => {
    it('returns early without error when BLOCKCHAIN_ENABLED=false', async () => {
      await expect(procesarPendientes()).resolves.toBeUndefined();
    });
  });

  describe('verificarIntegridad', () => {
    it('returns null when manifiesto is not found', async () => {
      mockFindUnique.mockResolvedValue(null);
      const result = await verificarIntegridad('nonexistent-id');
      expect(result).toBeNull();
    });

    it('is a function', () => {
      expect(typeof verificarIntegridad).toBe('function');
    });
  });
});
