import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Download, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/ButtonV2';
import { Input } from './ui/Input';
import api from '../services/api';
import { generadorFiscalService, type Documento } from '../services/generador-fiscal.service';

type ActorType = 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA';
const paths: Record<ActorType, string> = { GENERADOR: 'generadores', OPERADOR: 'operadores', TRANSPORTISTA: 'transportistas' };

/** Download the original issued document; never recreate its signature or legal content. */
export default function ActorCertificates({ type, actorId }: { type: ActorType; actorId: string }) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const manager = currentUser?.rol === 'ADMIN' || currentUser?.rol === `ADMIN_${type}`;
  const documents = useQuery({
    queryKey: ['certificados-actor', currentUser?.id, type, actorId],
    enabled: Boolean(currentUser && actorId),
    queryFn: async (): Promise<Documento[]> => (await api.get(`/actores/${paths[type]}/${encodeURIComponent(actorId)}/documentos`)).data.data.documentos || [],
    retry: false,
  });
  const certificates = (documents.data || []).filter(doc => doc.tipo === 'CERTIFICADO_AMBIENTAL' && (doc.estado === 'APROBADO' || manager))
    .sort((left, right) => (right.anio || 0) - (left.anio || 0) || right.createdAt.localeCompare(left.createdAt))
    .filter((doc, index, all) => index === all.findIndex(other => other.anio === doc.anio && other.estado === doc.estado));
  const previousCertificates = (documents.data || []).filter(doc => doc.tipo === 'CERTIFICADO_AMBIENTAL' && doc.estado === 'APROBADO' && !certificates.includes(doc));
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['certificados-actor', currentUser?.id, type, actorId] }),
      queryClient.invalidateQueries({ queryKey: ['historial-actor', type, actorId] }),
      queryClient.invalidateQueries({ queryKey: [`${type.toLowerCase()}-documentos`, actorId] }),
    ]);
  };
  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    if (!file) { setError('Elegí el PDF oficial del certificado.'); return; }
    if (!/^\d{4}$/.test(year) || Number(year) < 1900 || Number(year) > 2100) { setError('Indicá el año del certificado.'); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('archivo', file); body.append('tipo', 'CERTIFICADO_AMBIENTAL'); body.append('anio', year);
      await api.post(`/actores/${paths[type]}/${encodeURIComponent(actorId)}/documentos`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(null); if (fileInput.current) fileInput.current.value = ''; await refresh();
    } catch { setError('No se pudo cargar el certificado. El archivo seleccionado se conserva para reintentar.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const download = async (doc: Documento) => {
    setError('');
    try { await generadorFiscalService.downloadDocumento(doc.id, doc.nombre); }
    catch { setError('No se pudo descargar el certificado. Podés reintentar.'); }
  };
  const approve = async (doc: Documento) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await generadorFiscalService.revisarDocumento(doc.id, 'APROBADO'); await refresh(); }
    catch { setError('No se pudo publicar el certificado.'); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section aria-label="Certificados ambientales oficiales" className="min-w-0 rounded-xl border border-neutral-200 bg-white p-4">
    <h3 className="flex items-center gap-2 font-semibold text-neutral-900"><Award size={20} className="shrink-0 text-primary-800" />Certificado ambiental anual</h3>
    {!!certificates.length && <p className="mt-1 text-sm text-neutral-600">Último PDF publicado de cada año.</p>}
    {documents.isPending ? <p role="status" className="mt-2 text-sm text-neutral-600">Cargando certificados…</p>
      : documents.isError ? <div role="alert" className="mt-2 text-sm text-error-700">No se pudieron consultar los certificados. <Button variant="outline" onClick={() => void documents.refetch()}>Reintentar</Button></div>
        : certificates.length ? <ul className="mt-3 divide-y divide-neutral-200">{certificates.map(doc => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="min-w-0 text-sm text-neutral-800"><span className="font-semibold">{doc.anio || 'Sin año informado'}</span> · <span className="break-words">{doc.nombre}</span>{doc.estado !== 'APROBADO' && <span className="block text-warning-800">Pendiente de publicación por DGFA</span>}</span>
          <div className="flex flex-wrap gap-2"><Button variant="outline" leftIcon={<Download size={16} />} onClick={() => void download(doc)}>Descargar CAA {doc.anio || ''}</Button>
            {manager && doc.estado === 'PENDIENTE' && <Button variant="outline" isLoading={busy} onClick={() => void approve(doc)}>Publicar certificado</Button>}</div>
        </li>)}</ul> : <p className="mt-2 text-sm text-neutral-600">DGFA todavía no publicó un certificado para este actor.</p>}
    {!!previousCertificates.length && <details className="mt-3 border-t border-neutral-200 pt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-neutral-800">Versiones anteriores ({previousCertificates.length})</summary>
      <ul>{previousCertificates.map(doc => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span className="min-w-0 break-words">{doc.anio} · {doc.nombre} · {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Mendoza' }).format(new Date(doc.createdAt))}</span><Button variant="outline" leftIcon={<Download size={16} />} onClick={() => void download(doc)}>Descargar versión anterior</Button></li>)}</ul>
    </details>}
    {manager && <details className="mt-3 border-t border-neutral-200 pt-2"><summary className="min-h-11 cursor-pointer text-sm font-semibold text-primary-800">Cargar certificado oficial</summary>
      <form onSubmit={event => void upload(event)} className="mt-2 flex flex-wrap items-end gap-3">
        <div className="w-28"><Input label="Año del certificado" type="number" min={1900} max={2100} value={year} disabled={busy} onChange={event => setYear(event.target.value)} /></div>
        <label className="min-w-0 flex-1 text-sm text-neutral-700">PDF oficial firmado<input ref={fileInput} type="file" accept="application/pdf,.pdf" disabled={busy} className="mt-1 block min-h-11 w-full text-sm file:mr-2 file:min-h-11 file:rounded-lg file:border file:border-neutral-400 file:bg-white file:px-3"
          onChange={event => { const chosen = event.target.files?.[0] || null; if (chosen && (chosen.type !== 'application/pdf' || chosen.size > 10 * 1024 * 1024)) { setError('Elegí un PDF de hasta 10 MB.'); event.target.value = ''; setFile(null); } else { setFile(chosen); setError(''); } }} /></label>
        <Button type="submit" isLoading={busy} leftIcon={<Upload size={16} />}>Cargar certificado</Button>
      </form><p className="mt-2 text-sm text-neutral-600">Se conserva el PDF completo, con sus firmas y anexos. El archivo queda disponible para este actor y su carga en el historial.</p>
    </details>}
    {error && <p role="alert" className="mt-3 text-sm text-error-700">{error}</p>}
  </section>;
}
