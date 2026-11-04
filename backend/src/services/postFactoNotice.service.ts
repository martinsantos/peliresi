import { manifestFeatureEnabled } from '../lib/manifestTraining';
import { isTrainingSession } from '../lib/trainingScope';
import { AppError } from '../middlewares/errorHandler';
import { Prisma } from '@prisma/client';
import { ADDENDUM_AUTHORITY_ROLES } from '../domain/addendumAuthority';
import { reviewAuthorityAccountFilter } from '../domain/manifestReviewAuthority';

function currents(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap(row => row && typeof row === 'object' && typeof row.corriente === 'string' ? [row.corriente] : []) : [];
}
/** Durable authority notice. Mail is opt-in after commit; no delivery or permit mutation here. */
export async function noticeNewCurrents(tx: Prisma.TransactionClient, original: unknown, observed: unknown, url: string, reviewId: string, reviewerId?: string, adenda?: { id: string; version: number; manifiestoId: string; numero: string }) {
  if (!manifestFeatureEnabled('MANIFEST_PARTY_REVIEW_ENABLED')) return;
  const added = [...new Set(currents(observed).filter(y => !currents(original).includes(y)))];
  if (!added.length) return;
  // The classroom uses its own team's synthetic authority inbox. This grants
  // no regulatory review permission and never notifies an operational user.
  const school = isTrainingSession() && /^(cap-\d{8})-(?:generador|transportista|operador)-([1-5])$/.exec(reviewerId || '');
  const accountFilter = isTrainingSession()
    ? { id: { in: school ? [school[1] + '-admin-' + school[2]] : [] } }
    : reviewAuthorityAccountFilter();
  // Sector administrators are eligible only for ordinary addenda. Eventual and
  // classroom authority boundaries remain unchanged.
  const rol = adenda && !isTrainingSession() ? { in: ADDENDUM_AUTHORITY_ROLES } : 'ADMIN' as const;
  const recipients = await tx.usuario.findMany({ where: { ...accountFilter, rol, activo: true }, select: { id: true } });
  if (!recipients.length) throw new AppError('No se pudo registrar la aprobación: falta una autoridad activa designada para recibir las corrientes nuevas. Pedí a Administración que revise la configuración; tu motivo se conserva para reintentar.', 409);
  await tx.notificacion.createMany({ data: recipients.map(user => ({
    usuarioId: user.id, tipo: 'INFO_GENERAL', titulo: 'Nueva corriente aprobada post facto',
    mensaje: (adenda ? `${adenda.numero} · adenda v${adenda.version}. ` : '') + added.join(', ') + '. Aprobación individual registrada; no modifica habilitaciones ni acredita unanimidad.',
    ...(adenda ? { manifiestoId: adenda.manifiestoId } : {}),
    prioridad: 'ALTA', datos: JSON.stringify({ tipo: 'ADENDA_POST_FACTO', ...(adenda ? { correoVersion: 1 } : {}), url, reviewId, reviewerId, corrientes: added, ...(adenda ? { adendaId: adenda.id, versionAdenda: adenda.version, manifiestoId: adenda.manifiestoId } : {}) }),
  })) });
}
