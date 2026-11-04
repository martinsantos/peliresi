import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from './ui/ButtonV2';

export function ActorDetailUnavailable({ onRetry, onBack, backLabel = 'Volver al listado' }: { onRetry: () => void; onBack: () => void; backLabel?: string }) {
  return <section role="alert" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-900"><AlertCircle size={20} />No pudimos cargar la ficha</h2>
    <p className="text-sm text-neutral-700">Reintentá la consulta o regresá a la pantalla anterior. No se modificaron datos.</p>
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" leftIcon={<RefreshCw size={16} />} onClick={onRetry}>Reintentar</Button>
      <Button variant="outline" leftIcon={<ArrowLeft size={16} />} onClick={onBack}>{backLabel}</Button>
    </div>
  </section>;
}
