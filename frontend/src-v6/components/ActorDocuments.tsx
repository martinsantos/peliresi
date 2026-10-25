import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { documentoIdentityService, generadorFiscalService, operadorFiscalService, transportistaDocumentoService, type Documento } from '../services/generador-fiscal.service';
import { Card, CardHeader, CardContent } from './ui/CardV2';
import { QueryContent } from './ui/QueryContent';
import { actorDocumentScope, refreshActorDocuments, useActorDocuments } from '../hooks/useActorDocuments';
import DocumentUpload from './DocumentUpload';

/** Uses the existing actor-document endpoints and their sector/ownership checks. */
export function ActorDocuments({ actorId, cuit, actorType }: { actorId: string; cuit: string; actorType: 'OPERADOR' | 'TRANSPORTISTA' }) {
  const { currentUser } = useAuth();
  return <ActorDocumentPanel key={JSON.stringify([actorType, actorId, ...actorDocumentScope(currentUser)])} actorId={actorId} cuit={cuit} actorType={actorType} />;
}

function ActorDocumentPanel({ actorId, cuit, actorType }: { actorId: string; cuit: string; actorType: 'OPERADOR' | 'TRANSPORTISTA' }) {
  const { currentUser } = useAuth();
  const client = useQueryClient();
  const service = actorType === 'TRANSPORTISTA' ? { upload: transportistaDocumentoService.upload } : { upload: operadorFiscalService.uploadDocumento };
  const documents = useActorDocuments(actorType, actorId);
  const manager = currentUser?.rol === 'ADMIN' || currentUser?.rol === 'ADMIN_' + actorType;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const refresh = () => refreshActorDocuments(client, actorType, actorId);
  const change = async (action: () => Promise<unknown>, message: string) => {
    if (!manager || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch { setError(message); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const download = async (doc: Documento) => {
    setError('');
    try { await generadorFiscalService.downloadDocumento(doc.id, doc.nombre); }
    catch { setError('No se pudo descargar el documento. Podés reintentar.'); }
  };
  return <Card>
    <CardHeader title="Documentos" icon={<FileText size={20} />} />
    <CardContent>
      <QueryContent query={documents} loading="Cargando documentos…" error="No se pudieron consultar los documentos." retryLabel="Reintentar documentos">
          <DocumentUpload documentos={documents.data || []} cuit={cuit} isAdmin={manager} readOnly={!manager} isPending={busy} initialTipo={actorType === 'OPERADOR' ? 'FACTURA_ELECTRICA' : 'COMPROBANTE_PAGO'}
            onUpload={(file, tipo, anio) => void change(() => service.upload(actorId, file, tipo, anio), 'No se pudo adjuntar el documento. Podés volver a seleccionarlo para reintentar.')}
            onDownload={doc => void download(doc)}
            onRevisar={(docId, estado, observaciones) => void change(() => generadorFiscalService.revisarDocumento(docId, estado, observaciones), 'No se pudo revisar el documento. El comprobante de pago requiere identificar y reservar su pago primero.')}
            onConfirmPayment={manager ? async (docId, input) => { await documentoIdentityService.confirmarPago(docId, input); await refresh(); } : undefined}
          />
      </QueryContent>
      {error && <p role="alert" className="mt-3 text-sm text-error-700">{error}</p>}
    </CardContent>
  </Card>;
}
