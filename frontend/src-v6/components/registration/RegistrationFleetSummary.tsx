import { EMPTY_DRIVER, EMPTY_VEHICLE, fleetRows } from '../../services/registrationFleet';
export function RegistrationFleetSummary({ form }: { form: Record<string, string> }) {
  const vehicles = fleetRows(form.vehiculosJson, EMPTY_VEHICLE), drivers = fleetRows(form.choferesJson, EMPTY_DRIVER);
  if (!vehicles.length && !drivers.length) return null;
  return <section aria-label="Flota declarada" className="space-y-4">
    <h4 className="font-semibold text-neutral-900">Flota declarada · {drivers.length} {drivers.length === 1 ? 'chofer' : 'choferes'} · {vehicles.length} {vehicles.length === 1 ? 'vehículo' : 'vehículos'}</h4>
    {drivers.map((driver, index) => <dl key={driver.key} className="space-y-1 border-l-2 border-primary-700 pl-3 text-sm text-neutral-800"><dt className="font-semibold">Chofer {index + 1} · {driver.nombre} {driver.apellido}</dt><dd className="break-words">DNI {driver.dni || 'Sin completar'} · Licencia {driver.licencia || 'Sin completar'}</dd><dd>Vencimiento: {driver.vencimiento || 'Sin completar'}</dd>{driver.telefono && <dd>{driver.telefono}</dd>}</dl>)}
    {vehicles.map((vehicle, index) => <dl key={vehicle.key} className="space-y-1 border-l-2 border-neutral-400 pl-3 text-sm text-neutral-800"><dt className="font-semibold">Vehículo {index + 1} · {vehicle.patente || 'Sin patente'}</dt><dd>{vehicle.marca} {vehicle.modelo} · {vehicle.anio || 'Sin año'}</dd><dd>Capacidad: {vehicle.capacidad || 'Sin completar'} kg · Habilitación: {vehicle.numeroHabilitacion || 'Sin completar'}</dd><dd>Vencimiento: {vehicle.vencimiento || 'Sin completar'}</dd></dl>)}
  </section>;
}
