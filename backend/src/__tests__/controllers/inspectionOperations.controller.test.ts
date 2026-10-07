import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  inspeccion: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn(), create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  usuario: { findUnique: vi.fn(), findMany: vi.fn() },
  secuenciaInspeccion: { findUnique: vi.fn(), upsert: vi.fn() },
  eventoInspeccion: { create: vi.fn() }, notificacion: { create: vi.fn() },
  generador: { findMany: vi.fn() }, transportista: { findMany: vi.fn() }, operador: { findMany: vi.fn() }, sedeOperador: { findMany: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
}));
const snapshot = vi.hoisted(() => vi.fn());
vi.mock('../../lib/prisma', () => ({ default: db }));
vi.mock('../../services/inspectionDeclaredSnapshot.service', () => ({ buildDeclaredInspectionSnapshot: snapshot, ensureInspectionDeclaredComparisons: vi.fn() }));
import { crearInspeccion } from '../../controllers/inspeccion.controller';
import { candidatosTerritorialesInspeccion, operacionesInspecciones, organizarInspeccion } from '../../controllers/inspectionOperations.controller';

const user = { id: 'admin', rol: 'ADMIN', activo: true, esInspector: true };
const caseRow = { id: 'i1', numero: 'IRP-2026-00001', tipoActor: null, inspectorId: 'admin', estado: 'BORRADOR', version: 1, generadorId: null, operadorId: null, transportistaId: null, latitud: -32.9, longitud: -68.8 };
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (work) => Array.isArray(work) ? Promise.all(work) : work(db));
  db.inspeccion.findUnique.mockResolvedValue(null);
  db.inspeccion.findUniqueOrThrow.mockResolvedValue(caseRow);
  db.inspeccion.create.mockResolvedValue(caseRow);
  db.inspeccion.findMany.mockResolvedValue([caseRow]);
  db.inspeccion.updateMany.mockResolvedValue({ count: 1 });
  db.inspeccion.count.mockResolvedValue(1);
  db.inspeccion.groupBy.mockResolvedValue([{ estado: 'BORRADOR', _count: { _all: 1 } }]);
  db.usuario.findUnique.mockResolvedValue(user);
  db.secuenciaInspeccion.findUnique.mockResolvedValue(null);
  db.secuenciaInspeccion.upsert.mockResolvedValue({ ultimo: 1 });
  snapshot.mockResolvedValue({ fields: [], actorId: 'g1' });
});

