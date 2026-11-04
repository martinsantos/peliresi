import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileText } from 'lucide-react';
import { Card } from '../ui/CardV2';
import { Button } from '../ui/ButtonV2';
import { registrationDocumentReviewLabel } from '../../utils/registrationDocumentReview';
import { solicitudService } from '../../services/solicitud.service';
import type { DocumentoSolicitud } from '../../types/api';

type DocumentSummary = Pick<DocumentoSolicitud, 'id' | 'nombre' | 'estado' | 'observaciones'>;
/** Read-only: the application state, not an individual file decision, controls corrections. */
export function ApplicantDocuments({ applicationId, documents, fresh, onRetry, targetDocumentId, targetVisitKey, activityLabel }: {
  applicationId: string; documents?: DocumentSummary[]; fresh: boolean; onRetry: () => void; targetDocumentId?: string | null; targetVisitKey?: string; activityLabel?: string;
}) {
  const [expanded, setExpanded] = useState(Boolean(targetDocumentId));
  const [busy, setBusy] = useState<string | null>(null);
  const running = useRef(false);
  const targetRef = useRef<HTMLLIElement>(null);
  const missingRef = useRef<HTMLParagraphElement>(null);
  const located = useRef<string | null>(null);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const orderedDocuments = documents?.map((doc, index) => ({ doc, index })).sort((a, b) => Number(b.doc.estado === 'RECHAZADO') - Number(a.doc.estado === 'RECHAZADO') || a.index - b.index).map(({ doc }) => doc);
  const rejected = documents?.filter(doc => doc.estado === 'RECHAZADO').length || 0;
  const missingTarget = !!targetDocumentId && fresh && !!documents && !documents.some(doc => doc.id === targetDocumentId);
  useEffect(() => {
    located.current = null;
    if (targetDocumentId) setExpanded(true);
  }, [targetDocumentId, targetVisitKey]);
  useEffect(() => {
    if (!targetDocumentId || !fresh || !documents || !expanded || located.current === targetDocumentId) return;
    const target = missingTarget ? missingRef.current : targetRef.current;
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    located.current = targetDocumentId;
  }, [targetDocumentId, targetVisitKey, fresh, documents, expanded, missingTarget]);
  const download = async (document: DocumentSummary) => {
    if (!fresh || running.current) return;
    running.current = true; setBusy(document.id); setError(null);
    try { await solicitudService.downloadDocumento(applicationId, document); }
    catch { setError({ id: document.id, text: 'No pudimos descargar el original. Volvé a intentar.' }); }
    finally { running.current = false; setBusy(null); }
  };
  return <Card padding="none">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-700">
      <FileText size={20} aria-hidden="true" className="shrink-0 text-primary-700" />
      <span className="min-w-0 flex-1 font-semibold text-neutral-900">Documentos presentados</span>
      <span className="text-sm text-neutral-700">{fresh && documents ? documents.length : '…'}</span>
      <ChevronDown size={18} aria-hidden="true" className={'shrink-0 ' + (expanded ? 'rotate-180' : '')} />
    </button>
    {fresh && rejected > 0 && <p className="px-4 pb-3 text-sm font-medium text-error-800">{rejected === 1 ? '1 documento rechazado' : `${rejected} documentos rechazados`} · consultá las observaciones</p>}
    {expanded && <div className="space-y-3 border-t border-neutral-200 p-4">
      {!fresh || !documents ? <div role="status" className="space-y-2 text-sm text-neutral-700"><p>Esperá a actualizar la solicitud para consultar la revisión de los documentos.</p><Button variant="outline" onClick={onRetry}>Actualizar documentos</Button></div>
        : <>{missingTarget && <p ref={missingRef} tabIndex={-1} role="status" className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-neutral-800">El documento indicado en el aviso no está disponible en esta solicitud.</p>}
        {documents.length === 0 ? <p className="text-sm text-neutral-600">Todavía no hay documentos guardados en esta solicitud.</p>
        : <><p className="text-sm text-neutral-600">La revisión de cada archivo no reemplaza la decisión sobre tu inscripción.</p><ul className="divide-y divide-neutral-200">{orderedDocuments!.map(doc => <li key={doc.id}
          ref={doc.id === targetDocumentId ? targetRef : undefined} tabIndex={doc.id === targetDocumentId ? -1 : undefined}
          aria-label={doc.id === targetDocumentId ? 'Documento del aviso: ' + doc.nombre : undefined}
          className={'space-y-2 py-3 first:pt-0 ' + (doc.id === targetDocumentId ? 'rounded-lg bg-primary-50 px-3 outline-none ring-1 ring-primary-300 focus-visible:ring-2' : '')}>
          {doc.id === targetDocumentId && <span className="block text-sm font-semibold text-primary-800">Documento indicado en el aviso</span>}
          {doc.id === targetDocumentId && activityLabel && <p className="text-sm text-neutral-700">Inscripción: {activityLabel}</p>}
          <p className="text-sm font-medium text-neutral-900 [overflow-wrap:anywhere]">{doc.nombre}</p>
          <p className={'text-sm font-medium ' + (doc.estado === 'RECHAZADO' ? 'text-error-800' : doc.estado === 'APROBADO' ? 'text-primary-800' : 'text-neutral-600')}>{registrationDocumentReviewLabel(doc.estado)}</p>
          {doc.observaciones?.trim() && <p className="whitespace-pre-wrap text-sm text-neutral-800 [overflow-wrap:anywhere]"><span className="font-medium">Observación: </span>{doc.observaciones}</p>}
          {error?.id === doc.id && <p role="alert" className="text-sm text-error-800">{error.text}</p>}
          <Button variant="outline" size="sm" leftIcon={<Download size={16} aria-hidden="true" />} aria-label={`Descargar original ${doc.nombre}`} disabled={busy !== null} isLoading={busy === doc.id} onClick={() => void download(doc)}>Descargar original</Button>
        </li>)}</ul></>}</>}
    </div>}
  </Card>;
}
