import { createHash } from 'node:crypto';
import type { Prisma, AntecedenteFiscalizacion, TipoActorInspeccion } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { splitDeclaredWasteStreams } from './inspectionDeclaredSnapshot.service';
import { hashCanonicalPayload } from './inspectionDocumentIntegrity.service';
import { wasteDifferences, type ObservedWaste } from '../domain/inspectionIntake';

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Intake = { origen: string; origenId: string; referencia: string; tipoActor: TipoActorInspeccion; actorId?: string | null;
  actorNombre: string; motivos: string[]; evidencia: Prisma.InputJsonValue; creadoPorId: string };

/** Same transaction as its operational source. No external I/O or actor/permit mutation. */
export async function recordInspectionIntake(tx: Prisma.TransactionClient, input: Intake) {
  if (!input.motivos.length) return;
  const claveOrigen = `${input.origen}:${input.origenId}:${input.tipoActor}`;
  const id = digest(claveOrigen), huellaEvidencia = hashCanonicalPayload(input.evidencia);
  const inserted = await tx.antecedenteFiscalizacion.createMany({ skipDuplicates: true, data: [{
    ...input, id, claveOrigen, actorId: input.actorId || null, huellaEvidencia, eventos: [],
  }] });
  if (!inserted.count) return;
  const recipients = await tx.usuario.findMany({ where: { activo: true, rol: { in: ['ADMIN', `ADMIN_${input.tipoActor}` as 'ADMIN_OPERADOR'] }, id: { not: input.creadoPorId } }, select: { id: true } });
  await tx.notificacion.createMany({ skipDuplicates: true, data: recipients.map(user => ({
    id: digest(`antecedente:${id}:${user.id}`), usuarioId: user.id, tipo: 'INFO_GENERAL',
    titulo: 'Nuevo antecedente para evaluar en PSIP', mensaje: `${input.referencia} · ${input.actorNombre}. Administración debe evaluar el antecedente; no acredita una infracción.`,
    datos: JSON.stringify({ tipo: 'antecedente_fiscalizacion', version: 1, correoVersion: 1, antecedenteId: id, url: '/inspecciones?vista=antecedentes' }),
  })) });
}

export async function buildOperatorFinding(tx: Prisma.TransactionClient, input: {
  operadorId: string; autorId: string; estado: string; motivo: string; declarado: ObservedWaste[]; observado: ObservedWaste[];
}) {
  const operator = await tx.operador.findUniqueOrThrow({ where: { id: input.operadorId }, select: {
    id: true, razonSocial: true, corrientesY: true, updatedAt: true, numeroHabilitacion: true, resolucionDPA: true, vencimientoHabilitacion: true,
  } });
  const streams = splitDeclaredWasteStreams(operator.corrientesY);
  const alcanceOperador = {
    fuente: 'operador.corrientesY', actorId: operator.id, nombre: operator.razonSocial,
    valorOriginal: operator.corrientesY, corrientes: streams, fichaActualizadaAt: operator.updatedAt.toISOString(),
    numeroHabilitacion: operator.numeroHabilitacion, resolucion: operator.resolucionDPA,
    vencimiento: operator.vencimientoHabilitacion?.toISOString() || null,
    estado: streams.length ? 'FICHA_DISPONIBLE' : 'SIN_DATOS_VERIFICABLES',
    corrientesNoRegistradas: streams.length ? [...new Set(input.observado.map(row => row.corriente).filter(y => !streams.includes(y)))] : [],
    advertencia: 'Comparación con la ficha guardada; no certifica habilitación ni compatibilidad de tratamiento.',
  };
  return { formato: 'SITREP-INFORME-HALLAZGO-1', autorId: input.autorId, fecha: new Date().toISOString(), estadoAlRegistrar: input.estado,
    motivo: input.motivo, declarado: input.declarado, observado: input.observado,
    diferencias: wasteDifferences(input.declarado, input.observado), alcanceOperador };
}
export type OperatorFinding = Awaited<ReturnType<typeof buildOperatorFinding>>;

export async function recordFindingIntakes(tx: Prisma.TransactionClient, input: {
  adendaId: string; referencia: string; generadorId: string; creadoPorId: string; informe: OperatorFinding;
}) {
  const report = input.informe;
  const general = { origen: 'INFORME_ADENDA', origenId: input.adendaId, referencia: input.referencia, creadoPorId: input.creadoPorId };
  if (report.diferencias.length) {
    const generator = await tx.generador.findUniqueOrThrow({ where: { id: input.generadorId }, select: { razonSocial: true } });
    await recordInspectionIntake(tx, { ...general, tipoActor: 'GENERADOR', actorId: input.generadorId, actorNombre: generator.razonSocial,
      motivos: [...new Set(report.diferencias.map(row => row.tipo))], evidencia: report });
  }
  const scope = report.alcanceOperador;
  const motives = scope.estado === 'SIN_DATOS_VERIFICABLES' ? ['ALCANCE_SIN_VERIFICAR'] : scope.corrientesNoRegistradas.length ? ['Y_NO_CONSTA_EN_FICHA_OPERADOR'] : [];
  await recordInspectionIntake(tx, { ...general, tipoActor: 'OPERADOR', actorId: scope.actorId, actorNombre: scope.nombre,
    motivos: motives, evidencia: report });
}

export async function recordEventualIntakes(tx: Prisma.TransactionClient, record: {
  id: string; creadoPorId: string; datos: Prisma.JsonValue; etapa: string;
}) {
  const data = record.datos as Record<string, unknown>;
  for (const role of ['generador', 'transportista', 'operador'] as const) {
    const party = (data[role] || {}) as { padronId?: string; nombre?: string; identificacion?: string; domicilio?: string };
    if (party.padronId) continue;
    await recordInspectionIntake(tx, { origen: 'PARTICIPANTE_EVENTUAL', origenId: record.id, referencia: 'BI-' + record.id,
      tipoActor: role.toUpperCase() as TipoActorInspeccion, actorNombre: party.nombre || 'Participante sin nombre declarado', creadoPorId: record.creadoPorId,
      motivos: ['PARTICIPANTE_SIN_ALTA', ...(!party.nombre || !party.identificacion || !party.domicilio ? ['IDENTIDAD_INCOMPLETA'] : [])],
      evidencia: { participante: party, etapaAlRegistrar: record.etapa, motivo: String(data.motivo || ''),
        advertencia: 'Participante declarado sin vínculo de padrón; no acredita actividad efectivamente realizada ni identidad validada.' } });
  }
}

export function assertIntakeInspection(intake: Pick<AntecedenteFiscalizacion, 'tipoActor' | 'actorId'>,
  inspection: { tipoActor: TipoActorInspeccion | null; generadorId: string | null; transportistaId: string | null; operadorId: string | null }) {
  const id = intake.tipoActor === 'GENERADOR' ? inspection.generadorId : intake.tipoActor === 'TRANSPORTISTA' ? inspection.transportistaId : inspection.operadorId;
  if (intake.actorId ? inspection.tipoActor !== intake.tipoActor || intake.actorId !== id : inspection.tipoActor !== null) {
    throw new AppError('El expediente debe corresponder al mismo actor; un externo sin identidad sólo se vincula a un expediente sin responsable', 409);
  }
}
