import { useId, useState } from 'react';
import { Info, Save } from 'lucide-react';
import { Button } from '../ui/ButtonV2';

/** Trial storage is local. Keep that distinction visible; explain limits on demand. */
export function RegistrationTrialDraftBar({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  const [open, setOpen] = useState(false);
  const informationId = useId();
  return <section aria-label="Borrador de prueba" className="mb-4 border-b border-neutral-200 pb-3">
    <div className="flex min-h-12 items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <strong className="text-sm text-primary-900">Prueba · sin envío</strong>
        <p role="status" className="text-xs leading-4 text-neutral-700">{saved ? 'Guardado en este navegador' : 'No se confirmó el guardado local'}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button aria-label="Guardar borrador de prueba" variant="outline" className="min-h-11 px-3" leftIcon={<Save size={16} />} onClick={onSave}>Guardar</Button>
        <button type="button" aria-label="Información del modo prueba" title="Información del modo prueba" aria-expanded={open} aria-controls={informationId} onClick={() => setOpen(value => !value)} className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"><Info size={18} /></button>
      </div>
    </div>
    <p id={informationId} role="note" hidden={!open} className="mt-2 text-xs leading-5 text-neutral-700">No crea cuentas, trámites ni avisos. El borrador queda sólo en este navegador; los archivos se procesan temporalmente y no se recuperan al recargar. Usá documentos de prueba.</p>
  </section>;
}
