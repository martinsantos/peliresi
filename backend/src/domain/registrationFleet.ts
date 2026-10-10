import { AppError } from '../middlewares/errorHandler';

function rows(data: Record<string, unknown>, key: string): Record<string, unknown>[] | undefined {
  const value = data[key]; if (value === undefined || value === '') return undefined;
  let parsed: unknown = value;
  if (typeof value === 'string') { try { parsed = JSON.parse(value); } catch { throw new AppError('Revisá los datos estructurados de vehículos y choferes.', 400); } }
  if (!Array.isArray(parsed) || parsed.length > 100 || parsed.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new AppError('La flota debe ser una lista de hasta 100 registros.', 400);
  return parsed as Record<string, unknown>[];
}
function text(row: Record<string, unknown>, key: string, required = false): string {
  const value = row[key];
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > 200 || (required && !value.trim())) throw new AppError(`Flota: revisá ${key}.`, 400);
  return value.trim();
}
function expiry(row: Record<string, unknown>): Date {
  const value = text(row, 'vencimiento', true);
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new AppError('Flota: indicá una fecha de vencimiento que exista.', 400);
  return date;
}
/** Same structured fields as the administrative create; original free text stays
 * in the application, never guessed into operational records. */
export function registrationFleet(data: Record<string, unknown>) {
  const drivers = rows(data, 'choferesJson'); const vehicles = rows(data, 'vehiculosJson');
  const dnis = new Set<string>(), plates = new Set<string>();
  const choferes = drivers?.map(row => {
    const dni = text(row, 'dni', true), key = dni.replace(/[.\s-]/g, '');
    if (dnis.has(key)) throw new AppError('Hay choferes repetidos por DNI. Revisá la lista.', 400);
    dnis.add(key);
    return { nombre: text(row, 'nombre', true), apellido: text(row, 'apellido'), dni,
      licencia: text(row, 'licencia'), vencimiento: expiry(row), telefono: text(row, 'telefono') };
  });
  const vehiculos = vehicles?.map(row => {
    const patente = text(row, 'patente', true).toUpperCase();
    if (plates.has(patente)) throw new AppError('Hay vehículos repetidos por patente. Revisá la lista.', 400);
    plates.add(patente);
    const anio = Number(row.anio), capacidad = Number(row.capacidad);
    if (!['string', 'number'].includes(typeof row.anio) || String(row.anio).trim() === '' || !Number.isInteger(anio) || !['string', 'number'].includes(typeof row.capacidad) || String(row.capacidad).trim() === '' || !Number.isFinite(capacidad) || capacidad <= 0) throw new AppError('Vehículo: revisá el año y la capacidad en kg.', 400);
    return { patente, marca: text(row, 'marca'), modelo: text(row, 'modelo'), anio, capacidad,
      numeroHabilitacion: text(row, 'numeroHabilitacion'), vencimiento: expiry(row) };
  });
  return { ...(choferes?.length ? { choferes: { create: choferes } } : {}), ...(vehiculos?.length ? { vehiculos: { create: vehiculos } } : {}) };
}

export function isLicenseDocument(type: unknown): type is string {
  return typeof type === 'string' && /^LICENCIA_CHOFER_[a-zA-Z0-9_-]{1,64}$/.test(type);
}
export function declaredLicenseDocument(data: Record<string, unknown>, type: string): boolean {
  return isLicenseDocument(type) && (rows(data, 'choferesJson') || []).some(driver => driver.key === type.slice('LICENCIA_CHOFER_'.length));
}
