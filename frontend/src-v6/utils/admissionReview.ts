import type { Renovacion, SolicitudInscripcion } from '../types/api';
import { ZONAS } from './calculoTEF';

export const ACTOR_NAMES: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador' };
export const APPLICATION_STATES = {
  BORRADOR: { label: 'Borrador', color: 'neutral', next: 'Solicitante · completar y enviar' },
  ENVIADA: { label: 'Enviada', color: 'info', next: 'Administración · revisar' },
  EN_REVISION: { label: 'En revisión', color: 'warning', next: 'Administración · resolver' },
  OBSERVADA: { label: 'Observada', color: 'warning', next: 'Solicitante · corregir y reenviar' },
  APROBADA: { label: 'Aprobada', color: 'success', next: 'Alta habilitada' },
  RECHAZADA: { label: 'Rechazada', color: 'error', next: 'Decisión comunicada al solicitante' },
} as const;
export const RENEWAL_STATES = {
  PENDIENTE: { label: 'Pendiente', color: 'warning', next: 'Administración · revisar y decidir' },
  APROBADA: { label: 'Aprobada', color: 'success', next: 'Renovación aprobada' },
  RECHAZADA: { label: 'Rechazada', color: 'error', next: 'Actor · consultar el motivo' },
} as const;
export function recordJson(value?: string): Record<string, unknown> | null {
  try { const parsed = JSON.parse(value || ''); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; }
}
export function applicantName(s: SolicitudInscripcion): string {
  const name = recordJson(s.datosActor)?.razonSocial;
  return typeof name === 'string' && name.trim() ? name : s.usuario?.nombre || 'Solicitante sin nombre';
}
export function renewalActor(r: Renovacion): string { return r.generador?.razonSocial || r.operador?.razonSocial || 'Actor sin identificar'; }
const labels: Record<string, string> = { razonSocial: 'Razón social', domicilio: 'Domicilio', telefono: 'Teléfono', email: 'Correo electrónico', actividad: 'Actividad', rubro: 'Rubro', corrientesControl: 'Corrientes Y', corrientesY: 'Corrientes Y', categoria: 'Categoría', numeroInscripcion: 'Número de inscripción', numeroHabilitacion: 'Número de habilitación', tipoOperador: 'Modalidad del operador', tecnologia: 'Tecnología' };
const valueLabel = (v: unknown) => v == null || v === '' ? 'Sin declarar' : typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v);
const applicationLabels: Record<string, string> = {
  ...labels, cuit: 'CUIT', emailContacto: 'Correo de contacto', nombreFantasia: 'Nombre de fantasía',
  tefPersonal: 'Personal en planta', tefPotencia: 'Potencia instalada (HP)', tefSuperficie: 'Superficie cubierta (m²)', tefZona: 'Zona del establecimiento',
  corrientesAutorizadas: 'Corrientes Y autorizadas', vencimientoHabilitacion: 'Vencimiento de habilitación',
  domicilioLegalCalle: 'Domicilio legal · calle', domicilioLegalLocalidad: 'Domicilio legal · localidad', domicilioLegalDepto: 'Domicilio legal · departamento',
  domicilioRealCalle: 'Domicilio real · calle', domicilioRealLocalidad: 'Domicilio real · localidad', domicilioRealDepto: 'Domicilio real · departamento',
};
export function applicationFieldLabel(key: string): string {
  return applicationLabels[key] || key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
}
/** Presentation only: retain unrecognized legacy values rather than guessing or dropping them. */
export function applicationFieldValue(key: string, value: unknown): string {
  if (key === 'tefZona') return ZONAS.find(zone => zone.id === value)?.label || valueLabel(value);
  if (key === 'tipoOperador' && value === 'IN_SITU') return 'Operador in situ';
  if (key === 'tipoOperador' && value === 'FIJO') return 'Planta fija';
  return valueLabel(value);
}
/** Describe the stored proposal; malformed values are never interpreted as no changes. */
export function renewalChanges(r: Renovacion) {
  if (r.modalidad === 'SIN_CAMBIOS') return { valid: true, rows: [] };
  const before = recordJson(r.datosActuales), after = recordJson(r.datosNuevos);
  if (r.modalidad !== 'CON_CAMBIOS' || !before || !after || !Object.keys(after).length) return { valid: false, rows: [] };
  return { valid: Object.values(after).every(v => v === null || typeof v === 'string'), rows: Object.entries(after).map(([key, value]) => ({ key, label: labels[key] || key, before: valueLabel(before[key]), after: valueLabel(value) })) };
}
export function applicationReturn(state: unknown, base: string, owner: string): string {
  const saved = (state as { admissionReturn?: { owner?: string; path?: string } } | null)?.admissionReturn;
  if (saved?.owner !== owner || typeof saved.path !== 'string' || /[\\\u0000-\u001f]/.test(saved.path)) return base;
  try { const url = new URL(saved.path, 'https://sitrep.invalid'); return url.origin === 'https://sitrep.invalid' && url.pathname === base ? base + url.search : base; } catch { return base; }
}
