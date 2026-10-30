import { useEffect, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { actorDocumentScope, useActorDocuments, type DocumentActorType } from '../hooks/useActorDocuments';
import { generadorFiscalService } from '../services/generador-fiscal.service';
import { Button } from './ui/ButtonV2';

const labels: Record<DocumentActorType, string> = { GENERADOR:'Generador', TRANSPORTISTA:'Transportista', OPERADOR:'Operador' };

/** The list and download endpoints independently enforce the active actor's access. */
export function ActorReceiptNotice({ type, actorId, documentId, visitKey, returnPath }: { type: DocumentActorType; actorId: string; documentId: string; visitKey: string; returnPath: string }) {
  const { currentUser } = useAuth();
  return <ReceiptPanel key={JSON.stringify([type, actorId, ...actorDocumentScope(currentUser)])} type={type} actorId={actorId} documentId={documentId} visitKey={visitKey} returnPath={returnPath} />;
}

function ReceiptPanel({ type, actorId, documentId, visitKey, returnPath }: { type: DocumentActorType; actorId: string; documentId: string; visitKey: string; returnPath: string }) {
  const documents = useActorDocuments(type, actorId);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const running = useRef(false), section = useRef<HTMLElement>(null), located = useRef('');
  const pending = documents.isPending || documents.isFetching;
  const receipt = !pending && !documents.isError ? documents.data?.find(doc => doc.id === documentId && doc.tipo === 'COMPROBANTE_PAGO') : undefined;
  useEffect(() => {
    const key = visitKey + ':' + documentId;
    if (pending || located.current === key || !section.current) return;
    section.current.focus({ preventScroll: true }); section.current.scrollIntoView?.({ block:'center', behavior:'auto' });
    located.current = key;
  }, [pending, visitKey, documentId]);
  const download = async () => {
    if (!receipt || running.current) return;
    running.current = true; setBusy(true); setError('');
    try { await generadorFiscalService.downloadDocumento(receipt.id, receipt.nombre); }
    catch { setError('No pudimos descargar el comprobante. Podés volver a intentar.'); }
    finally { running.current = false; setBusy(false); }
  };
  const state = receipt?.estado === 'APROBADO' ? 'Documento aprobado' : receipt?.estado === 'RECHAZADO' ? 'Documento rechazado'
    : receipt?.estado === 'PENDIENTE' ? 'Pendiente de revisión' : 'Revisión sin confirmar';
  return <section ref={section} id="comprobante-aviso" aria-label="Comprobante del aviso" tabIndex={-1}
    className="min-w-0 scroll-mt-32 space-y-2 rounded-xl border border-primary-200 bg-white p-4 outline-none focus-visible:ring-2 focus-visible:ring-primary-700">
    <h2 className="flex items-center gap-2 text-base font-semibold leading-6 text-neutral-900"><FileText size={20} aria-hidden="true" className="shrink-0 text-primary-700" />Comprobante del aviso</h2>
    <p className="text-sm text-neutral-700">Actividad: {labels[type]}</p>
    {pending ? <p role="status" className="text-sm text-neutral-700">Verificando el documento…</p>
      : documents.isError ? <div role="alert" className="space-y-2 text-sm"><p>No pudimos consultar el comprobante. Revisá la conexión y volvé a intentar.</p><Button variant="outline" onClick={() => void documents.refetch()}>Reintentar documentos</Button></div>
      : !receipt ? <p role="status" className="text-sm text-neutral-700">El comprobante del aviso no está disponible en esta ficha. Consultá a Administración si necesitás ayuda.</p>
      : <>
        <p className="break-words font-medium text-neutral-900">{receipt.nombre}</p>
        <p className="text-sm font-semibold text-neutral-700">{state}</p>
        <p className="text-sm text-neutral-700">{receipt.analisis?.duplicado ? 'La huella coincide con un comprobante ya cargado. Este archivo no acredita un pago nuevo.' : 'El aviso identifica este archivo. Consultá a Administración si necesitás aclaraciones sobre el pago.'}</p>
        {receipt.observaciones?.trim() && <p className="whitespace-pre-wrap break-words text-sm text-neutral-700"><span className="font-semibold">Observación: </span>{receipt.observaciones}</p>}
        <Button variant="outline" leftIcon={<Download size={16} aria-hidden="true" />} isLoading={busy} disabled={busy} onClick={() => void download()}>Descargar comprobante</Button>
        {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
      </>}
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-800 underline" to={returnPath}>{returnPath.endsWith('/notificaciones') ? 'Volver a Avisos' : 'Volver al aviso'}</Link>
  </section>;
}
