import { ShieldCheck, Users, Clock3 } from 'lucide-react';
import { Card } from './ui/CardV2';
import { Button } from './ui/ButtonV2';
export type CompanyCapacity = { maximo: number; ocupados: number; personas: Array<{ id: string; nombre: string; email: string; activo: boolean; responsable: boolean; roles: string[] }>; reservas: string[] };
const labels: Record<string, string> = { GENERADOR: 'Generador', TRANSPORTISTA: 'Transporte', OPERADOR: 'Operador' };
export function CompanyPeopleSummary({ capacity, canDelegate, busy, designate }: { capacity?: CompanyCapacity; canDelegate: boolean; busy: boolean; designate: (email: string, revoke: boolean) => void }) {
  if (!capacity) return null;
  return <Card><div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-primary-700" aria-hidden="true"/>Personas de esta entidad</h2><span className="whitespace-nowrap rounded-lg bg-primary-50 px-3 py-1 text-sm font-semibold text-primary-800">{capacity.ocupados} de {capacity.maximo}</span></div>
    <p className="text-sm text-neutral-600">Hasta dos personas en total, incluida la titular. Los roles y establecimientos comparten este cupo. Cada persona entra con su propia cuenta.</p>
    {capacity.ocupados > capacity.maximo && <p role="alert" className="mt-2 text-warning-800">Hay accesos anteriores por encima del cupo. Revisalos antes de agregar personas; no se revocaron automáticamente.</p>}
    <ul className="mt-3 divide-y divide-neutral-100">{capacity.personas.map(p => <li key={p.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{p.nombre}</span>{p.responsable && <span className="inline-flex items-center gap-1 rounded bg-primary-50 px-2 py-1 text-xs text-primary-800"><ShieldCheck className="h-4 w-4" aria-hidden="true"/>Responsable ante SITREP</span>}{!p.activo && <span className="text-sm text-neutral-600">Cuenta inactiva</span>}</div><p className="break-all text-sm text-neutral-600">{p.email}</p><p className="mt-1 text-sm">{p.roles.map(r => labels[r] || r).join(' · ') || 'Titular o gestión de la entidad'}</p>
      {canDelegate && (p.responsable || p.activo && p.roles.length > 0) && <Button className="mt-2 min-h-11" variant="outline" size="sm" disabled={busy} onClick={() => designate(p.email, p.responsable)}>{p.responsable ? 'Retirar responsabilidad' : 'Designar responsable'}</Button>}
    </li>)}</ul>
    {capacity.reservas.map(email => <p key={email} className="mt-2 flex items-start gap-2 break-all text-sm text-neutral-600"><Clock3 className="h-4 w-4 shrink-0" aria-hidden="true"/>Invitación pendiente: {email}</p>)}
  </Card>;
}
