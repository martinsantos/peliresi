export type VehicleDraft = { key: string; patente: string; marca: string; modelo: string; anio: string; capacidad: string; numeroHabilitacion: string; vencimiento: string };
export type DriverDraft = { key: string; nombre: string; apellido: string; dni: string; licencia: string; vencimiento: string; telefono: string };
export const EMPTY_VEHICLE: VehicleDraft = { key: '', patente: '', marca: '', modelo: '', anio: '', capacidad: '', numeroHabilitacion: '', vencimiento: '' };
export const EMPTY_DRIVER: DriverDraft = { key: '', nombre: '', apellido: '', dni: '', licencia: '', vencimiento: '', telefono: '' };
export function fleetRows<T extends DriverDraft | VehicleDraft>(value: unknown, empty: T): T[] {
  let rows = value;
  if (typeof rows === 'string') { try { rows = JSON.parse(rows); } catch { return []; } }
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 100).filter(row => row && typeof row === 'object' && !Array.isArray(row)).map((row, index) => {
    const result = { ...empty };
    for (const key of Object.keys(empty)) {
      if (typeof row[key] === 'string') (result as Record<string, string>)[key] = row[key];
      else if (typeof row[key] === 'number' && Number.isFinite(row[key])) (result as Record<string, string>)[key] = String(row[key]);
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(result.key)) result.key = `legacy-${'dni' in empty ? 'driver' : 'vehicle'}-${index}`;
    return result;
  });
}
export const licenseDocumentType = (key: string) => `LICENCIA_CHOFER_${key}`;
export function fleetErrors(vehicles: VehicleDraft[], drivers: DriverDraft[]): string[] {
  const errors: string[] = [], dnis = new Set<string>(), plates = new Set<string>();
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  for (const [index, row] of vehicles.entries()) {
    const plate = row.patente.trim().toUpperCase();
    if (!plate || plates.has(plate)) errors.push(`Vehículo ${index + 1}: indicá una patente sin repetir.`);
    plates.add(plate);
    if (!row.anio.trim() || !Number.isInteger(Number(row.anio))) errors.push(`Vehículo ${index + 1}: el año debe ser entero.`);
    if (!row.capacidad.trim() || !Number.isFinite(Number(row.capacidad)) || Number(row.capacidad) <= 0) errors.push(`Vehículo ${index + 1}: revisá la capacidad en kg.`);
    if (!validDate(row.vencimiento)) errors.push(`Vehículo ${index + 1}: revisá el vencimiento.`);
  }
  for (const [index, row] of drivers.entries()) {
    const dni = row.dni.trim().replace(/[.\s-]/g, '');
    if (!row.nombre.trim()) errors.push(`Chofer ${index + 1}: indicá el nombre.`);
    if (!dni || dnis.has(dni)) errors.push(`Chofer ${index + 1}: indicá un DNI sin repetir.`);
    dnis.add(dni);
    if (!validDate(row.vencimiento)) errors.push(`Chofer ${index + 1}: revisá el vencimiento.`);
  }
  return errors;
}
