import { useRef, useState } from 'react';
import { Car, UserRound, Plus, Trash2, ScanLine } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/ButtonV2';
import { EMPTY_DRIVER, EMPTY_VEHICLE, type DriverDraft, type VehicleDraft } from '../../services/registrationFleet';
import { previewDocument, type LicensePreview } from '../../services/documentPreview';
import { getApiErrorMessage } from '../../utils/api-error';
import { vehicleCapacityError } from '../../utils/actorCreationValidation';

type LicenseDocument = { name: string; status: string; error?: string };
type Props = {
  vehicles: VehicleDraft[]; drivers: DriverDraft[];
  onVehicles: (rows: VehicleDraft[]) => void; onDrivers: (rows: DriverDraft[]) => void;
  section?: 'vehicles' | 'drivers'; attempted?: boolean; readOnly?: boolean;
  allowLicenseUpload?: boolean;
  onLicense?: (key: string, file: File) => Promise<LicensePreview>;
  documents?: Record<string, LicenseDocument>;
};

export function RegistrationFleetFields({ vehicles, drivers, onVehicles, onDrivers, section, attempted = false, readOnly = false, allowLicenseUpload = true, onLicense, documents = {} }: Props) {
  return <div className="space-y-7">
    {section !== 'drivers' && <section aria-label="Vehículos del alta" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900"><Car size={20} className="text-primary-800" />Vehículos</h3>
        {!readOnly && <Button variant="outline" leftIcon={<Plus size={16} />} disabled={vehicles.length >= 100} onClick={() => onVehicles([...vehicles, { ...EMPTY_VEHICLE, key: crypto.randomUUID() }])}>{section ? 'Agregar' : 'Agregar vehículo'}</Button>}</div>
      {!vehicles.length && <p className="text-sm text-neutral-700">Agregá cada vehículo con su patente, capacidad y habilitación.</p>}
      {vehicles.map((row, index) => <fieldset key={row.key} disabled={readOnly} className="min-w-0 space-y-4 rounded-xl border border-neutral-300 p-4">
        <legend className="px-2 font-semibold text-neutral-900">Vehículo {index + 1}{row.patente ? ` · ${row.patente}` : ''}</legend>
        {!readOnly && <Remove name={`Quitar vehículo ${index + 1}`} onClick={() => onVehicles(vehicles.filter(item => item.key !== row.key))} />}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(['patente', 'marca', 'modelo', 'anio', 'capacidad', 'numeroHabilitacion', 'vencimiento'] as const).map(field => <Input key={field} label={VEHICLE_LABELS[field]} type={field === 'vencimiento' ? 'date' : field === 'anio' || field === 'capacidad' ? 'number' : 'text'}
            inputMode={field === 'anio' ? 'numeric' : field === 'capacidad' ? 'decimal' : undefined} min={field === 'capacidad' ? '0' : undefined} step={field === 'capacidad' ? 'any' : field === 'anio' ? '1' : undefined}
            value={row[field]} errorMessage={attempted ? field === 'capacidad' ? vehicleCapacityError(row.capacidad) : field === 'anio' && (!row.anio.trim() || !Number.isInteger(Number(row.anio))) ? 'El año debe ser entero.' : ['patente', 'vencimiento'].includes(field) && !row[field].trim() ? 'Completá este dato para continuar.' : undefined : undefined}
            onChange={event => onVehicles(vehicles.map(item => item.key === row.key ? { ...item, [field]: event.target.value } : item))} />)}
        </div>
      </fieldset>)}
    </section>}
    {section !== 'vehicles' && <section aria-label="Choferes del alta" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-bold text-neutral-900"><UserRound size={20} className="text-primary-800" />Choferes</h3>
        {!readOnly && <Button variant="outline" leftIcon={<Plus size={16} />} disabled={drivers.length >= 100} onClick={() => onDrivers([...drivers, { ...EMPTY_DRIVER, key: crypto.randomUUID() }])}>{section ? 'Agregar' : 'Agregar chofer'}</Button>}</div>
      {!drivers.length && <p className="text-sm text-neutral-700">Agregá un chofer. Podés leer su licencia para evitar transcribir sus datos.</p>}
      {drivers.map((row, index) => <DriverFields key={row.key} row={row} index={index} attempted={attempted} readOnly={readOnly} allowLicenseUpload={allowLicenseUpload} document={documents[row.key]} onLicense={onLicense}
        onChange={change => onDrivers(drivers.map(item => item.key === row.key ? { ...item, ...change } : item))}
        onRemove={() => onDrivers(drivers.filter(item => item.key !== row.key))} />)}
    </section>}
  </div>;
}
const VEHICLE_LABELS = { patente: 'Patente *', marca: 'Marca', modelo: 'Modelo', anio: 'Ano *', capacidad: 'Capacidad (kg) *', numeroHabilitacion: 'Habilitación del vehículo', vencimiento: 'Vencimiento *' };
const DRIVER_LABELS = { nombre: 'Nombre *', apellido: 'Apellido', dni: 'DNI *', licencia: 'Licencia', vencimiento: 'Vencimiento *', telefono: 'Teléfono del chofer' };
function Remove({ name, onClick }: { name: string; onClick: () => void }) {
  return <button type="button" aria-label={name} onClick={onClick} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-error-800 hover:bg-error-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error-700"><Trash2 size={18} /></button>;
}
function DriverFields({ row, index, attempted, readOnly, allowLicenseUpload, onChange, onRemove, onLicense, document }: {
  row: DriverDraft; index: number; attempted: boolean; readOnly: boolean;
  allowLicenseUpload: boolean;
  onChange: (change: Partial<DriverDraft>) => void; onRemove: () => void;
  onLicense?: Props['onLicense']; document?: LicenseDocument;
}) {
  const input = useRef<HTMLInputElement>(null), inFlight = useRef(false);
  const editedDuringReading = useRef(new Set<string>());
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<LicensePreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const read = async (original: File) => {
    if (inFlight.current) return;
    inFlight.current = true; editedDuringReading.current.clear(); setBusy(true); setError(null); setProposal(null); setFile(original);
    try {
      if (!original.size || original.size > 10 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png'].includes(original.type)) throw new Error('Elegí un PDF, JPG o PNG de hasta 10 MB.');
      const result = await (onLicense ? onLicense(row.key, original) : previewDocument(original, 'LICENCIA'));
      setProposal(result); setSelected(Object.keys(result.campos).filter(key => !row[key as keyof DriverDraft] && !editedDuringReading.current.has(key)));
      if (result.analisis.lectura !== 'LEIDO') setError(result.analisis.aviso || 'No se pudo leer. Completá los campos o reintentá con una foto más clara.');
    } catch (cause) { setError(getApiErrorMessage(cause, 'No se pudo leer la licencia. Los datos que cargaste siguen intactos.')); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <fieldset disabled={readOnly} className="min-w-0 space-y-4 rounded-xl border border-neutral-300 p-4" aria-label={`Chofer ${index + 1}`}>
    <legend className="px-2 font-semibold text-neutral-900">Chofer {index + 1}{row.nombre ? ` · ${row.nombre} ${row.apellido}` : ''}</legend>
    {!readOnly && <div className="flex flex-wrap items-center justify-between gap-2">
      {allowLicenseUpload && <Button variant="outline" isLoading={busy} leftIcon={<ScanLine size={18} />} onClick={() => input.current?.click()}>Adjuntar licencia y leer</Button>}
      <Remove name={`Quitar chofer ${index + 1}`} onClick={onRemove} />
      {allowLicenseUpload && <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" aria-label={`Archivo de licencia del chofer ${index + 1}`} onChange={event => { const original = event.target.files?.[0]; event.target.value = ''; if (original) void read(original); }} />}
    </div>}
    {document && <p className="break-words text-sm text-neutral-700">{document.name} · {document.status}</p>}
    {document?.error && <p role="alert" className="text-sm text-error-800">{document.error}</p>}
    {error && <div role="alert" className="space-y-2 text-sm text-error-800"><p>{error}</p>{file && <Button variant="outline" disabled={busy} onClick={() => void read(file)}>Reintentar lectura de licencia</Button>}</div>}
    {proposal?.analisis.lectura === 'LEIDO' && <div className="space-y-3 border-l-4 border-primary-700 bg-primary-50 p-3">
      <p className="font-semibold text-primary-950">Revisá los datos leídos</p><p className="text-sm text-neutral-700">Seleccioná lo que querés usar. Leer el documento no valida la licencia ni reemplaza tus datos automáticamente.</p>
      {Object.entries(proposal.campos).map(([field, value]) => <label key={field} className="flex min-h-11 items-start gap-3 py-2 text-sm text-neutral-900"><input className="mt-1" type="checkbox" checked={selected.includes(field)} onChange={event => setSelected(previous => event.target.checked ? [...previous, field] : previous.filter(item => item !== field))} /><span>{DRIVER_LABELS[field as keyof typeof DRIVER_LABELS]}: <strong>{value}</strong>{row[field as keyof DriverDraft] && <span className="block text-neutral-600">Actual: {row[field as keyof DriverDraft]}</span>}</span></label>)}
      {!Object.keys(proposal.campos).length && <p className="text-sm text-neutral-700">Hay texto legible, pero no campos inequívocos. Completalos manualmente.</p>}
      {selected.length > 0 && <Button onClick={() => { onChange(Object.fromEntries(Object.entries(proposal.campos).filter(([key]) => selected.includes(key)))); setSelected([]); }}>Usar datos seleccionados</Button>}
      <details><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary-900">Ver texto leído de la licencia</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-sans text-sm text-neutral-900">{proposal.analisis.texto}</pre></details>
    </div>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(Object.keys(DRIVER_LABELS) as (keyof typeof DRIVER_LABELS)[]).map(field => <Input key={field} label={DRIVER_LABELS[field]} type={field === 'vencimiento' ? 'date' : field === 'telefono' ? 'tel' : 'text'} inputMode={field === 'dni' ? 'numeric' : undefined}
        value={row[field]} errorMessage={attempted && ['nombre', 'dni', 'vencimiento'].includes(field) && !row[field].trim() ? 'Completá este dato para continuar.' : undefined} onChange={event => { if (inFlight.current) editedDuringReading.current.add(field); onChange({ [field]: event.target.value }); }} />)}
    </div>
  </fieldset>;
}
