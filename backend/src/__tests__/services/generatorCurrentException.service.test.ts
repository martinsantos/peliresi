import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ training: vi.fn(() => false), company: vi.fn(async () => [] as unknown[]) }));
vi.mock('../../lib/trainingScope', () => ({ isTrainingSession: m.training }));
vi.mock('../../lib/prisma', () => ({ default: {} }));
vi.mock('../../services/manifestCompanyRecipients.service', () => ({ manifestCompanyRecipients: m.company }));

import { assertManifestCurrentsApprovable, canGrantGeneratorException, closeCoveredGeneratorExceptions, generatorExceptionsEnabled, grantGeneratorException } from '../../services/generatorCurrentException.service';

function makeTx(state: { ficha: string | null; exceptions?: any[]; codes?: string[] }) {
  const notices: any[] = [];
  const tx: any = {
    notices,
    $queryRaw: vi.fn(async () => []),
    generador: { findUniqueOrThrow: vi.fn(async () => ({ id: 'g1', razonSocial: 'Generador QA', corrientesControl: state.ficha, usuarioId: 'u-gen', activo: true })) },
    usuario: { findUnique: vi.fn(async () => ({ id: 'u-gen', activo: true })), findMany: vi.fn(async () => [{ id: 'u-auth' }]) },
    excepcionCorrienteGenerador: {
      findMany: vi.fn(async () => (state.exceptions || []).filter(e => !e.cerradaAt)),
      findUnique: vi.fn(async ({ where }: any) => (state.exceptions || []).find(e => e.id === where.id) || null),
      create: vi.fn(async ({ data }: any) => data),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    manifiesto: { findUniqueOrThrow: vi.fn(async () => ({ id: 'm1', numero: 'M-1', estado: 'PENDIENTE_APROBACION', generadorId: 'g1', residuos: (state.codes || []).map(codigo => ({ tipoResiduo: { codigo } })) })) },
    notificacion: { createMany: vi.fn(async ({ data }: any) => { notices.push(...data); return { count: data.length }; }) },
  };
  return tx;
}
const grant = { generadorId: 'g1', origen: 'ADENDA' as const, origenId: 'a1', manifiestoId: 'm1', numero: 'M-1', corrientes: ['Y34'], detalle: {}, motivo: 'Hallazgo en recepción', userId: 'u-auth', url: '/manifiestos/m1' };

beforeEach(() => { vi.clearAllMocks(); process.env.GENERATOR_Y_EXCEPTIONS_ENABLED = 'true'; process.env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE = 'true'; m.training.mockReturnValue(false); });
afterEach(() => { delete process.env.GENERATOR_Y_EXCEPTIONS_ENABLED; delete process.env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE; });

describe('switch and authority', () => {
  it('is fail-closed and never counts training sessions', () => {
    expect(generatorExceptionsEnabled()).toBe(true);
    m.training.mockReturnValue(true);
    expect(generatorExceptionsEnabled()).toBe(false);
    m.training.mockReturnValue(false);
    delete process.env.GENERATOR_Y_EXCEPTIONS_ENABLED;
    expect(generatorExceptionsEnabled()).toBe(false);
  });
  it('the general administrator or any sector administrator, in their own session, grants', () => {
    for (const rol of ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']) expect(canGrantGeneratorException({ id: 'a', rol })).toBe(true);
    expect(canGrantGeneratorException({ id: 'a', rol: 'GENERADOR' })).toBe(false);
    expect(canGrantGeneratorException({ id: 'a', rol: 'ADMIN_OPERADOR', activo: false })).toBe(false);
    expect(canGrantGeneratorException({ id: 'a', rol: 'OPERADOR' })).toBe(false);
    expect(canGrantGeneratorException({ id: 'a', rol: 'ADMIN', impersonatedBy: { id: 'x' } })).toBe(false);
    delete process.env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE;
    expect(canGrantGeneratorException({ id: 'a', rol: 'ADMIN' })).toBe(false);
  });
});

describe('grant', () => {
  it('records the exception once and notifies generator and authority in the bell only', async () => {
    const tx = makeTx({ ficha: 'Y8' });
    await grantGeneratorException(tx, grant);
    expect(tx.usuario.findMany.mock.calls[0][0].where.rol).toEqual({ in: ['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR'] });
    expect(tx.excepcionCorrienteGenerador.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ generadorId: 'g1', corrientes: ['Y34'], origen: 'ADENDA' }) }));
    expect(tx.notices.map((n: any) => n.usuarioId).sort()).toEqual(['u-auth', 'u-gen']);
    for (const n of tx.notices) {
      const datos = JSON.parse(n.datos);
      expect(datos).toMatchObject({ tipo: 'excepcion_corriente_generador', soloCampana: true });
      expect(datos).not.toHaveProperty('correoVersion');
    }
  });
  it('a retry with the same origin returns the existing grant; different content is refused', async () => {
    const existing = { id: 'x', generadorId: 'g1', manifiestoId: 'm1', corrientes: ['Y34'] };
    const tx = makeTx({ ficha: 'Y8', exceptions: [] });
    tx.excepcionCorrienteGenerador.findUnique.mockResolvedValue(existing);
    await expect(grantGeneratorException(tx, grant)).resolves.toBe(existing);
    await expect(grantGeneratorException(tx, { ...grant, corrientes: ['Y35'] })).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.excepcionCorrienteGenerador.create).not.toHaveBeenCalled();
  });
});

