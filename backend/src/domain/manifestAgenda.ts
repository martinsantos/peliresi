import type { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';
import { APPROVAL_EVENTS, MANIFEST_PROPOSAL, type ProposalRole } from './manifestProposal';
import { CERTIFICATE_MANAGED, CERTIFICATE_EVENT } from '../services/manifestCertificate.service';

export function agendaQuery(query: Record<string, unknown>, role: string, certificates: boolean, training: boolean, now = new Date()) {
  const integer = (value: unknown, fallback: number, max: number) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) throw new AppError('Página o cantidad inválida', 400);
    return Number(value);
  };
  const page = integer(query.page, 1, 1_000_000), limit = integer(query.limit, 6, 50);
  const filter = query.filter ?? 'all', period = query.period ?? 'all';
  if (!['all', 'mine', 'waiting', 'progress', 'certificates', 'drafts'].includes(String(filter)) || !['all', 'today', 'future'].includes(String(period))) throw new AppError('Filtro de agenda inválido', 400);
  if (query.search !== undefined && (typeof query.search !== 'string' || query.search.length > 80)) throw new AppError('La búsqueda admite hasta 80 caracteres', 400);
  const pendingCertificate: Prisma.ManifiestoWhereInput = training
    ? { estado: 'TRATADO', eventos: { none: { tipo: 'CERTIFICADO_CAP_V1', descripcion: { contains: '"tipo":"FINAL"' } } } }
    : certificates ? { estado: 'TRATADO', certificados: { none: { tipo: 'FINAL' } },
      eventos: { some: { tipo: { in: [CERTIFICATE_MANAGED, CERTIFICATE_EVENT] } } } } : { id: { in: [] } };
  const active: Prisma.ManifiestoWhereInput = { estado: { in: ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'] } };
  const approval = APPROVAL_EVENTS[role as ProposalRole];
  const mine: Prisma.ManifiestoWhereInput = approval ? { estado: 'PENDIENTE_APROBACION', AND: [
    { eventos: { some: { tipo: MANIFEST_PROPOSAL } } }, { eventos: { none: { tipo: approval } } },
  ] } : { id: { in: [] } };
  const categories: Record<string, Prisma.ManifiestoWhereInput> = {
    all: {}, mine, waiting: { estado: 'PENDIENTE_APROBACION', NOT: mine }, drafts: { estado: 'BORRADOR' },
    progress: { estado: { in: ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'] } }, certificates: pendingCertificate,
  };
  const base: Prisma.ManifiestoWhereInput = { OR: [active, pendingCertificate] };
  if (query.search) base.numero = { contains: String(query.search).trim(), mode: 'insensitive' };
  // This is the application's established Mendoza calendar, independent of device/host timezone.
  const day = now.toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Mendoza' });
  const start = new Date(day + 'T00:00:00-03:00'), end = new Date(start.getTime() + 86400000);
  if (period === 'today') base.fechaEstimadaRetiro = { gte: start, lt: end };
  if (period === 'future') base.fechaEstimadaRetiro = { gte: end };
  const orderBy: Prisma.ManifiestoOrderByWithRelationInput[] = period === 'future'
    ? [{ fechaEstimadaRetiro: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }]
    : [{ createdAt: 'desc' }, { id: 'desc' }];
  return { page, limit, filter: String(filter), base, categories, orderBy };
}
