import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { isTrainingSession } from '../lib/trainingScope';
import { AppError } from '../middlewares/errorHandler';
import { designatedReviewAccount, reviewAuthorityAccountFilter } from '../domain/manifestReviewAuthority';
import { currentsDecisionMessage, decideGeneratorCurrents, exceptionsCoveredByFicha, generatorAuthorizedCurrents, type CurrentsDecision } from '../domain/generatorCurrents';
import { manifestCompanyRecipients } from './manifestCompanyRecipients.service';

type Tx = Prisma.TransactionClient;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Fail-closed switch. Off: no gate, no record, no notice (behaviour of the previous cut). CAP never counts. */
export function generatorExceptionsEnabled(): boolean {
  return !isTrainingSession() && process.env.GENERATOR_Y_EXCEPTIONS_ENABLED === 'true';
}

/** The competent authority for generator streams: general or generator-sector administrator, designated, own session. */
export function canGrantGeneratorException(user: { id: string; rol: string; activo?: boolean; restricted?: boolean; impersonatedBy?: unknown } | undefined): boolean {
  if (!user || user.activo === false || user.restricted || user.impersonatedBy) return false;
  return ['ADMIN', 'ADMIN_GENERADOR'].includes(user.rol) && designatedReviewAccount(user.id);
}

/** Ficha and exceptions of one generator. `lock` serializes grants for that generator. */
export async function generatorCurrentsState(tx: Tx, generadorId: string, lock = false) {
  if (lock) await tx.$queryRaw`SELECT id FROM generadores WHERE id = ${generadorId} FOR UPDATE`;
  const generador = await tx.generador.findUniqueOrThrow({ where: { id: generadorId }, select: { id: true, razonSocial: true, corrientesControl: true, usuarioId: true, activo: true } });
  const exceptions = await tx.excepcionCorrienteGenerador.findMany({ where: { generadorId, cerradaAt: null }, orderBy: { createdAt: 'asc' } });
  return { generador, authorized: generatorAuthorizedCurrents(generador.corrientesControl), exceptions };
}

export async function evaluateGeneratorCurrents(tx: Tx, input: { generadorId: string; manifiestoId: string; corrientes: string[]; lock?: boolean }): Promise<{ decision: CurrentsDecision; state: Awaited<ReturnType<typeof generatorCurrentsState>> }> {
  const state = await generatorCurrentsState(tx, input.generadorId, input.lock);
  return { decision: decideGeneratorCurrents({ corrientes: input.corrientes, authorized: state.authorized, manifiestoId: input.manifiestoId, exceptions: state.exceptions }), state };
}

async function generatorRecipients(tx: Tx, generador: { usuarioId: string; activo: boolean }, manifiestoId: string) {
  const owner = await tx.usuario.findUnique({ where: { id: generador.usuarioId }, select: { id: true, activo: true } });
  const company = (await manifestCompanyRecipients(tx, manifiestoId)).filter(r => r.accesosEmpresa.some(a => a.rol === 'GENERADOR'));
  const access = new Map(company.map(r => [r.usuarioId, r.accesosEmpresa.filter(a => a.rol === 'GENERADOR')]));
  const ids = [...new Set([...(owner?.activo && generador.activo !== false ? [owner.id] : []), ...company.map(r => r.usuarioId)])];
  return ids.map(id => ({ id, accesosEmpresa: access.get(id) }));
}
async function authorityRecipients(tx: Tx) {
  return tx.usuario.findMany({ where: { ...reviewAuthorityAccountFilter(), rol: { in: ['ADMIN', 'ADMIN_GENERADOR'] }, activo: true }, select: { id: true } });
}

type Notice = { key: string; titulo: string; mensaje: string; prioridad: 'ALTA' | 'URGENTE'; tipo: 'INFO_GENERAL' | 'ALERTA_SISTEMA'; url: string; manifiestoId: string | null; datos: Record<string, unknown> };
/** Bell only (durable inbox). No mail (no correoVersion) and no push: the outbound allowlists stay unchanged. */
async function notify(tx: Tx, users: { id: string; accesosEmpresa?: unknown[] }[], notice: Notice) {
  if (!users.length) return;
  await tx.notificacion.createMany({ skipDuplicates: true, data: users.map(user => ({
    id: digest(`excepcion-corriente:${notice.key}:${user.id}`), usuarioId: user.id, tipo: notice.tipo, prioridad: notice.prioridad,
    titulo: notice.titulo, mensaje: notice.mensaje, ...(notice.manifiestoId ? { manifiestoId: notice.manifiestoId } : {}),
    datos: JSON.stringify({ tipo: 'excepcion_corriente_generador', version: 1, soloCampana: true, url: notice.url, ...notice.datos,
      ...(user.accesosEmpresa?.length ? { accesosEmpresa: user.accesosEmpresa } : {}) }),
  })) });
}

