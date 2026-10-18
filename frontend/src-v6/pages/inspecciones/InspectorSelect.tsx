import React, { useEffect, useState } from 'react';
import { inspectionOperationsService, type InspectorOption } from '../../services/inspectionOperations.service';
import type { InspectionActorType } from '../../types/inspection';

export function InspectorSelect({ value, onChange, type, creating = false }: { value: string; onChange: (id: string) => void; type?: InspectionActorType | null; creating?: boolean }) {
  const [options, setOptions] = useState<InspectorOption[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    inspectionOperationsService.inspectors().then((items) => { if (active) setOptions(items); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);
  return <label className="block text-sm font-semibold text-neutral-800">Inspector asignado<select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal"><option value="">{creating ? 'Asignarme esta inspección' : 'Sin cambiar asignación'}</option>{options.filter((user) => !user.rol.startsWith('ADMIN_') || user.rol === `ADMIN_${type}`).map((user) => <option key={user.id} value={user.id}>{user.nombre} {user.apellido || ''}</option>)}</select>{error && <span role="alert" className="mt-1 block text-xs text-error-700">No se pudo cargar el equipo. Cerrá y volvé a abrir para reintentar.</span>}</label>;
}
