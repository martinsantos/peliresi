import { z } from 'zod';

export const tipoActorRenovacionSchema = z.enum(['GENERADOR', 'OPERADOR']);
export type TipoActorRenovacion = z.infer<typeof tipoActorRenovacionSchema>;

export const modalidadRenovacionSchema = z.enum(['SIN_CAMBIOS', 'CON_CAMBIOS']);

const nullableMoney = z.coerce.number().finite().nonnegative().optional().nullable();

export const createRenovacionSchema = z.object({
  anio: z.coerce.number().int().min(2020).max(2100),
  tipoActor: tipoActorRenovacionSchema,
  generadorId: z.string().trim().min(1).optional(),
  operadorId: z.string().trim().min(1).optional(),
  modalidad: modalidadRenovacionSchema,
  datosNuevos: z.record(z.string(), z.unknown()).optional(),
  camposModificados: z.array(z.string().trim().min(1)).max(100).optional(),
  tefAnterior: nullableMoney,
  tefNuevo: nullableMoney,
  observaciones: z.string().trim().max(5_000).optional().nullable(),
}).superRefine((value, context) => {
  const expectedId = value.tipoActor === 'GENERADOR' ? value.generadorId : value.operadorId;
  const unexpectedId = value.tipoActor === 'GENERADOR' ? value.operadorId : value.generadorId;
  if (!expectedId) context.addIssue({ code: 'custom', message: `Falta el identificador del ${value.tipoActor.toLowerCase()}` });
  if (unexpectedId) context.addIssue({ code: 'custom', message: 'La solicitud contiene un actor de otro tipo' });
  if (value.modalidad === 'CON_CAMBIOS' && (!value.datosNuevos || Object.keys(value.datosNuevos).length === 0)) {
    context.addIssue({ code: 'custom', message: 'Indique al menos un cambio propuesto' });
  }
});

const MUTABLE_FIELDS: Record<TipoActorRenovacion, Set<string>> = {
  GENERADOR: new Set([
    'razonSocial', 'domicilio', 'telefono', 'email', 'actividad', 'rubro',
    'corrientesControl', 'categoria', 'numeroInscripcion',
  ]),
  OPERADOR: new Set([
    'razonSocial', 'domicilio', 'telefono', 'email', 'tipoOperador', 'tecnologia',
    'corrientesY', 'categoria', 'numeroHabilitacion',
  ]),
};

export function sanitizeActorChanges(tipoActor: TipoActorRenovacion, input: Record<string, unknown>): Record<string, string | null> {
  const allowed = MUTABLE_FIELDS[tipoActor];
  const output: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;
    if (value === null) output[key] = null;
    else if (typeof value === 'string') output[key] = value.trim().slice(0, 2_000);
  }
  return output;
}

export function canReviewRenovacion(role: string, tipoActor: TipoActorRenovacion): boolean {
  return role === 'ADMIN' || role === `ADMIN_${tipoActor}`;
}

export function canSubmitRenovacion(
  user: { rol: string; generador?: { id: string } | null; operador?: { id: string } | null },
  tipoActor: TipoActorRenovacion,
  actorId: string,
): boolean {
  if (canReviewRenovacion(user.rol, tipoActor)) return true;
  if (tipoActor === 'GENERADOR') return user.rol === 'GENERADOR' && user.generador?.id === actorId;
  return user.rol === 'OPERADOR' && user.operador?.id === actorId;
}

export function reviewerActorFilter(role: string): TipoActorRenovacion | undefined {
  if (role === 'ADMIN_GENERADOR') return 'GENERADOR';
  if (role === 'ADMIN_OPERADOR') return 'OPERADOR';
  return undefined;
}