describe('creation independent of registered actors', () => {
  it.each([['PETROLEO', 'PRP', 'PET-01'], ['AIRE', 'ARP', 'AIR-01'], ['GENERADOR', 'GRP', 'GEN-01'], ['TRANSPORTISTA', 'TRP', 'TRA-01'], ['OPERADOR', 'ORP', 'OPE-01'], ['ESPONTANEA', 'IRP', 'HAL-01']])('allocates %s with its own five-digit series and field form without an actor', async (tipoInspeccion, serie, codigo) => {
    const next = vi.fn();
    await crearInspeccion({ user, body: { tipoInspeccion, clienteId: 'type-test-001' } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.secuenciaInspeccion.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ serie, ultimo: 1 }) }));
    expect(db.inspeccion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipoActor: null, numero: expect.stringMatching(new RegExp(`^${serie}-\\d{4}-00001$`)), items: { create: expect.arrayContaining([expect.objectContaining({ codigo })]) } }) });
  });
  it('creates a finding with a field checklist and no declared snapshot', async () => {
    const next = vi.fn(); const res = response();
    await crearInspeccion({ user, body: { clienteId: 'finding-001', ubicacion: 'Ruta 7', latitud: -32.9, longitud: -68.8 } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(snapshot).not.toHaveBeenCalled();
    expect(db.inspeccion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipoActor: null, numero: expect.stringMatching(/^IRP-\d{4}-00001$/), clienteId: 'admin:finding-001', comparaciones: { create: [] }, items: { create: expect.arrayContaining([expect.objectContaining({ codigo: 'HAL-01' })]) } }) });
  });
  it('reuses an acknowledged request without allocating a second number', async () => {
    const input = { clienteId: 'finding-001', observaciones: 'Hallazgo' };
    await crearInspeccion({ user, body: input } as any, response() as any, vi.fn());
    const createdData = db.inspeccion.create.mock.calls[0][0].data;
    db.inspeccion.findUnique.mockResolvedValue({ ...caseRow, ...createdData });
    db.inspeccion.create.mockClear(); db.secuenciaInspeccion.upsert.mockClear();
    const next = vi.fn();
    await crearInspeccion({ user, body: input } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled(); expect(db.inspeccion.create).not.toHaveBeenCalled(); expect(db.secuenciaInspeccion.upsert).not.toHaveBeenCalled();
  });
  it('rejects reuse of the same key with changed content', async () => {
    db.inspeccion.findUnique.mockResolvedValue({ ...caseRow, huellaCreacion: 'different' });
    const next = vi.fn();
    await crearInspeccion({ user, body: { clienteId: 'finding-001' } } as any, response() as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(409); expect(db.inspeccion.create).not.toHaveBeenCalled();
  });
  it('does not allocate beyond five digits', async () => {
    db.secuenciaInspeccion.findUnique.mockResolvedValue({ ultimo: 99999 });
    const next = vi.fn();
    await crearInspeccion({ user, body: {} } as any, response() as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(409); expect(db.secuenciaInspeccion.upsert).not.toHaveBeenCalled();
  });
  it('does not let sector administration create an out-of-scope finding', async () => {
    const next = vi.fn();
    await crearInspeccion({ user: { ...user, rol: 'ADMIN_OPERADOR' }, body: {} } as any, response() as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
  it('notifies a scheduled assignment exactly once across an idempotent retry', async () => {
    const input = { clienteId: 'agenda-001', fechaProgramada: '2026-09-25T12:00:00Z' };
    const next = vi.fn();
    await crearInspeccion({ user, body: input } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.notificacion.create.mock.calls[0][0].data).toMatchObject({ usuarioId: user.id, tipo: 'INFO_GENERAL' });
    const createdData = db.inspeccion.create.mock.calls[0][0].data;
    db.inspeccion.findUnique.mockResolvedValue({ ...caseRow, ...createdData });
    await crearInspeccion({ user, body: input } as any, response() as any, next);
    expect(db.notificacion.create).toHaveBeenCalledTimes(1);
  });
});

describe('shared operational scope and organization', () => {
  it('excludes drafts and terminal inspections from the default operational list and all its totals', async () => {
    const next = vi.fn();
    await operacionesInspecciones({ user, path: '/operaciones', query: {} } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    const where = db.inspeccion.findMany.mock.calls[0][0].where;
    expect(where.AND).toContainEqual({ estado: { notIn: ['BORRADOR', 'CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'] } });
    expect(db.inspeccion.count.mock.calls[0][0].where).toEqual(where);
    expect(db.inspeccion.groupBy.mock.calls[0][0].where).toEqual(where);
    for (const call of db.inspeccion.count.mock.calls.slice(1)) expect(call[0].where.AND[0]).toEqual(where);
  });
  it('keeps drafts queryable when explicitly requesting all states, without changing permissions', async () => {
    const next = vi.fn();
    await operacionesInspecciones({ user: { ...user, rol: 'ADMIN_GENERADOR' }, path: '/operaciones', query: { activas: 'false', estado: 'BORRADOR' } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.inspeccion.findMany.mock.calls[0][0].where.AND).toEqual([{ tipoActor: 'GENERADOR' }, { estado: 'BORRADOR' }]);
  });
  it('uses assignment scope and scheduled date rather than createdAt', async () => {
    const next = vi.fn(); const res = response();
    await operacionesInspecciones({ user: { ...user, rol: 'GENERADOR' }, path: '/operaciones', query: { desde: '2026-09-24', hasta: '2026-09-24', inspectorId: 'other' } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled();
    expect(db.inspeccion.findMany.mock.calls[0][0].where.AND).toEqual(expect.arrayContaining([{ inspectorId: 'admin' }, { inspectorId: 'other' }, { fechaProgramada: { gte: new Date('2026-09-24T03:00:00Z'), lte: new Date('2026-09-25T02:59:59.999Z') } }]));
    expect(res.json.mock.calls[0][0].data.summary.byState).toEqual({ BORRADOR: 1 });
  });
  it('forbids a non-inspector from reading operational totals', async () => {
    const next = vi.fn();
    await operacionesInspecciones({ user: { ...user, rol: 'GENERADOR', esInspector: false }, query: {} } as any, response() as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403); expect(db.inspeccion.findMany).not.toHaveBeenCalled();
  });
  it('links an identified subject without renumbering or replacing field controls', async () => {
    db.inspeccion.findUnique.mockResolvedValue(caseRow);
    const next = vi.fn();
    await organizarInspeccion({ user, params: { id: 'i1' }, body: { version: 1, tipoActor: 'GENERADOR', actorId: 'g1', motivo: 'Identidad verificada en campo' } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    const data = db.inspeccion.update.mock.calls[0][0].data;
    expect(data.numero).toBeUndefined(); expect(data.items.deleteMany).toBeUndefined(); expect(data.generador).toEqual({ connect: { id: 'g1' } });
    expect(db.eventoInspeccion.create).toHaveBeenCalled();
  });
  it('rejects stale changes before writing an assignment, subject or notification', async () => {
    db.inspeccion.findUnique.mockResolvedValue(caseRow); db.inspeccion.updateMany.mockResolvedValue({ count: 0 });
    const next = vi.fn();
    await organizarInspeccion({ user, params: { id: 'i1' }, body: { version: 1, fechaProgramada: null, motivo: 'Reprogramar visita' } } as any, response() as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(409); expect(db.inspeccion.update).not.toHaveBeenCalled(); expect(db.notificacion.create).not.toHaveBeenCalled();
  });
  it.each(['PRP', 'ARP'])('links a responsible actor without replacing the %s form or legajo', async (serie) => {
    db.inspeccion.findUnique.mockResolvedValue({ ...caseRow, numero: `${serie}-2026-00001` });
    const next = vi.fn();
    await organizarInspeccion({ user, params: { id: 'i1' }, body: { version: 1, tipoActor: 'GENERADOR', actorId: 'g1', motivo: 'Identidad verificada' } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled();
    const data = db.inspeccion.update.mock.calls[0][0].data;
    expect(data.numero).toBeUndefined(); expect(data.items).toBeUndefined();
    expect(data.generador).toEqual({ connect: { id: 'g1' } });
  });
  it('cannot change a GRP inspection into a transport inspection when linking later', async () => {
    db.inspeccion.findUnique.mockResolvedValue({ ...caseRow, numero: 'GRP-2026-00001' });
    const next = vi.fn();
    await organizarInspeccion({ user, params: { id: 'i1' }, body: { version: 1, tipoActor: 'TRANSPORTISTA', actorId: 't1', motivo: 'Identidad verificada' } } as any, response() as any, next);
    expect(next.mock.calls[0][0].statusCode).toBe(400);
    expect(db.inspeccion.update).not.toHaveBeenCalled();
  });
  it('records agenda changes and persistent notification in the transaction', async () => {
    db.inspeccion.findUnique.mockResolvedValue(caseRow);
    const next = vi.fn();
    await organizarInspeccion({ user, params: { id: 'i1' }, body: { version: 1, fechaProgramada: '2026-10-01T12:00:00Z', motivo: 'Programación de visita' } } as any, response() as any, next);
    expect(next).not.toHaveBeenCalled(); expect(db.inspeccion.update.mock.calls[0][0].data.estado).toBe('PLANIFICADA');
    expect(db.notificacion.create.mock.calls[0][0].data.datos).toContain('i1');
  });
  it('searches the registry without a recent-manifest restriction and never links automatically', async () => {
    db.inspeccion.findUnique.mockResolvedValue(caseRow);
    db.generador.findMany.mockResolvedValue([{ id: 'g1', razonSocial: 'Generador', domicilio: 'Ruta 7', latitud: -32.9, longitud: -68.8, activo: false }]);
    db.transportista.findMany.mockResolvedValue([]); db.operador.findMany.mockResolvedValue([]); db.sedeOperador.findMany.mockResolvedValue([]);
    const next = vi.fn(); const res = response();
    await candidatosTerritorialesInspeccion({ user, params: { id: 'i1' } } as any, res as any, next);
    expect(next).not.toHaveBeenCalled(); expect(res.json.mock.calls[0][0].data.items[0]).toMatchObject({ id: 'g1', distanciaMetros: 0, activo: false });
    expect(db.generador.findMany.mock.calls[0][0].where.manifiestos).toBeUndefined(); expect(db.inspeccion.update).not.toHaveBeenCalled();
  });
});
