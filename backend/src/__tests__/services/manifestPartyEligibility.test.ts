import { describe, expect, it, vi } from 'vitest';
vi.mock('../../lib/prisma', () => ({ default: {} }));
vi.mock('../../utils/logger', () => ({ default: { error: vi.fn() } }));
import { validateProposalParties } from '../../services/manifestProposal.service';
import { errorHandler } from '../../middlewares/errorHandler';

const active = (name: string) => ({ activo: true, razonSocial: name, usuario: { id: name, activo: true } });
const transaction = (g = active('Origen QA'), t = active('Transporte QA'), o: unknown = active('Destino QA')) => ({
  generador: { findUnique: vi.fn().mockResolvedValue(g) },
  transportista: { findUnique: vi.fn().mockResolvedValue(t) },
  operador: { findUnique: vi.fn().mockResolvedValue(o) },
});
const ids = { generadorId: 'g', transportistaId: 't', operadorId: 'o' };

describe('actionable manifest party validation', () => {
  it('identifies every affected party and distinguishes actor from account status', async () => {
    const tx = transaction({ ...active('Origen QA'), activo: false }, active('Transporte QA'), { ...active('Destino QA'), usuario: { id: 'uo', activo: false } });
    await expect(validateProposalParties(tx as never, ids)).rejects.toMatchObject({ statusCode: 400,
      fieldErrors: { generador: expect.stringMatching(/Generador.*Origen QA.*actor.*inactivo/), operador: expect.stringMatching(/Operador.*Destino QA.*cuenta.*inactiva/) },
    });
  });
  it('explains missing linked account without suggesting Eventuales for an inactive actor', async () => {
    await expect(validateProposalParties(transaction(undefined, undefined, { activo: true, razonSocial: 'Sin acceso QA', usuario: null }) as never, ids)).rejects.toMatchObject({
      fieldErrors: { operador: expect.stringMatching(/Sin acceso QA.*cuenta.*vinculada/) },
      message: expect.not.stringContaining('Eventuales'),
    });
  });
  it('reports a deleted actor rather than guessing that its account is inactive', async () => {
    await expect(validateProposalParties(transaction(undefined, undefined, null) as never, ids)).rejects.toMatchObject({ fieldErrors: { operador: expect.stringMatching(/Operador.*no se encuentra/) } });
  });
  it('allows active parties and does not invent a transport in the existing in-situ rule', async () => {
    const tx = transaction();
    await expect(validateProposalParties(tx as never, ids)).resolves.toBeUndefined();
    tx.transportista.findUnique.mockClear();
    await expect(validateProposalParties(tx as never, { ...ids, transportistaId: null })).resolves.toBeUndefined();
    expect(tx.transportista.findUnique).not.toHaveBeenCalled();
  });
  it('returns only public field guidance in production, keeping internal details private', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    try {
      const tx = transaction(undefined, undefined, { ...active('Destino QA'), activo: false });
      const err = await validateProposalParties(tx as never, ids).catch(e => e);
      err.details = { secret: 'do-not-expose' };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      errorHandler(err, { method: 'POST', path: '/manifiestos' } as never, res as never, vi.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 400, details: undefined, fieldErrors: { operador: expect.stringContaining('Destino QA') } }));
      expect(JSON.stringify(res.json.mock.calls)).not.toContain('do-not-expose');
    } finally { vi.unstubAllEnvs(); }
  });
});
