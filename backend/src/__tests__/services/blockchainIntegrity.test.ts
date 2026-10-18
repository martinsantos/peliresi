import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ manifiesto: { findUnique: vi.fn() }, eventoManifiesto: { count: vi.fn() } }));
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('../../config/config', () => ({ config: { BLOCKCHAIN_ENABLED: false } }));
import { computeClosureHash, hashManifiesto, verificarIntegridad } from '../../services/blockchain.service';

const base = () => ({ id: 'qa', numero: 'QA-1', generadorId: 'g', transportistaId: null, operadorId: 'o', generador: { cuit: '99' }, transportista: null, operador: { cuit: '98' }, residuos: [], fechaFirma: new Date('2026-09-01'), fechaRetiro: null, fechaEntrega: null, fechaRecepcion: null, fechaCierre: new Date('2026-09-02'), rollingHash: 'unreplayed-chain', eventos: [{ tipo: 'FIRMA', integrityHash: 'unreplayed-chain' }], sellosBlockchain: [] as { tipo: string; hash: string; status: string }[] });
beforeEach(() => { vi.clearAllMocks(); db.eventoManifiesto.count.mockResolvedValue(1); });
describe('honest integrity status', () => {
  it('does not claim an unreplayed event chain is intact', async () => {
    db.manifiesto.findUnique.mockResolvedValue(base());
    const result = await verificarIntegridad('qa');
    expect(result?.rollingChainIntacta).toBeNull();
    expect(result?.rollingChainPasos).toBe(1);
    expect(result?.integridad).toBe('SIN_SELLOS');
  });
  it('does not equate matching endpoint hashes with a verified complete chain', async () => {
    const m = base();
    const genesisHash = hashManifiesto(m);
    const closure = computeClosureHash({ genesisHash, rollingHash: m.rollingHash, numero: m.numero, generadorCuit: '99', transportistaCuit: '', operadorCuit: '98', residuos: [], fechaFirma: m.fechaFirma.toISOString(), fechaRetiro: null, fechaEntrega: null, fechaRecepcion: null, fechaCierre: m.fechaCierre.toISOString(), eventCount: 1 });
    m.sellosBlockchain = [{ tipo: 'GENESIS', status: 'CONFIRMADO', hash: genesisHash }, { tipo: 'CIERRE', status: 'CONFIRMADO', hash: closure }];
    db.manifiesto.findUnique.mockResolvedValue(m);
    const result = await verificarIntegridad('qa');
    expect(result?.genesisVerificado).toBe(true);
    expect(result?.cierreVerificado).toBe(true);
    expect(result?.integridad).toBe('PARCIAL');
    expect(result?.rollingChainIntacta).toBeNull();
  });
  it('still reports actual hash mismatches as failed', async () => {
    const m = base();
    m.sellosBlockchain = [{ tipo: 'GENESIS', status: 'CONFIRMADO', hash: 'incorrecto' }];
    db.manifiesto.findUnique.mockResolvedValue(m);
    expect((await verificarIntegridad('qa'))?.integridad).toBe('FALLIDA');
  });
});
