import { ParteIntercambioInspeccion, Prisma, Rol, TipoIntercambioInspeccion } from '@prisma/client';
import type { InspectionExchangeAccessTarget } from './inspectionExchange.service';

type NoticeInspection = InspectionExchangeAccessTarget & { id: string; numero: string };
type NoticeExchange = { id: string; secuencia: number; tipo: TipoIntercambioInspeccion; parte: ParteIntercambioInspeccion; autorId: string };

export const INSPECTION_EXCHANGE_LABELS: Record<TipoIntercambioInspeccion, [string, string]> = {
  REQUERIMIENTO: ['Nuevo requerimiento', 'Revisá el pedido y su plazo para responder desde el expediente.'],
  RESPUESTA: ['Nueva respuesta', 'Abrí el intercambio para leer la respuesta y revisar qué sigue.'],
  DESCARGO: ['Descargo presentado', 'Revisá el descargo recibido antes de resolver.'],
  SUBSANACION: ['Subsanación presentada', 'Revisá la documentación recibida antes de resolver.'],
  PRONUNCIAMIENTO: ['Pronunciamiento disponible', 'Consultá el pronunciamiento de la autoridad en el expediente.'],
  CIERRE_CONFORME: ['Cierre conforme', 'La autoridad cerró el seguimiento conforme. Consultá el fundamento en el expediente.'],
  DERIVACION_LEGALES: ['Derivación a Legales', 'La autoridad derivó el expediente a Legales. Consultá el fundamento de la decisión.'],
};

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
    if (inspection.tipoActor === 'GENERADOR' && inspection.generadorId) {
      recipientWhere = { rol: 'GENERADOR', generador: { is: { id: inspection.generadorId } } };
    } else if (inspection.tipoActor === 'TRANSPORTISTA' && inspection.transportistaId) {
      recipientWhere = { rol: 'TRANSPORTISTA', transportista: { is: { id: inspection.transportistaId } } };
    } else if (inspection.tipoActor === 'OPERADOR' && inspection.operadorId) {
      recipientWhere = { rol: 'OPERADOR', operador: { is: { id: inspection.operadorId } } };
    } else return; // Free-text contacts never grant portal access or receive a notice.
  } else {
    const roles: Rol[] = ['ADMIN'];
    if (inspection.tipoActor) roles.push(`ADMIN_${inspection.tipoActor}` as Rol);
    recipientWhere = { OR: [{ rol: { in: roles } }, { id: inspection.inspectorId, esInspector: true }] };
  }
  const recipients = await tx.usuario.findMany({
    where: { AND: [{ activo: true, id: { not: exchange.autorId } }, recipientWhere] },
    select: { id: true },
  });
  const ids = [...new Set(recipients.map(user => user.id))];
  if (!ids.length) return;
  const [title, action] = INSPECTION_EXCHANGE_LABELS[exchange.tipo];
  await tx.notificacion.createMany({ data: ids.map(usuarioId => ({
    usuarioId, tipo: 'INFO_GENERAL', prioridad: 'NORMAL',
    titulo: `PSIP · ${title}`,
    mensaje: `${inspection.numero} · Actuación #${exchange.secuencia}. ${action}`,
    datos: JSON.stringify({
      tipo: 'intercambio_inspeccion', version: 1,
      inspeccionId: inspection.id, numero: inspection.numero,
      intercambioId: exchange.id, secuencia: exchange.secuencia, evento: exchange.tipo,
      parte: exchange.parte, destino: participant ? 'participacion' : 'inspeccion',
      // New notices explicitly support the opt-in relay. Historic soloCampana
      // rows remain excluded; provider/family/cutoff/recipient gates still apply.
      correoVersion: 1,
    }),
  })) });
}