describe('manifest approvals', () => {
  it('refuse every party approval until the authority grants the exception', async () => {
    await expect(assertManifestCurrentsApprovable(makeTx({ ficha: 'Y8', codes: ['Y8', 'Y34'] }), 'm1')).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('La autoridad de aplicación debe otorgar la excepción') });
  });
  it('pass once this manifest holds the exception', async () => {
    await expect(assertManifestCurrentsApprovable(makeTx({ ficha: 'Y8', codes: ['Y34'], exceptions: [{ id: 'e1', corrientes: ['Y34'], manifiestoId: 'm1', cerradaAt: null }] }), 'm1')).resolves.toBeUndefined();
  });
  it('refuse when another exception is open', async () => {
    await expect(assertManifestCurrentsApprovable(makeTx({ ficha: 'Y8', codes: ['Y12'], exceptions: [{ id: 'e0', corrientes: ['Y34'], manifiestoId: 'm0', cerradaAt: null }] }), 'm1')).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('ya tiene una excepción abierta') });
  });
  it('do nothing with the switch off', async () => {
    delete process.env.GENERATOR_Y_EXCEPTIONS_ENABLED;
    const tx = makeTx({ ficha: 'Y8', codes: ['Y34'] });
    await expect(assertManifestCurrentsApprovable(tx, 'm1')).resolves.toBeUndefined();
    expect(tx.manifiesto.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('closing by registration in the ficha', () => {
  it('closes exceptions the ficha now covers and keeps partially covered ones open', async () => {
    const tx = makeTx({ ficha: 'Y8, Y34', exceptions: [
      { id: 'covered', corrientes: ['Y34'], manifiestoId: 'm1', cerradaAt: null },
      { id: 'partial', corrientes: ['Y34', 'Y35'], manifiestoId: 'm2', cerradaAt: null },
    ] });
    expect(await closeCoveredGeneratorExceptions(tx, { generadorId: 'g1', userId: 'u-auth', fuente: 'EDICION_FICHA' })).toEqual(['covered']);
    expect(tx.excepcionCorrienteGenerador.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.excepcionCorrienteGenerador.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: 'covered', cerradaAt: null }, data: { cierre: expect.objectContaining({ motivo: 'ALTA_EN_FICHA', fuente: 'EDICION_FICHA' }) } });
    expect(tx.notices.some((n: any) => n.titulo === 'Excepción cerrada por alta en la ficha')).toBe(true);
  });
});
