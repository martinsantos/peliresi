import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Shield } from 'lucide-react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface CertificateVerification {
  razonSocial: string;
  tipoActor: string;
  serial: string;
  vigenteDesde: string;
  vigenteHasta: string;
  estado: string;
  alcance: string | null;
}

const VerificarCertificadoPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<CertificateVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    axios.get(`${apiBase}/certificados/verificar/${encodeURIComponent(token)}`)
      .then(response => setData(response.data?.data || null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-neutral-50"><Loader2 className="animate-spin text-primary-600" /></div>;
  if (error || !data) return <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4"><div className="bg-white rounded-2xl shadow-lg p-8 text-center"><AlertTriangle className="mx-auto text-error-500 mb-3" /><h1 className="text-xl font-bold">Certificado no válido</h1><p className="text-sm text-neutral-500 mt-2">La firma no pudo verificarse o el certificado no existe.</p></div></div>;

  const active = data.estado === 'ACTIVA';
  return <div className="min-h-screen bg-neutral-50 p-4 flex justify-center pt-12"><div className="bg-white rounded-2xl shadow-lg border border-neutral-200 max-w-lg w-full overflow-hidden">
    <div className="bg-[#1B5E3C] text-white p-6"><div className="flex items-center gap-2 text-sm opacity-90"><Shield size={18} /> SITREP · Verificación pública</div><h1 className="text-2xl font-bold mt-2">Certificado {data.serial}</h1></div>
    <div className="p-6 space-y-4"><div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${active ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>{active ? <CheckCircle2 size={18} /> : <Clock size={18} />} Estado: {data.estado}</div>
      <dl className="grid grid-cols-[140px_1fr] gap-y-3 text-sm"><dt className="text-neutral-500">Razón social</dt><dd className="font-semibold">{data.razonSocial}</dd><dt className="text-neutral-500">Tipo de actor</dt><dd>{data.tipoActor}</dd><dt className="text-neutral-500">Vigencia</dt><dd>{new Date(data.vigenteDesde).toLocaleDateString('es-AR')} — {new Date(data.vigenteHasta).toLocaleDateString('es-AR')}</dd><dt className="text-neutral-500">Alcance</dt><dd>{data.alcance || 'Autorización registrada'}</dd></dl>
      <p className="text-xs text-neutral-400">La verificación se realiza contra la firma Ed25519 registrada en SITREP. No se exponen documentos ni datos fiscales.</p>
    </div>
  </div></div>;
};

export default VerificarCertificadoPage;