export type GrantInput = {
  generadorId: string; origen: 'ADENDA' | 'MANIFIESTO'; origenId: string; manifiestoId: string; numero: string;
  corrientes: string[]; detalle: Prisma.InputJsonValue; motivo: string; userId: string; impersonadoPorId?: string | null; url: string;
};
/** Idempotent per (origen, origenId). The caller already holds the generator lock and checked REQUIERE_EXCEPCION. */
export async function grantGeneratorException(tx: Tx, input: GrantInput) {
  const id = digest(`${input.origen}:${input.origenId}`);
  const existing = await tx.excepcionCorrienteGenerador.findUnique({ where: { id } });
  if (existing) {
    if (existing.generadorId !== input.generadorId || existing.manifiestoId !== input.manifiestoId || existing.corrientes.join(',') !== [...input.corrientes].sort().join(',')) {
      throw new AppError('La excepción de ese origen ya fue registrada con otro contenido', 409);
    }
    return existing;
  }
  const corrientes = [...new Set(input.corrientes)].sort();
  const created = await tx.excepcionCorrienteGenerador.create({ data: {
    id, generadorId: input.generadorId, origen: input.origen, origenId: input.origenId, manifiestoId: input.manifiestoId,
    corrientes, detalle: input.detalle, motivo: input.motivo, otorgadaPorId: input.userId, impersonadoPorId: input.impersonadoPorId || null,
  } });
  const state = await tx.generador.findUniqueOrThrow({ where: { id: input.generadorId }, select: { usuarioId: true, activo: true, razonSocial: true } });
  const ys = corrientes.join(', ');
  await notify(tx, await generatorRecipients(tx, state, input.manifiestoId), { key: `otorgada:${id}`, tipo: 'INFO_GENERAL', prioridad: 'ALTA', url: input.url, manifiestoId: input.manifiestoId,
    titulo: 'Excepción otorgada por corriente no inscripta',
    mensaje: `${input.numero} · ${ys}. La autoridad de aplicación otorgó la única excepción disponible. Tramitá el alta de ${ys} en tu ficha: hasta entonces no podrás mover ninguna corriente que no figure en ella.`,
    datos: { evento: 'OTORGADA', excepcionId: id, corrientes, generadorId: input.generadorId } });
  await notify(tx, await authorityRecipients(tx), { key: `otorgada-autoridad:${id}`, tipo: 'INFO_GENERAL', prioridad: 'ALTA', url: input.url, manifiestoId: input.manifiestoId,
    titulo: 'Excepción de corriente registrada',
    mensaje: `${input.numero} · ${state.razonSocial} · ${ys}. Queda abierta hasta el alta en la ficha del generador.`,
    datos: { evento: 'OTORGADA', excepcionId: id, corrientes, generadorId: input.generadorId } });
  return created;
}

/** Warn when a Y outside the ficha appears while an exception is open. Committed with the triggering record. */
export async function noticeBlockedCurrents(tx: Tx, input: { generadorId: string; manifiestoId: string; numero: string; corrientes: string[]; abierta: { id: string; corrientes: string[] }; origenId: string; url: string; momento: 'ADENDA' | 'CREACION' }) {
  const state = await tx.generador.findUniqueOrThrow({ where: { id: input.generadorId }, select: { usuarioId: true, activo: true, razonSocial: true } });
  const ys = input.corrientes.join(', '), open = input.abierta.corrientes.join(', ');
  await notify(tx, await authorityRecipients(tx), { key: `reiterada:${input.origenId}`, tipo: 'ALERTA_SISTEMA', prioridad: 'URGENTE', url: input.url, manifiestoId: input.manifiestoId,
    titulo: 'Corriente no inscripta reiterada',
    mensaje: `${input.numero} · ${state.razonSocial} · ${ys}. El generador ya tiene una excepción abierta por ${open}: no admite otra hasta el alta en su ficha. Evaluá agendar una inspección.`,
    datos: { evento: 'REITERADA', corrientes: input.corrientes, excepcionAbierta: input.abierta.id, generadorId: input.generadorId, momento: input.momento } });
  await notify(tx, await generatorRecipients(tx, state, input.manifiestoId), { key: `reiterada-generador:${input.origenId}`, tipo: 'ALERTA_SISTEMA', prioridad: 'URGENTE', url: input.url, manifiestoId: input.manifiestoId,
    titulo: 'Corriente no inscripta: requiere alta en tu ficha',
    mensaje: `${input.numero} · ${ys}. Ya tenés una excepción abierta por ${open}. No se puede otorgar otra: tramitá el alta de las corrientes en tu ficha.`,
    datos: { evento: 'REITERADA', corrientes: input.corrientes, excepcionAbierta: input.abierta.id, generadorId: input.generadorId, momento: input.momento } });
}

