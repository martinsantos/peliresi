import { describe, expect, it, vi } from 'vitest';
import { MANIFEST_PROPOSAL } from '../domain/manifestProposal';
import { ProposalImpactAccumulator, auditProposalImpact, type ImpactRecord } from '../services/proposalImpactAudit.service';

const proposal = { version: 1, modalidad: 'FIJO', generadorId: 'private-generator', transportistaId: 'private-carrier',
  operadorId: 'private-operator', creadoPorId: 'private-user', autorRol: 'GENERADOR' };
const at = (seconds: number) => new Date(`2026-10-30T12:00:${String(seconds).padStart(2, '0')}.000Z`);
const marker = () => ({ tipo: MANIFEST_PROPOSAL, descripcion: JSON.stringify(proposal), usuarioId: 'private-user', createdAt: at(10) });
const decision = (tipo: string, rol: string, actorId: string, seconds: number) => ({ tipo, usuarioId: 'private-user', createdAt: at(seconds),
  descripcion: JSON.stringify({ version: 1, rol, actorId, decision: 'APROBADA' }) });
const approvals = () => [decision('FIRMA', 'GENERADOR', 'private-generator', 20),
  decision('APROBACION_TRANSPORTISTA', 'TRANSPORTISTA', 'private-carrier', 21),
  decision('APROBACION_OPERADOR', 'OPERADOR', 'private-operator', 22)];
const coordination = (seconds = 30) => ({ tipo: 'INICIO_COORDINACION', usuarioId: 'private-user', descripcion: '', createdAt: at(seconds) });
const record = (eventos: ImpactRecord['eventos'], overrides: Partial<ImpactRecord> = {}): ImpactRecord => ({
  estado: 'APROBADO', modalidad: 'FIJO', generadorId: proposal.generadorId, transportistaId: proposal.transportistaId,
  operadorId: proposal.operadorId, creadoPorId: proposal.creadoPorId, eventos, ...overrides,
});
const ready = () => record([marker(), ...approvals(), coordination()]);

describe('anonymous approval impact analysis', () => {
  it('counts each candidate once by the same readiness rules and distinguishes malformed evidence', () => {
    const collector = new ProposalImpactAccumulator();
    const badDecision = approvals(); badDecision[1].descripcion = JSON.stringify({ version: 1, rol: 'TRANSPORTISTA', actorId: 'wrong', decision: 'APROBADA' });
    const oldOrigin = { ...proposal, modalidad: 'IN_SITU', transportistaId: null };
    const cases = [
      record([], { estado: 'BORRADOR' }),
      record([{ ...marker(), descripcion: '{' }], { estado: 'PENDIENTE_APROBACION' }),
      record([marker(), marker()]),
      record([marker()], { operadorId: 'wrong' }),
      record([{ ...marker(), descripcion: JSON.stringify(oldOrigin) }], { modalidad: 'IN_SITU', transportistaId: null }),
      record([marker(), ...approvals(), { ...coordination(), tipo: 'RECHAZO_PARTE' }]),
      record([marker(), ...badDecision, coordination()]),
      record([marker(), ...approvals().slice(0, 2)], { estado: 'PENDIENTE_APROBACION' }),
      record([marker(), ...approvals()]), ready(),
    ];
    for (const entry of cases) collector.add(entry);
    const report = collector.report('ARTIFICIAL');
    expect(report.total).toBe(cases.length);
    expect(report.categoriasExcluyentes.reduce((sum, row) => sum + row.cantidad, 0)).toBe(cases.length);
    expect(report.categoriasExcluyentes.map(row => row.causa).sort()).toEqual([
      'SIN_PROPUESTA', 'MARCADOR_INVALIDO', 'MARCADORES_MULTIPLES', 'PARTES_O_MODALIDAD_DISTINTAS',
      'SIN_TRANSPORTE', 'RECHAZO_REGISTRADO', 'DECISION_INVALIDA', 'FALTAN_APROBACIONES',
      'FALTA_COORDINACION', 'SIN_OBSERVACION_ESTRUCTURAL',
    ].sort());
    const serialized = JSON.stringify(report);
    for (const value of ['private-generator', 'private-carrier', 'private-operator', 'private-user', 'wrong']) expect(serialized).not.toContain(value);
  });

  it('flags suspicious chronology and ties without asserting who was authorized', () => {
    const collector = new ProposalImpactAccumulator();
    const earlyDecision = approvals(); earlyDecision[0].createdAt = at(5);
    const tiedDecision = approvals(); tiedDecision[0].createdAt = at(10);
    const missingDate: ImpactRecord['eventos'] = approvals(); missingDate[0].createdAt = null;
    for (const events of [
      [marker(), ...approvals(), coordination()],
      [marker(), ...earlyDecision, coordination()],
      [marker(), ...approvals(), coordination(15)],
      [marker(), ...tiedDecision, coordination(22)],
      [marker(), ...missingDate, coordination()],
    ]) collector.add(record(events));
    expect(collector.report('ARTIFICIAL').cronologia).toEqual({ listosEvaluados: 5, fechaFaltante: 1,
      decisionAnteriorAPropuesta: 1, coordinacionAnteriorADecisiones: 1, fechasIguales: 1 });
  });

  it('does not mutate an already returned report when the scan continues', () => {
    const collector = new ProposalImpactAccumulator(); collector.add(ready());
    const before = collector.report('ARTIFICIAL'); collector.add(ready());
    expect(before.total).toBe(1); expect(before.categoriasExcluyentes[0].cantidad).toBe(1);
    expect(collector.report('ARTIFICIAL').total).toBe(2);
  });

  it('counts state contradictions separately without treating the checks as exclusive', () => {
    const collector = new ProposalImpactAccumulator();
    collector.add(record([marker(), ...approvals().slice(0, 2)]));
    collector.add(record([marker(), ...approvals()], { estado: 'PENDIENTE_APROBACION' }));
    collector.add(record([marker()], { estado: 'BORRADOR' }));
    expect(collector.report('ARTIFICIAL').coherenciaEstado).toEqual({
      aprobadoSinAlgunEventoDeAprobacion: 1, pendienteConTresDecisiones: 1, borradorConMarcador: 1,
    });
  });
});

