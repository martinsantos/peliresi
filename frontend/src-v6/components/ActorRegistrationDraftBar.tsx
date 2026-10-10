import { useId, useState } from 'react';
import { Info, Save } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import type { useActorRegistrationDraft } from '../hooks/useActorRegistrationDraft';

export function ActorRegistrationDraftBar({ draft }: { draft: ReturnType<typeof useActorRegistrationDraft> }) {
  const [informationOpen, setInformationOpen] = useState(false);
  const informationId = useId();
  return <section aria-label="Borrador del alta" className="border-b border-neutral-200 py-2">
    <div className="flex min-h-12 items-center justify-between gap-2">
      <p role="status" className="min-w-0 flex-1 text-xs leading-4 text-neutral-700 sm:text-sm sm:leading-5">{draft.available ? 'Hay un borrador de esta cuenta en este dispositivo.' : draft.saved ? 'Borrador guardado en este dispositivo · no enviado' : 'Podés guardar y retomar esta alta sin crear todavía una ficha.'}</p>
      <div className="flex shrink-0 items-center gap-1">
        {!draft.available && <Button variant="outline" aria-label="Guardar borrador" className="min-h-11 px-3" leftIcon={<Save size={16} />} onClick={() => draft.checkpoint()}>Guardar</Button>}
        <button type="button" aria-label="Información del borrador" title="Información del borrador" aria-expanded={informationOpen} aria-controls={informationId} onClick={() => setInformationOpen(value => !value)} className="flex h-11 w-11 items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"><Info size={18} /></button>
      </div>
    </div>
    {draft.available && <div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" isLoading={draft.restoring} onClick={() => void draft.restore()}>Recuperar borrador</Button><Button variant="ghost" disabled={draft.restoring} onClick={draft.discard}>Continuar sin recuperar</Button></div>}
    <p id={informationId} role="note" hidden={!informationOpen} className="mt-2 text-xs leading-5 text-neutral-600">Se conservan los datos por 30 días. No se guardan contraseñas ni archivos pendientes; los documentos ya subidos permanecen en SITREP.</p>
    {draft.error && <p role="alert" className="mt-2 text-sm text-error-800">{draft.error}</p>}
    {draft.blocked && <div role="alert" className="mt-2 text-sm text-error-800">La edición no está disponible: puede estar abierta en otra pestaña. No se sobrescribirá.<Button variant="outline" className="ml-2" onClick={draft.retry}>Reintentar edición</Button></div>}
  </section>;
}
