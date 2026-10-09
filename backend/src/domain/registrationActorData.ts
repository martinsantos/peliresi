import { AppError } from '../middlewares/errorHandler';

const addresses = ['domicilioLegalCalle', 'domicilioLegalLocalidad', 'domicilioLegalDepto', 'domicilioRealCalle', 'domicilioRealLocalidad', 'domicilioRealDepto'] as const;
const generatorFields = [...addresses, 'actividad', 'rubro', 'corrientesControl', 'expedienteInscripcion', 'resolucionInscripcion', 'categoriaIndividual'] as const;
const operatorFields = [...addresses, 'tipoOperador', 'tecnologia', 'corrientesY', 'expedienteInscripcion', 'certificadoNumero', 'resolucionDPA',
  'representanteLegalNombre', 'representanteLegalDNI', 'representanteLegalTelefono', 'representanteTecnicoNombre', 'representanteTecnicoMatricula', 'representanteTecnicoTelefono'] as const;
const transportFields = ['localidad', 'corrientesAutorizadas', 'expedienteDPA', 'resolucionDPA', 'resolucionSSP', 'actaInspeccion', 'actaInspeccion2'] as const;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
function magnitude(value: unknown, label: string): number | undefined {
  if (value == null || value === '') return undefined;
  if ((typeof value !== 'number' && typeof value !== 'string') || !String(value).trim()) throw new AppError(`${label}: indicá un número válido`, 400);
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new AppError(`${label}: indicá un número mayor o igual a cero`, 400);
  return number;
}
function date(value: unknown, label: string): Date | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError(`${label}: indicá una fecha válida`, 400);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new AppError(`${label}: la fecha no existe`, 400);
  return parsed;
}
export function registrationActivity(data: Record<string, unknown>): Record<string, number | string> | undefined {
  const raw: Record<string, number | string> = {};
  // Deliberately no calculator defaults, coefficients, amount, factorR or payment.
  for (const [source, target, label] of [
    ['tefPersonal', 'personal', 'Personal en planta'], ['tefPotencia', 'potenciaHP', 'Potencia instalada'],
    ['tefSuperficie', 'superficieM2', 'Superficie cubierta'], ['tefCapacidad', 'capacidad', 'Capacidad de tratamiento'],
  ]) {
    const value = magnitude(data[source], label);
    if (value !== undefined) raw[target] = value;
  }
  const zone = text(data.tefZona); if (zone) raw.zona = zone;
  return Object.keys(raw).length ? raw : undefined;
}

/** Whitelisted declarations only. The original application remains the source
 * for unmodeled data; approval does not turn applicant values into fiscal proof. */
export function registrationActorFields(type: string, data: Record<string, unknown>) {
  const contact = text(data.emailContacto);
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new AppError('El email de contacto es inválido', 400);
  const fields = type === 'GENERADOR' ? generatorFields : type === 'OPERADOR' ? operatorFields : transportFields;
  const strings: Record<string, string> = {};
  for (const field of fields) { const value = text(data[field]); if (value !== undefined) strings[field] = value; }
  const coordinates: { latitud?: number; longitud?: number } = {};
  const pair = text(data.coordenadas)?.split(',').map(value => value.trim());
  for (const [field, value, limit] of [
    ['latitud', data.latitud ?? pair?.[0], 90], ['longitud', data.longitud ?? pair?.[1], 180],
  ] as const) {
    if (value == null || value === '') continue;
    const number = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    if (!Number.isFinite(number) || Math.abs(number) > limit) throw new AppError(`${field}: coordenada inválida`, 400);
    coordinates[field] = number;
  }
  const tefInputs = type === 'TRANSPORTISTA' ? undefined : registrationActivity(data);
  const certificacionISO = type === 'GENERADOR' ? date(data.certificacionISO, 'Certificación ISO') : undefined;
  const vencimientoHabilitacion = type !== 'GENERADOR' ? date(data.vencimientoHabilitacion, 'Vencimiento de habilitación') : undefined;
  return { ...strings, ...coordinates, ...(tefInputs ? { tefInputs } : {}),
    ...(certificacionISO ? { certificacionISO } : {}), ...(vencimientoHabilitacion ? { vencimientoHabilitacion } : {}) };
}