describe('read-only scan contract', () => {
  it('uses a verified read-only snapshot and paginates without returning identifiers', async () => {
    const first = { ...ready(), id: 'private-row-1' }, second = { ...ready(), id: 'private-row-2' };
    const tx = { $executeRaw: vi.fn().mockResolvedValue(0),
      $queryRaw: vi.fn().mockResolvedValue([{ read_only: 'on', isolation: 'repeatable read' }]),
      manifiesto: { findMany: vi.fn().mockResolvedValueOnce([first]).mockResolvedValueOnce([second]).mockResolvedValueOnce([]) } };
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const report = await auditProposalImpact(db as never, { kind: 'synthetic', prefix: 'QA-REVIEW' }, 1);
    expect(tx.$executeRaw).toHaveBeenCalledOnce(); expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.manifiesto.findMany).toHaveBeenCalledTimes(3);
    expect(tx.manifiesto.findMany.mock.calls[0][0].where).toMatchObject({ isDemoData: true, numero: { startsWith: 'QA-REVIEW' } });
    expect(tx.manifiesto.findMany.mock.calls[1][0]).toMatchObject({ cursor: { id: 'private-row-1' }, skip: 1 });
    expect(report.total).toBe(2); expect(JSON.stringify(report)).not.toContain('private-');
    expect(db.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'RepeatableRead' });
  });

  it('does not return a partial report on transaction or page failure', async () => {
    const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn().mockResolvedValue([{ read_only: 'off', isolation: 'repeatable read' }]),
      manifiesto: { findMany: vi.fn() } };
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    await expect(auditProposalImpact(db as never, { kind: 'synthetic', prefix: 'QA-REVIEW' })).rejects.toThrow(/sólo lectura/);
    expect(tx.manifiesto.findMany).not.toHaveBeenCalled();
    tx.$queryRaw.mockResolvedValue([{ read_only: 'on', isolation: 'repeatable read' }]);
    tx.manifiesto.findMany.mockResolvedValueOnce([{ ...ready(), id: 'private-row' }]).mockRejectedValueOnce(new Error('failed'));
    await expect(auditProposalImpact(db as never, { kind: 'synthetic', prefix: 'QA-REVIEW' }, 1)).rejects.toThrow('failed');
  });

  it('uses the non-demo scope for an operational scan without adding a number filter', async () => {
    const expected = { database: 'expected-db', address: '127.0.0.1', port: 55440, schema: 'expected-schema' };
    const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn().mockResolvedValueOnce([{ read_only: 'on', isolation: 'repeatable read' }]).mockResolvedValueOnce([expected]),
      manifiesto: { findMany: vi.fn().mockResolvedValue([]) } };
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const report = await auditProposalImpact(db as never, { kind: 'operational', expected });
    const where = tx.manifiesto.findMany.mock.calls[0][0].where;
    expect(where.isDemoData).toBe(false); expect(where).not.toHaveProperty('numero');
    expect(report).toMatchObject({ total: 0, lectura: { soloLectura: true, alcance: 'OPERATIVO' } });
  });

  it('refuses a mismatched database before reading manifest records', async () => {
    const expected = { database: 'expected-db', address: '127.0.0.1', port: 55440, schema: 'expected-schema' };
    const tx = { $executeRaw: vi.fn(), $queryRaw: vi.fn().mockResolvedValueOnce([{ read_only: 'on', isolation: 'repeatable read' }])
      .mockResolvedValueOnce([{ ...expected, port: 55441 }]), manifiesto: { findMany: vi.fn() } };
    const db = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    await expect(auditProposalImpact(db as never, { kind: 'operational', expected })).rejects.toThrow(/destino/);
    expect(tx.manifiesto.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid scope or pagination before contacting the database', async () => {
    const db = { $transaction: vi.fn() };
    await expect(auditProposalImpact(db as never, { kind: 'synthetic', prefix: 'not-synthetic' })).rejects.toThrow();
    await expect(auditProposalImpact(db as never, { kind: 'synthetic', prefix: 'QA-REVIEW' }, 501)).rejects.toThrow();
    await expect(auditProposalImpact(db as never, { kind: 'unexpected' } as never)).rejects.toThrow();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
