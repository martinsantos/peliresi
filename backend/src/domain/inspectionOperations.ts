import { EstadoInspeccion, TipoActorInspeccion, type Prisma } from '@prisma/client';
import { z } from 'zod';

export const INSPECTION_ADMIN_ROLES = new Set(['ADMIN', 'ADMIN_GENERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_OPERADOR']);
export const INSPECTION_TERMINAL_STATES: EstadoInspeccion[] = ['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA'];
export const isInspectionStaff = (user: any): boolean => Boolean(user?.esInspector) || INSPECTION_ADMIN_ROLES.has(String(user?.rol));

export const INSPECTION_TYPES = {
  GENERADOR: { serie: 'GRP', label: 'Generador' },
  TRANSPORTISTA: { serie: 'TRP', label: 'Transporte' },
  OPERADOR: { serie: 'ORP', label: 'Operador' },
  PETROLEO: { serie: 'PRP', label: 'Petróleo' },
  AIRE: { serie: 'ARP', label: 'Aire' },
  ESPONTANEA: { serie: 'IRP', label: 'Espontánea / denuncia' },
} as const;
export type InspectionType = keyof typeof INSPECTION_TYPES;
export const inspectionTypeSchema = z.enum(['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'PETROLEO', 'AIRE', 'ESPONTANEA']);

/** The immutable official series preserves the inspection's subject even after
 * a responsible actor is linked. Legacy I- records retain their actor meaning;
 * no historical number, counter or document fingerprint is rewritten. */
export function inspectionTypeOf(record: { numero: string; tipoActor?: string | null }): InspectionType {
  const serie = /^(GRP|TRP|ORP|PRP|ARP|IRP)-\d{4}-\d{5}$/.exec(record.numero)?.[1];
  return (Object.keys(INSPECTION_TYPES) as InspectionType[]).find((type) => INSPECTION_TYPES[type].serie === serie)
    || (record.tipoActor === 'GENERADOR' || record.tipoActor === 'TRANSPORTISTA' || record.tipoActor === 'OPERADOR' ? record.tipoActor : 'ESPONTANEA');
}

export function inspectionTypeFilter(type: InspectionType): Prisma.InspeccionWhereInput {
  const official = { numero: { startsWith: INSPECTION_TYPES[type].serie + '-' } };
  if (type === 'PETROLEO' || type === 'AIRE') return official;
  return { OR: [official, { AND: [
    { NOT: { OR: Object.values(INSPECTION_TYPES).map(({ serie }) => ({ numero: { startsWith: serie + '-' } })) } },
    { tipoActor: type === 'ESPONTANEA' ? null : type },
  ] }] };
}

export function inspectionScopeForUser(user: any): Prisma.InspeccionWhereInput {
  if (user?.rol === 'ADMIN') return {};
  if (user?.rol === 'ADMIN_GENERADOR') return { tipoActor: 'GENERADOR' };
  if (user?.rol === 'ADMIN_TRANSPORTISTA') return { tipoActor: 'TRANSPORTISTA' };
  if (user?.rol === 'ADMIN_OPERADOR') return { tipoActor: 'OPERADOR' };
  // Fail closed, including callers which forgot the staff guard.
  return isInspectionStaff(user) && user?.id ? { inspectorId: user.id } : { id: { in: [] } };
}

export const inspectionCreateSchema = z.object({
  tipoInspeccion: inspectionTypeSchema.optional(),
  tipoActor: z.nativeEnum(TipoActorInspeccion).optional().nullable(),
  actorId: z.string().min(1).optional().nullable(),
  clienteId: z.string().min(8).max(100).optional(),
  inspectorId: z.string().min(1).optional(),
  numeroActa: z.string().trim().max(80).optional().nullable(),
  ubicacion: z.string().trim().max(300).optional().nullable(),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
  fechaProgramada: z.string().datetime().optional().nullable(),
  observaciones: z.string().trim().max(10_000).optional().nullable(),
}).refine((value) => Boolean(value.tipoActor) === Boolean(value.actorId), {
  message: 'Seleccione tipo y actor juntos, o deje ambos pendientes de identificación',
}).refine((value) => (value.latitud == null) === (value.longitud == null), {
  message: 'La ubicación necesita latitud y longitud juntas',
}).refine((value) => !value.tipoInspeccion || !value.tipoActor || !['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(value.tipoInspeccion) || value.tipoInspeccion === value.tipoActor, {
  message: 'El tipo de actor no corresponde al tipo de inspección',
});

export function inspectionSeries(tipoActor?: TipoActorInspeccion | null, tipoInspeccion?: InspectionType): string {
  return INSPECTION_TYPES[tipoInspeccion || tipoActor || 'ESPONTANEA'].serie;
}

export function inspectionYear(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'America/Argentina/Mendoza' }).format(date));
}

export function inspectionPeriod(from?: string, to?: string): Prisma.DateTimeNullableFilter | undefined {
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
    const parsed = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v;
  }, 'Fecha inválida');
  const start = from ? new Date(`${day.parse(from)}T00:00:00-03:00`) : undefined;
  const end = to ? new Date(`${day.parse(to)}T23:59:59.999-03:00`) : undefined;
  if (start && end && start > end) throw new Error('La fecha inicial debe preceder a la final');
  return start || end ? { ...(start && { gte: start }), ...(end && { lte: end }) } : undefined;
}
