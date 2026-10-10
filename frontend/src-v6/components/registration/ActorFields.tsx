import type { ReactNode } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { DEPARTAMENTOS_MENDOZA } from '../../pages/public/inscripcion/shared';
import { COORDINATE_ERROR, parseActorCoordinates } from '../../utils/actorCreationValidation';

type Props = { form: Record<string, unknown>; up: (field: string, value: string) => void; attempted?: boolean };
const value = (form: Props['form'], field: string) => typeof form[field] === 'string' ? form[field] as string : '';

/** Public, administrator and application-review screens share these controls.
 * Authentication and fiscal authority remain responsibilities of their shells. */
export function ActorContactFields({ form, up, attempted = false, administrative = false, placeholder = 'Empresa S.A.', identitySlot, domicile = true }: Props & {
  administrative?: boolean; placeholder?: string; identitySlot?: ReactNode; domicile?: boolean;
}) {
  const emailKey = administrative ? 'email' : 'emailContacto';
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Input id="registration-razonSocial" label="Razon Social *" autoComplete="organization" placeholder={placeholder} value={value(form, 'razonSocial')} onChange={event => up('razonSocial', event.target.value)} errorMessage={attempted && !value(form, 'razonSocial').trim() ? 'La razón social es obligatoria.' : undefined} />
    {identitySlot}
    {domicile && <Input id="registration-domicilio" label="Domicilio" placeholder="Calle 123, Ciudad" value={value(form, 'domicilio')} onChange={event => up('domicilio', event.target.value)} />}
    <Input id="registration-telefono" label="Telefono" type="tel" inputMode="tel" autoComplete="tel" placeholder="0261-4XXXXXX" value={value(form, 'telefono')} onChange={event => up('telefono', event.target.value)} />
    <Input id="registration-emailContacto" label={administrative ? 'Email *' : 'Email de contacto'} type="email" autoComplete="email" placeholder="contacto@empresa.com" value={value(form, emailKey)} onChange={event => up(emailKey, event.target.value)} errorMessage={attempted && administrative && !value(form, emailKey).trim() ? 'El email es obligatorio.' : undefined} />
  </div>;
}

export function ActorAddressFields({ form, up, administrative = false, same, onSame, attempted = false }: Props & {
  administrative?: boolean; same?: boolean; onSame?: (value: boolean) => void;
}) {
  return <div className="space-y-6">
    {(['Legal', 'Real'] as const).map(part => <section key={part} className="space-y-4" aria-label={part === 'Legal' ? 'Domicilio legal' : 'Domicilio real'}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-semibold text-neutral-900">{part === 'Legal' ? 'Domicilio Legal' : 'Domicilio Real'}</h4>
        {part === 'Real' && onSame && <label className="flex min-h-11 items-center gap-2 text-sm text-neutral-700"><input type="checkbox" checked={Boolean(same)} onChange={event => onSame(event.target.checked)} />Igual a la fiscal</label>}</div>
      {!(part === 'Real' && same) && <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Input id={`registration-domicilio${part}Calle`} label={administrative ? 'Calle / Ruta' : 'Calle'} placeholder={part === 'Legal' ? 'Av. San Martin 123' : 'Ruta 40 km 5'} value={value(form, `domicilio${part}Calle`)} onChange={event => up(`domicilio${part}Calle`, event.target.value)} />
        <Input id={`registration-domicilio${part}Localidad`} label="Localidad" placeholder={part === 'Legal' ? 'Mendoza' : 'Lujan de Cuyo'} value={value(form, `domicilio${part}Localidad`)} onChange={event => up(`domicilio${part}Localidad`, event.target.value)} />
        <Select label="Departamento" value={value(form, `domicilio${part}Depto`)} onChange={value => up(`domicilio${part}Depto`, value)} options={[{ value: '', label: 'Seleccionar...' }, ...DEPARTAMENTOS_MENDOZA.map(value => ({ value, label: value }))]} size="base" searchable />
      </div>}
    </section>)}
    <Input label="Coordenadas Geograficas" value={value(form, 'coordenadas')} placeholder="-32.89, -68.83" onChange={event => up('coordenadas', event.target.value)} errorMessage={attempted && parseActorCoordinates(value(form, 'coordenadas')) === null ? COORDINATE_ERROR : undefined} />
  </div>;
}
export function TransportAuthorizationFields({ form, up }: Props) {
  const fields = { numeroHabilitacion: 'N Habilitacion', vencimientoHabilitacion: 'Vencimiento Habilitacion', expedienteDPA: 'Expediente DPA', resolucionDPA: 'Resolucion DPA', resolucionSSP: 'Resolucion SSP', corrientesAutorizadas: 'Corrientes Autorizadas', actaInspeccion: 'Acta Inspeccion', actaInspeccion2: 'Acta Inspeccion 2' };
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{Object.entries(fields).map(([field, label]) => <Input key={field} id={`registration-${field}`} label={label} type={field === 'vencimientoHabilitacion' ? 'date' : 'text'} value={value(form, field)} onChange={event => up(field, event.target.value)} />)}</div>;
}
