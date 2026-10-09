import { Save } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import type { useActorRegistrationDraft } from '../hooks/useActorRegistrationDraft';

export function ActorRegistrationDraftBar({ draft }: { draft: ReturnType<typeof useActorRegistrationDraft> }) {
  return <section aria-label="Borrador del alta" className="rounded-xl border border-neutral-200 bg-white p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" className="text-sm text-neutral-700">{draft.available ? 'Hay un borrador de esta cuenta en este dispositivo.' : draft.saved ? 'Borrador guardado en este dispositivo · no enviado' : 'Podés guardar y retomar esta alta sin crear todavía una ficha.'}</p>
      {draft.available ? <div className="flex flex-wrap gap-2"><Button variant="outline" isLoading={draft.restoring} onClick={() => void draft.restore()}>Recuperar borrador</Button><Button variant="ghost" disabled={draft.restoring} onClick={draft.discard}>Continuar sin recuperar</Button></div>
        : <Button variant="outline" leftIcon={<Save size={16} />} onClick={() => draft.checkpoint()}>Guardar borrador</Button>}
    </div>
    <p className="mt-1 text-xs leading-5 text-neutral-600">Se conservan los datos por 30 días. No se guardan contraseñas ni archivos pendientes; los documentos ya subidos permanecen en SITREP.</p>
    {draft.error && <p role="alert" className="mt-2 text-sm text-error-800">{draft.error}</p>}
    {draft.blocked && <div role="alert" className="mt-2 text-sm text-error-800">La edición no está disponible: puede estar abierta en otra pestaña. No se sobrescribirá.<Button variant="outline" className="ml-2" onClick={draft.retry}>Reintentar edición</Button></div>}
  </section>;
}
