import type { InspectionActorType, InspectionType } from '../types/inspection';
import { INSPECTION_TYPES } from '../types/inspection';
import type { inspeccionService } from './inspeccion.service';

export type InspectionOpeningInput = Parameters<typeof inspeccionService.create>[0] & { clienteId: string };
export type InspectionOpeningSource = { id: string; referencia: string; actorNombre: string; tipoActor: InspectionActorType; actorId: string | null };
export type InspectionOpeningValues = {
  type: InspectionActorType; actorId: string; withoutActor: boolean; inspectionType: InspectionType;
  description: string; assignedInspector: string; numeroActa: string; ubicacion: string; fechaProgramada: string;
  source: InspectionOpeningSource | null;
};
export type InspectionOpeningCommand = {
  input: InspectionOpeningInput; attempts: number; status: 'pending' | 'confirmed' | 'rejected';
  receipt?: { id: string; numero: string }; rejection?: string;
};
export type InspectionOpeningDraft = { version: 1; owner: string; values: InspectionOpeningValues; command?: InspectionOpeningCommand };

const actor = (value: unknown): value is InspectionActorType => typeof value === 'string' && ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].includes(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 20_000;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Scope includes the current account, activity and representation. */
export const inspectionOpeningKey = (owner: string) => `sitrep:inspection-opening:v1:${encodeURIComponent(owner)}`;

function validInput(input: unknown): input is InspectionOpeningInput {
  if (!record(input) || !uuid(input.clienteId)) return false;
  const allowed = ['clienteId', 'tipoInspeccion', 'tipoActor', 'actorId', 'antecedenteId', 'inspectorId', 'numeroActa', 'ubicacion', 'fechaProgramada', 'observaciones'];
  if (Object.keys(input).some(key => !allowed.includes(key))) return false;
  if (input.tipoInspeccion !== undefined && (typeof input.tipoInspeccion !== 'string' || !Object.hasOwn(INSPECTION_TYPES, input.tipoInspeccion))) return false;
  if (input.tipoActor != null && !actor(input.tipoActor)) return false;
  return ['actorId', 'antecedenteId', 'inspectorId', 'numeroActa', 'ubicacion', 'fechaProgramada', 'observaciones']
    .every(key => input[key] == null || text(input[key]));
}

export function validInspectionOpeningDraft(value: unknown, owner: string): value is InspectionOpeningDraft {
  if (!record(value) || value.version !== 1 || value.owner !== owner || !record(value.values)) return false;
  const v = value.values;
  if (!actor(v.type) || typeof v.withoutActor !== 'boolean' || typeof v.inspectionType !== 'string' || !Object.hasOwn(INSPECTION_TYPES, v.inspectionType)) return false;
  if (!['actorId', 'description', 'assignedInspector', 'numeroActa', 'ubicacion', 'fechaProgramada'].every(key => text(v[key]))) return false;
  if (v.source !== null && (!record(v.source) || !text(v.source.id) || !text(v.source.referencia) || !text(v.source.actorNombre)
    || !actor(v.source.tipoActor) || !(v.source.actorId === null || text(v.source.actorId)))) return false;
  if (value.command === undefined) return true;
  const c = value.command;
  if (!record(c) || !validInput(c.input) || !Number.isSafeInteger(c.attempts) || (c.attempts as number) < 0
    || !['pending', 'confirmed', 'rejected'].includes(String(c.status))) return false;
  // A recovered command must describe the same form the person can see.
  // Keep the original ISO instant on retry; do not recompute it in a new timezone.
  const input = c.input;
  const optional = (a: unknown, b: unknown) => (a || null) === (b || null);
  if (input.tipoInspeccion !== v.inspectionType || input.tipoActor !== (v.withoutActor ? null : v.type)
    || input.actorId !== (v.withoutActor ? null : v.actorId) || !optional(input.antecedenteId, v.source && (v.source as InspectionOpeningSource).id)
    || !optional(input.inspectorId, v.assignedInspector) || !optional(input.numeroActa, v.numeroActa)
    || !optional(input.ubicacion, v.ubicacion) || !optional(input.observaciones, v.description)
    || Boolean(input.fechaProgramada) !== Boolean(v.fechaProgramada)) return false;
  if (c.status === 'confirmed') return record(c.receipt) && text(c.receipt.id) && !!c.receipt.id && text(c.receipt.numero) && !!c.receipt.numero && c.rejection === undefined;
  if (c.receipt !== undefined) return false;
  return c.status === 'rejected' ? c.attempts === 1 && text(c.rejection) : c.rejection === undefined;
}

export function readInspectionOpening(owner: string, storage: Storage = localStorage): InspectionOpeningDraft | null {
  if (!owner) throw new Error('Falta el contexto de la cuenta.');
  const raw = storage.getItem(inspectionOpeningKey(owner));
  if (raw === null) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('No pudimos leer la apertura guardada. Contactá a soporte antes de crear otra.'); }
  if (!validInspectionOpeningDraft(value, owner)) throw new Error('No pudimos verificar la apertura guardada. Contactá a soporte antes de crear otra.');
  return value;
}

/** Caller must hold the opening lock; failures must stop dispatch. */
export function writeInspectionOpening(owner: string, draft: InspectionOpeningDraft | null, storage: Storage = localStorage): void {
  if (!owner || (draft && !validInspectionOpeningDraft(draft, owner))) throw new Error('No pudimos verificar la copia local.');
  const key = inspectionOpeningKey(owner);
  if (draft) {
    const encoded = JSON.stringify(draft);
    storage.setItem(key, encoded);
    if (storage.getItem(key) !== encoded) throw new Error('No se confirmó la copia local.');
  } else {
    storage.removeItem(key);
    if (storage.getItem(key) !== null) throw new Error('No se confirmó el descarte local.');
  }
}
