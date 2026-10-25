import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from './ui/ButtonV2';

export function ActorDetailUnavailable({ onRetry, onBack }: { onRetry: () => void; onBack: () => void }) {
  return <section role="alert" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900"><AlertCircle size={20} />No pudimos cargar la ficha</h2>
    <p className="text-sm text-neutral-700">Reintentá la consulta. Si la ficha ya no está disponible, volvé al listado para buscarla.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" leftIcon={<RefreshCw size={16} />} onClick={onRetry}>Reintentar</Button>
      <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={onBack}>Volver al listado</Button>
    </div>
  </section>;
}
