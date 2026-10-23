import { BookOpen, LifeBuoy, Compass } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/ButtonV2';
import { contextualGuidance } from '../utils/contextualGuidance';
export function TaskHelp({ open, onClose, onReport, onWelcome, path, role, inspector, needsHelp }: {
  open: boolean; onClose: () => void; onReport: () => void; onWelcome: () => void; path: string; role: string; inspector?: boolean; needsHelp: boolean;
}) {
  const guide = contextualGuidance(path, role, inspector);
  return <Modal isOpen={open} onClose={onClose} title={guide.title} description="Ayuda para esta pantalla" size="sm">
    {needsHelp && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Hay campos por corregir. Revisá el mensaje junto a cada campo; tus datos siguen en el formulario.</p>}
    <ol className="space-y-4">{guide.steps.map((step, i) => <li key={step} className="flex gap-3 text-sm leading-relaxed text-neutral-700"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 font-semibold text-primary-800">{i + 1}</span><span>{step}</span></li>)}</ol>
    <div className="mt-5 space-y-2 border-t border-neutral-200 pt-4">
      <a href={'/manual/tutorial.html?guide=' + guide.manual} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary-800"><BookOpen size={18} aria-hidden="true" />Ver el recorrido en el manual<span className="sr-only"> (otra pestaña)</span></a>
      <Button variant="outline" fullWidth onClick={onWelcome} leftIcon={<Compass size={18} />}>Repasar mi rol</Button>
      <Button variant="outline" fullWidth onClick={onReport} leftIcon={<LifeBuoy size={18} />}>Reportar un problema</Button>
    </div>
  </Modal>;
}
