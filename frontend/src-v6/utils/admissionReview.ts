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
  corrientesControl: 'Corrientes de control del generador', corrientesY: 'Corrientes autorizadas del operador',
  tefPersonal: 'Personal en planta', tefPotencia: 'Potencia instalada (HP)', tefSuperficie: 'Superficie cubierta (m²)', tefZona: 'Zona del establecimiento',
  corrientesAutorizadas: 'Corrientes autorizadas del transporte', vencimientoHabilitacion: 'Vencimiento de habilitación', tefCapacidad: 'Capacidad de tratamiento (tn/mes)',
  domicilioLegalCalle: 'Domicilio legal · calle', domicilioLegalLocalidad: 'Domicilio legal · localidad', domicilioLegalDepto: 'Domicilio legal · departamento',
  domicilioRealCalle: 'Domicilio real · calle', domicilioRealLocalidad: 'Domicilio real · localidad', domicilioRealDepto: 'Domicilio real · departamento',
  expedienteDPA: 'Expediente DPA', resolucionDPA: 'Resolución DPA', resolucionSSP: 'Resolución SSP', actaInspeccion: 'Acta de inspección', actaInspeccion2: 'Segunda acta de inspección',
  categoriaIndividual: 'Categoría individual', libroOperatoria: 'Libro de operatoria', certificacionISO: 'Certificación ISO',
  representanteLegalNombre: 'Representante legal · nombre', representanteLegalDNI: 'Representante legal · DNI', representanteLegalTelefono: 'Representante legal · teléfono',
  representanteTecnicoNombre: 'Representante técnico · nombre', representanteTecnicoMatricula: 'Representante técnico · matrícula', representanteTecnicoTelefono: 'Representante técnico · teléfono',
};
export function applicationFieldLabel(key: string): string {
  return Object.prototype.hasOwnProperty.call(applicationLabels, key) ? applicationLabels[key] : key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
}
/** Presentation only: retain unrecognized legacy values rather than guessing or dropping them. */
export function applicationFieldValue(key: string, value: unknown): string {
  if (key === 'tefZona') return ZONAS.find(zone => zone.id === value)?.label || valueLabel(value);
  if (key === 'tipoOperador' && value === 'IN_SITU') return 'Operador in situ';
  if (key === 'tipoOperador' && value === 'FIJO') return 'Planta fija';
  return valueLabel(value);
}
const declarationGroups = [
  { title: 'Identificación y contacto', fields: ['razonSocial', 'nombreFantasia', 'cuit', 'telefono', 'emailContacto', 'email'] },
  { title: 'Domicilios', fields: ['domicilio', 'localidad', 'coordenadas', 'domicilioLegalCalle', 'domicilioLegalLocalidad', 'domicilioLegalDepto', 'domicilioRealCalle', 'domicilioRealLocalidad', 'domicilioRealDepto'] },
  { title: 'Inscripción y habilitaciones', fields: ['numeroInscripcion', 'numeroHabilitacion', 'vencimientoHabilitacion', 'expedienteDPA', 'resolucionDPA', 'resolucionSSP', 'actaInspeccion', 'actaInspeccion2'] },
  { title: 'Actividad declarada', fields: ['actividad', 'rubro', 'categoria', 'categoriaIndividual', 'tipoOperador', 'tecnologia', 'corrientesControl', 'corrientesY', 'corrientesAutorizadas', 'libroOperatoria', 'certificacionISO', 'tefPersonal', 'tefSuperficie', 'tefPotencia', 'tefZona', 'tefCapacidad'] },
  { title: 'Representantes declarados', fields: ['representanteLegalNombre', 'representanteLegalDNI', 'representanteLegalTelefono', 'representanteTecnicoNombre', 'representanteTecnicoMatricula', 'representanteTecnicoTelefono'] },
];
/** Group presentation only. Keep every unknown field; fleet has its own structured summary. */
export function applicationDeclarationGroups(data: Record<string, unknown>) {
  const remaining = new Set(Object.keys(data).filter(key => !['choferesJson', 'vehiculosJson'].includes(key)));
  const groups = declarationGroups.map(group => ({ title: group.title, rows: group.fields.filter(key => remaining.delete(key)).map(key => ({ key, value: data[key] })) }));
  groups.push({ title: 'Otros datos declarados', rows: [...remaining].map(key => ({ key, value: data[key] })) });
  return groups.filter(group => group.rows.length > 0);
}
export function applicationDeclarationsReadable(s?: Pick<SolicitudInscripcion, 'datosActor' | 'datosResiduos' | 'datosRegulatorio'>) {
  if (!s) return false;
  const actor = recordJson(s.datosActor);
  return !!actor && Object.keys(actor).length > 0 && [s.datosResiduos, s.datosRegulatorio].every(raw => !raw || recordJson(raw) !== null);
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
