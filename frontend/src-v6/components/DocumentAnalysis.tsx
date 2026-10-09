import { AlertTriangle, ChevronDown, FileSearch } from 'lucide-react';
import type { ReceiptAnalysis } from '../types/documentAnalysis';

/** Reading a receipt is not confirming its amount, issuer, or payment. */
export function DocumentAnalysis({ analysis }: { analysis?: ReceiptAnalysis | null }) {
  if (!analysis || analysis.version !== 1) return null;
  return <div className="mt-3 space-y-2 text-sm leading-6">
    {analysis.duplicado && <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
      <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
      <p><strong>Comprobante repetido.</strong> La huella del archivo coincide con uno ya cargado. Revisalo; no acredita un pago nuevo.</p>
    </div>}
    {analysis.lectura === 'LEIDO' && analysis.texto ? <details className="group rounded-lg border border-neutral-300 bg-white">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-medium text-primary-900 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"><FileSearch size={18} aria-hidden="true" className="shrink-0" /><span>Ver texto leído del recibo</span><ChevronDown size={16} aria-hidden="true" className="ml-auto shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
      <div className="border-t border-neutral-200 p-3">
        <p className="mb-2 text-neutral-700">Lectura automática para revisar; no valida el pago. {analysis.alcance}</p>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words font-sans text-base text-neutral-900">{analysis.texto}</pre>
      </div>
    </details> : <p role="status" className="text-neutral-700">{analysis.aviso || 'No se encontró texto legible. El archivo quedó guardado para revisión manual.'}</p>}
  </div>;
}