export async function manifestDeclaredCurrents(tx: Tx, manifiestoId: string) {
  const manifest = await tx.manifiesto.findUniqueOrThrow({ where: { id: manifiestoId }, select: { id: true, numero: true, estado: true, generadorId: true,
    residuos: { select: { tipoResiduo: { select: { codigo: true } } } } } });
  return { manifest, corrientes: [...new Set(manifest.residuos.map(r => r.tipoResiduo.codigo))] };
}
/** Every party approval passes here: a Y outside the ficha needs the authority exception first. */
export async function assertManifestCurrentsApprovable(tx: Tx, manifiestoId: string) {
  if (!generatorExceptionsEnabled()) return;
  const { manifest, corrientes } = await manifestDeclaredCurrents(tx, manifiestoId);
  const { decision } = await evaluateGeneratorCurrents(tx, { generadorId: manifest.generadorId, manifiestoId, corrientes });
  const message = currentsDecisionMessage(decision, 'APROBACION');
  if (message) throw new AppError(message, 409);
}

/** A record awaits the authority: only it can grant the generator's single exception. */
export async function noticeAuthorityRequired(tx: Tx, input: { generadorId: string; manifiestoId: string; numero: string; corrientes: string[]; origenId: string; url: string; momento: 'ADENDA' | 'MANIFIESTO' }) {
  const state = await tx.generador.findUniqueOrThrow({ where: { id: input.generadorId }, select: { razonSocial: true } });
  const ys = input.corrientes.join(', ');
  await notify(tx, await authorityRecipients(tx), { key: `requiere:${input.origenId}`, tipo: 'INFO_GENERAL', prioridad: 'ALTA', url: input.url, manifiestoId: input.manifiestoId,
    titulo: input.momento === 'ADENDA' ? 'Adenda con corriente no inscripta: requiere tu aprobación' : 'Manifiesto con corriente no inscripta: requiere tu excepción',
    mensaje: `${input.numero} · ${state.razonSocial} · ${ys}. Sólo la autoridad de aplicación puede otorgar la excepción, que es la única disponible para el generador.`,
    datos: { evento: 'REQUIERE_AUTORIDAD', corrientes: input.corrientes, generadorId: input.generadorId, momento: input.momento } });
}

/** A refused creation leaves no manifest; one authority alert per generator, streams and day (no flood on retries). */
export async function noticeBlockedCreation(input: { generadorId: string; corrientes: string[]; abierta: { id: string; corrientes: string[] } }) {
  if (!generatorExceptionsEnabled()) return;
  const day = new Date().toISOString().slice(0, 10), ys = input.corrientes.join(', ');
  await prisma.$transaction(async tx => {
    const state = await tx.generador.findUniqueOrThrow({ where: { id: input.generadorId }, select: { razonSocial: true } });
    await notify(tx, await authorityRecipients(tx), { key: `creacion-bloqueada:${input.generadorId}:${ys}:${day}`, tipo: 'ALERTA_SISTEMA', prioridad: 'URGENTE',
      url: '/admin/actores/generadores/' + input.generadorId, manifiestoId: null,
      titulo: 'Manifiesto rechazado: corriente no inscripta reiterada',
      mensaje: `${state.razonSocial} intentó declarar ${ys} con una excepción abierta por ${input.abierta.corrientes.join(', ')}. El manifiesto no se creó. Evaluá agendar una inspección.`,
      datos: { evento: 'CREACION_BLOQUEADA', corrientes: input.corrientes, excepcionAbierta: input.abierta.id, generadorId: input.generadorId } });
  });
}

/** Called after any ficha change. Closes recorded-open exceptions the ficha now covers, for the history. */
export async function closeCoveredGeneratorExceptions(tx: Tx, input: { generadorId: string; userId: string | null; fuente: 'EDICION_FICHA' | 'RENOVACION' | 'CONTROL'; referencia?: string }) {
  if (!generatorExceptionsEnabled()) return [];
  const state = await generatorCurrentsState(tx, input.generadorId, true);
  const covered = exceptionsCoveredByFicha(state.exceptions, state.authorized);
  const closedAt = new Date();
  for (const e of covered) {
    const done = await tx.excepcionCorrienteGenerador.updateMany({ where: { id: e.id, cerradaAt: null }, data: { cerradaAt: closedAt,
      cierre: { motivo: 'ALTA_EN_FICHA', fuente: input.fuente, usuarioId: input.userId, referencia: input.referencia || null, ficha: state.generador.corrientesControl } } });
    if (!done.count) continue;
    await notify(tx, await generatorRecipients(tx, state.generador, e.manifiestoId), { key: `cerrada:${e.id}`, tipo: 'INFO_GENERAL', prioridad: 'ALTA', url: '/manifiestos/' + e.manifiestoId, manifiestoId: e.manifiestoId,
      titulo: 'Excepción cerrada por alta en la ficha',
      mensaje: `${e.corrientes.join(', ')} ya figura en tu ficha. La excepción quedó cerrada y su historial se conserva.`,
      datos: { evento: 'CERRADA', excepcionId: e.id, corrientes: e.corrientes, generadorId: input.generadorId } });
  }
  return covered.map(e => e.id);
}
