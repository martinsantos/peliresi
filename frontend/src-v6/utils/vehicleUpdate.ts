// Edit form values for a fleet vehicle. The server only updates fields it receives,
// so an empty year or capacity keeps the stored value instead of sending 0.
export interface VehicleFormValues {
  patente: string;
  marca: string;
  modelo: string;
  anio: string;
  capacidad: string;
  numeroHabilitacion: string;
  vencimiento: string;
  activo: boolean;
}

/** Form value for a stored capacity: the raw number, never a localized display string. */
export const capacityFormValue = (capacidad: number | null | undefined) => typeof capacidad === 'number' && Number.isFinite(capacidad) ? String(capacidad) : '';

export function vehicleUpdatePayload(form: VehicleFormValues, now = new Date()): { data: Record<string, unknown> } | { error: string } {
  const data: Record<string, unknown> = { patente: form.patente, marca: form.marca, modelo: form.modelo, activo: form.activo };
  if (form.anio.trim()) {
    const anio = Number(form.anio);
    const maxYear = now.getFullYear() + 1;
    if (!Number.isInteger(anio) || anio < 1950 || anio > maxYear) return { error: `El año debe estar entre 1950 y ${maxYear}.` };
    data.anio = anio;
  }
  if (form.capacidad.trim()) {
    const capacidad = Number(form.capacidad.replace(',', '.'));
    if (!Number.isFinite(capacidad) || capacidad <= 0) return { error: 'La capacidad debe ser un número mayor a 0 kg.' };
    data.capacidad = capacidad;
  }
  if (form.numeroHabilitacion) data.numeroHabilitacion = form.numeroHabilitacion;
  if (form.vencimiento) data.vencimiento = form.vencimiento;
  return { data };
}
