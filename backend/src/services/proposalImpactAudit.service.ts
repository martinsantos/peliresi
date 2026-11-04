import { Prisma, PrismaClient } from '@prisma/client';
import {
  APPROVAL_EVENTS, COORDINATION_EVENTS, MANIFEST_PROPOSAL, inspectProposal,
  manifestReadiness, proposalApprovalEvidenceValid, proposalRoles, proposalStateConflict, type ManifestReadiness,
} from '../domain/manifestProposal';

/** The audit reads only these pre-operation states. It does not repair records. */
const STATES = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO'] as const;
const EVENT_TYPES = [MANIFEST_PROPOSAL, ...Object.values(APPROVAL_EVENTS), 'RECHAZO_PARTE', ...COORDINATION_EVENTS];
type State = typeof STATES[number];
type Event = { tipo: string; descripcion: string | null; usuarioId: string | null; createdAt: Date | null };
export type ImpactRecord = {
  estado: State; modalidad: string | null; generadorId: string; transportistaId: string | null;
  operadorId: string; creadoPorId: string; eventos: Event[];
};
type Cause = 'SIN_PROPUESTA' | 'MARCADOR_INVALIDO' | 'MARCADORES_MULTIPLES' | 'PARTES_O_MODALIDAD_DISTINTAS'
  | 'SIN_TRANSPORTE' | 'RECHAZO_REGISTRADO' | 'DECISION_INVALIDA' | 'FALTAN_APROBACIONES'
  | 'FALTA_COORDINACION' | 'ESTADO_O_COORDINACION' | 'SIN_OBSERVACION_ESTRUCTURAL';
type Row = { estado: State; modalidad: 'FIJO' | 'IN_SITU' | 'OTRA'; estadoAprobacion: ManifestReadiness; causa: Cause; cantidad: number };
type TimingCounts = { listosEvaluados: number; fechaFaltante: number; decisionAnteriorAPropuesta: number;
  coordinacionAnteriorADecisiones: number; fechasIguales: number };
type StateChecks = { aprobadoSinAlgunEventoDeAprobacion: number; pendienteConTresDecisiones: number; borradorConMarcador: number };
export type ProposalImpactReport = {
  version: 1; total: number; categoriasExcluyentes: Row[]; coherenciaEstado: StateChecks; cronologia: TimingCounts;
  lectura: { soloLectura: true; aislamiento: 'repeatable read'; alcance: 'ARTIFICIAL' | 'OPERATIVO' };
};

function cause(record: ImpactRecord, readiness: ManifestReadiness): Cause {
  const snapshot = inspectProposal(record, record.eventos);
  if (snapshot.kind === 'missing') return 'SIN_PROPUESTA';
  if (snapshot.kind === 'invalid') return 'MARCADOR_INVALIDO';
  if (snapshot.kind === 'duplicate') return 'MARCADORES_MULTIPLES';
  if (snapshot.kind === 'mismatch') return 'PARTES_O_MODALIDAD_DISTINTAS';
  if (readiness === 'SIN_TRANSPORTE') return 'SIN_TRANSPORTE';
  if (readiness === 'RECHAZADA') return 'RECHAZO_REGISTRADO';
  if (readiness === 'INCONSISTENTE') return (snapshot.kind === 'legacy-in-situ'
    || (snapshot.kind === 'valid' && proposalApprovalEvidenceValid(snapshot.proposal, record.eventos)))
    && proposalStateConflict(record, snapshot.proposal, record.eventos) ? 'ESTADO_O_COORDINACION' : 'DECISION_INVALIDA';
  if (readiness === 'FALTAN_APROBACIONES') return 'FALTAN_APROBACIONES';
  if (readiness === 'FALTA_COORDINACION') return 'FALTA_COORDINACION';
  return 'SIN_OBSERVACION_ESTRUCTURAL';
}

/** Counts use only the first qualifying decision for each role, matching the
 * current presence-based workflow. Timestamp ties are uncertain, not proof of
 * wrongdoing; signer authorization is not reconstructed by this check. */
function inspectReadyTiming(events: Event[], timing: TimingCounts): void {
  timing.listosEvaluados++;
  const first = (types: string[]) => {
    const dates = events.filter(event => types.includes(event.tipo)).map(event => event.createdAt?.getTime() ?? NaN);
    return dates.length && dates.every(Number.isFinite) ? dates.reduce((a, b) => Math.min(a, b)) : NaN;
  };
  const marker = first([MANIFEST_PROPOSAL]);
  const approvals = Object.values(APPROVAL_EVENTS).map(type => first([type]));
  const coordination = first(COORDINATION_EVENTS);
  if (![marker, ...approvals, coordination].every(Number.isFinite)) { timing.fechaFaltante++; return; }
  if (approvals.some(date => date < marker)) timing.decisionAnteriorAPropuesta++;
  const lastApproval = Math.max(...approvals);
  if (coordination < lastApproval) timing.coordinacionAnteriorADecisiones++;
  if (approvals.some(date => date === marker) || coordination === lastApproval) timing.fechasIguales++;
}

/** Does not retain or return record, account, or participant identifiers. */
export class ProposalImpactAccumulator {
  private readonly groups = new Map<string, Row>();
  private readonly timing: TimingCounts = { listosEvaluados: 0, fechaFaltante: 0, decisionAnteriorAPropuesta: 0,
    coordinacionAnteriorADecisiones: 0, fechasIguales: 0 };
  private readonly stateChecks: StateChecks = { aprobadoSinAlgunEventoDeAprobacion: 0, pendienteConTresDecisiones: 0, borradorConMarcador: 0 };
  private total = 0;

