import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { documentoIdentityService, generadorFiscalService, operadorFiscalService, type Documento } from '../services/generador-fiscal.service';
import { Card, CardHeader, CardContent } from './ui/CardV2';
import { Button } from './ui/ButtonV2';
import DocumentUpload from './DocumentUpload';

/** Uses the existing actor-document endpoints and their sector/ownership checks. */
export function OperadorDocuments({ actorId, cuit }: { actorId: string; cuit: string }) {
  const { currentUser } = useAuth();
  const client = useQueryClient();
  const queryKey = ['documentos-alta-operador', currentUser?.id, actorId];
  const documents = useQuery({ queryKey, enabled: Boolean(currentUser && actorId), retry: false,
    queryFn: () => operadorFiscalService.getDocumentos(actorId) });
  const manager = currentUser?.rol === 'ADMIN' || currentUser?.rol === 'ADMIN_OPERADOR';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey }),
      client.invalidateQueries({ queryKey: ['historial-actor', 'OPERADOR', actorId] }),
      client.invalidateQueries({ queryKey: ['certificados-actor', currentUser?.id, 'OPERADOR', actorId] }),
    ]);
  };
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
      {documents.isPending ? <p role="status">Cargando documentos…</p>
        : documents.isError ? <div role="alert">No se pudieron consultar los documentos. <Button variant="outline" onClick={() => void documents.refetch()}>Reintentar</Button></div>
          : <DocumentUpload documentos={documents.data || []} cuit={cuit} isAdmin={manager} readOnly={!manager} isPending={busy} initialTipo="FACTURA_ELECTRICA"
            onUpload={(file, tipo, anio) => void change(() => operadorFiscalService.uploadDocumento(actorId, file, tipo, anio), 'No se pudo adjuntar el documento. Podés volver a seleccionarlo para reintentar.')}
            onDownload={doc => void download(doc)}
            onRevisar={(docId, estado, observaciones) => void change(() => generadorFiscalService.revisarDocumento(docId, estado, observaciones), 'No se pudo revisar el documento. El comprobante de pago requiere identificar y reservar su pago primero.')}
            onConfirmPayment={manager ? async (docId, input) => { await documentoIdentityService.confirmarPago(docId, input); await refresh(); } : undefined}
          />}
      {error && <p role="alert" className="mt-3 text-sm text-error-700">{error}</p>}
    </CardContent>
  </Card>;
}
