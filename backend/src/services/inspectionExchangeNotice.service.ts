import { inspectionManagementRecipientIds } from './inspectionManagementRole.service';
import { ParteIntercambioInspeccion, Prisma, Rol, TipoIntercambioInspeccion } from '@prisma/client';
import type { InspectionExchangeAccessTarget } from './inspectionExchange.service';
import { INSPECTION_EXCHANGE_LABELS } from '../domain/inspectionNoticeLabels';
import { inspectionCompanyNoticeRows } from './inspectionCompanyNotice.service';
export { INSPECTION_EXCHANGE_LABELS } from '../domain/inspectionNoticeLabels';

type NoticeInspection = InspectionExchangeAccessTarget & { id: string; numero: string };
type NoticeExchange = { id: string; secuencia: number; tipo: TipoIntercambioInspeccion; parte: ParteIntercambioInspeccion; autorId: string; plazoRespuestaAt?: Date | null };

/** A secondary activity must have its own approved registration. An associated
 * actor row alone does not authorize a different role on the account. */
export function inspectionParticipantNoticeWhere(inspection: InspectionExchangeAccessTarget): Prisma.UsuarioWhereInput | null {
  if (!inspection.tipoActor) return null;
  const relation = inspection.tipoActor === 'GENERADOR' ? 'generador' : inspection.tipoActor === 'TRANSPORTISTA' ? 'transportista' : 'operador';
  const field = `${relation}Id`, actorId = inspection[field as 'generadorId' | 'transportistaId' | 'operadorId'];
  if (!actorId) return null;
  const owner = { [relation]: { is: { id: actorId } } };
  if (process.env.ACTOR_MULTIROLE_ENABLED !== 'true') return { rol: inspection.tipoActor, ...owner };
  return { ...owner, OR: [
    { rol: inspection.tipoActor },
    { rol: { in: ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'] }, [relation]: { is: { id: actorId, activo: true } },
      solicitudes: { some: { estado: 'APROBADA', tipoActor: inspection.tipoActor, [field]: actorId } } },
  ] };
}

/** Committed atomically with the exchange. Never dispatch external channels here.
 * Actor submissions go to the assigned inspector and competent administrators;
 * authority submissions go only to the linked inspected actor. No copies to the author.
 * Idempotent controller retries return the existing exchange before entering this transaction.
 */
export async function createInspectionExchangeNotices(
  tx: Prisma.TransactionClient,
  inspection: NoticeInspection,
  exchange: NoticeExchange,
): Promise<void> {
  let recipientWhere: Prisma.UsuarioWhereInput;
  const participant = exchange.parte === 'AUTORIDAD';
  if (participant) {
    const owner = inspectionParticipantNoticeWhere(inspection);
    if (!owner) return; // Free-text contacts never grant portal access or receive a notice.
    recipientWhere = owner;
  } else {
    const roles: Rol[] = ['ADMIN'];
    if (inspection.tipoActor) roles.push(`ADMIN_${inspection.tipoActor}` as Rol);
    const managementIds = await inspectionManagementRecipientIds();
    recipientWhere = { OR: [{ rol: { in: roles } }, { id: inspection.inspectorId, esInspector: true }, ...(managementIds.length ? [{ id: { in: managementIds } }] : [])] };
  }
  const recipients = await tx.usuario.findMany({
    where: { AND: [{ activo: true, id: { not: exchange.autorId } }, recipientWhere] },
    select: { id: true },
  });
  const ids = [...new Set(recipients.map(user => user.id))];
  const companyRows = participant ? await inspectionCompanyNoticeRows(tx, inspection,
    { clase: 'intercambio', id: exchange.id, autorId: exchange.autorId }, ids) : [];
  if (!ids.length && !companyRows.length) return;
  const [title, action] = INSPECTION_EXCHANGE_LABELS[exchange.tipo];
  const directRows = ids.map(usuarioId => ({
    usuarioId, tipo: 'INFO_GENERAL', prioridad: 'NORMAL',
    titulo: `PSIP · ${title}`,
    mensaje: `${participant ? ({ GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' }[inspection.tipoActor!] + ' · ') : ''}${inspection.numero} · Actuación #${exchange.secuencia}. ${action}${exchange.plazoRespuestaAt ? ' Plazo para responder: ' + exchange.plazoRespuestaAt.toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' }) + '.' : ''}`,
    datos: JSON.stringify({
      tipo: 'intercambio_inspeccion', version: 1,
      inspeccionId: inspection.id, numero: inspection.numero,
      intercambioId: exchange.id, secuencia: exchange.secuencia, evento: exchange.tipo,
      parte: exchange.parte, destino: participant ? 'participacion' : 'inspeccion',
      ...(participant ? { tipoActor: inspection.tipoActor } : {}),
      // New notices explicitly support the opt-in relay. Historic soloCampana
      // rows remain excluded; provider/family/cutoff/recipient gates still apply.
      correoVersion: 1,
      ...(exchange.plazoRespuestaAt ? { plazoRespuestaAt: exchange.plazoRespuestaAt.toISOString() } : {}),
    }),
  } as Prisma.NotificacionCreateManyInput));
  await tx.notificacion.createMany({ data: [...directRows, ...companyRows] });
}