  add(record: ImpactRecord): void {
    if (!STATES.includes(record.estado)) throw new Error('Estado fuera del alcance de la auditoría');
    const modalidad = !record.modalidad || record.modalidad === 'FIJO' ? 'FIJO' : record.modalidad === 'IN_SITU' ? 'IN_SITU' : 'OTRA';
    const estadoAprobacion = manifestReadiness(record, record.eventos);
    const motivo = cause(record, estadoAprobacion);
    const key = JSON.stringify([record.estado, modalidad, estadoAprobacion, motivo]);
    const row = this.groups.get(key) ?? { estado: record.estado, modalidad, estadoAprobacion, causa: motivo, cantidad: 0 };
    row.cantidad++; this.groups.set(key, row); this.total++;
    if (record.estado === 'APROBADO' && !Object.values(APPROVAL_EVENTS).every(type => record.eventos.some(event => event.tipo === type))) {
      this.stateChecks.aprobadoSinAlgunEventoDeAprobacion++;
    }
    const snapshot = inspectProposal(record, record.eventos);
    if (record.estado === 'PENDIENTE_APROBACION' && snapshot.kind === 'valid'
      && !record.eventos.some(event => event.tipo === 'RECHAZO_PARTE')
      && proposalApprovalEvidenceValid(snapshot.proposal, record.eventos)
      && proposalRoles(snapshot.proposal).every(role => record.eventos.some(event => event.tipo === APPROVAL_EVENTS[role]))) {
      this.stateChecks.pendienteConTresDecisiones++;
    }
    if (record.estado === 'BORRADOR' && record.eventos.some(event => event.tipo === MANIFEST_PROPOSAL)) this.stateChecks.borradorConMarcador++;
    if (estadoAprobacion === 'LISTA') inspectReadyTiming(record.eventos, this.timing);
  }

  report(alcance: ProposalImpactReport['lectura']['alcance']): ProposalImpactReport {
    const rows = Array.from(this.groups.values(), row => ({ ...row })).sort((a, b) =>
      a.estado.localeCompare(b.estado) || a.modalidad.localeCompare(b.modalidad)
      || a.estadoAprobacion.localeCompare(b.estadoAprobacion) || a.causa.localeCompare(b.causa));
    return { version: 1, total: this.total, categoriasExcluyentes: rows, coherenciaEstado: { ...this.stateChecks }, cronologia: { ...this.timing },
      lectura: { soloLectura: true, aislamiento: 'repeatable read', alcance } };
  }
}

export type DatabaseIdentity = { database: string; address: string; port: number; schema: string };
export type AuditScope = { kind: 'synthetic'; prefix: string } | { kind: 'operational'; expected: DatabaseIdentity };

/** One repeatable-read, read-only transaction gives the counts a coherent
 * snapshot. Rows are paginated and only anonymous aggregates are returned. */
export async function auditProposalImpact(db: PrismaClient, scope: AuditScope, pageSize = 100): Promise<ProposalImpactReport> {
  if (!scope || !['synthetic', 'operational'].includes(scope.kind)) throw new Error('Alcance inválido');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error('Tamaño de página inválido');
  if (scope.kind === 'synthetic' && !/^QA-[A-Z0-9-]{5,80}$/.test(scope.prefix)) throw new Error('Prefijo artificial inválido');
  if (scope.kind === 'operational' && (!scope.expected?.database || !scope.expected.address || !scope.expected.schema
    || !Number.isInteger(scope.expected.port) || scope.expected.port < 1 || scope.expected.port > 65535)) throw new Error('Identidad de destino incompleta');
  const where: Prisma.ManifiestoWhereInput = { estado: { in: [...STATES] }, isDemoData: scope.kind === 'synthetic',
    ...(scope.kind === 'synthetic' ? { numero: { startsWith: scope.prefix } } : {}) };
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    const settings = await tx.$queryRaw<Array<{ read_only: string; isolation: string }>>`
      SELECT current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation`;
    if (settings[0]?.read_only !== 'on' || settings[0]?.isolation !== 'repeatable read') throw new Error('La transacción no es una instantánea de sólo lectura');
    if (scope.kind === 'operational') {
      const target = await tx.$queryRaw<DatabaseIdentity[]>`
        SELECT current_database() AS database, host(inet_server_addr()) AS address,
               inet_server_port() AS port, current_schema() AS schema`;
      const actual = target[0], expected = scope.expected;
      if (!actual || actual.database !== expected.database || actual.address !== expected.address
        || actual.port !== expected.port || actual.schema !== expected.schema) throw new Error('La base de destino no coincide con la identidad esperada');
    }
    const accumulator = new ProposalImpactAccumulator();
    let cursor: string | undefined;
    for (;;) {
      const page = await tx.manifiesto.findMany({ where, orderBy: { id: 'asc' }, take: pageSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, estado: true, modalidad: true, generadorId: true, transportistaId: true, operadorId: true, creadoPorId: true,
          eventos: { where: { tipo: { in: EVENT_TYPES } }, select: { tipo: true, descripcion: true, usuarioId: true, createdAt: true } } },
      });
      for (const record of page) accumulator.add(record as ImpactRecord);
      if (page.length < pageSize) break;
      cursor = page[page.length - 1].id;
    }
    return accumulator.report(scope.kind === 'synthetic' ? 'ARTIFICIAL' : 'OPERATIVO');
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 90000, maxWait: 5000 });
}
