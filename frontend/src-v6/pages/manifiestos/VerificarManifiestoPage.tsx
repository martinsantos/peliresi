/**
 * SITREP v6 - Verificar Manifiesto (Página Pública)
 * ===================================================
 * Accesible sin login via QR code.
 * Muestra info básica del manifiesto.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileText, Building2, Truck, Factory, Calendar, Shield,
  AlertTriangle, CheckCircle2, Clock, ArrowRight, Loader2
} from 'lucide-react';
import axios from 'axios';

interface VerificacionData {
  numero: string;
  estado: string;
  createdAt: string;
  fechaFirma: string | null;
  fechaRetiro: string | null;
  fechaEntrega: string | null;
  fechaRecepcion: string | null;
  fechaCierre: string | null;
  generador: { razonSocial: string };
  transportista: { razonSocial: string };
  operador: { razonSocial: string };
  residuos: Array<{
    cantidad: number;
    unidad: string;
    tipoResiduo: { nombre: string; codigo: string };
  }>;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  BORRADOR: { label: 'Borrador', color: 'bg-neutral-100 text-neutral-700', icon: <FileText size={14} /> },
  APROBADO: { label: 'Aprobado', color: 'bg-primary-100 text-primary-800', icon: <CheckCircle2 size={14} /> },
  EN_TRANSITO: { label: 'En Tránsito', color: 'bg-info-100 text-info-800', icon: <Truck size={14} /> },
  ENTREGADO: { label: 'Entregado', color: 'bg-warning-100 text-warning-800', icon: <ArrowRight size={14} /> },
  RECIBIDO: { label: 'Recibido', color: 'bg-success-100 text-success-800', icon: <CheckCircle2 size={14} /> },
  EN_TRATAMIENTO: { label: 'En Tratamiento', color: 'bg-info-100 text-info-800', icon: <Clock size={14} /> },
  TRATADO: { label: 'Tratado', color: 'bg-success-100 text-success-800', icon: <Shield size={14} /> },
  RECHAZADO: { label: 'Rechazado', color: 'bg-error-100 text-error-800', icon: <AlertTriangle size={14} /> },
  CANCELADO: { label: 'Cancelado', color: 'bg-neutral-100 text-neutral-600', icon: <AlertTriangle size={14} /> },
};

const formatDate = (d: string | null): string => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const VerificarManifiestoPage: React.FC = () => {
  const { numero } = useParams<{ numero: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<VerificacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!numero) return;
    const apiBase = import.meta.env.VITE_API_URL || '/api';
    axios.get(`${apiBase}/manifiestos/verificar/${encodeURIComponent(numero)}`)
      .then(res => {
        if (res.data.success && res.data.data?.manifiesto) {
          setData(res.data.data.manifiesto);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [numero]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
          <p className="text-neutral-600 font-medium">Verificando manifiesto...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-error-50 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-error-500" />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Manifiesto no encontrado</h1>
          <p className="text-neutral-500 mb-6">
            No se encontró un manifiesto con el número <span className="font-mono font-semibold">{numero}</span>.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const estadoCfg = ESTADO_CONFIG[data.estado] || ESTADO_CONFIG.BORRADOR;

  return (
    <div className="min-h-screen bg-neutral-50 p-4 flex items-start justify-center pt-8 md:pt-16">
      <div className="bg-white rounded-2xl shadow-lg border border-neutral-200 max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-6 h-6 opacity-80" />
            <span className="text-sm font-medium opacity-80">SITREP — Verificación de Manifiesto</span>
          </div>
          <h1 className="text-2xl font-bold font-mono tracking-wide">{data.numero}</h1>
        </div>

        {/* Estado */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-sm font-medium text-neutral-500">Estado actual</span>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${estadoCfg.color}`}>
            {estadoCfg.icon}
            {estadoCfg.label}
          </span>
        </div>

        {/* Actores */}
        <div className="px-6 py-4 space-y-3 border-b border-neutral-100">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
              <Factory size={16} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500">Generador</p>
              <p className="text-sm font-semibold text-neutral-900">{data.generador.razonSocial}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 mt-0.5">
              <Truck size={16} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500">Transportista</p>
              <p className="text-sm font-semibold text-neutral-900">{data.transportista.razonSocial}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-500">Operador</p>
              <p className="text-sm font-semibold text-neutral-900">{data.operador.razonSocial}</p>
            </div>
          </div>
        </div>

        {/* Residuos */}
        {data.residuos.length > 0 && (
          <div className="px-6 py-4 border-b border-neutral-100">
            <p className="text-xs text-neutral-500 mb-2">Residuos</p>
            <div className="space-y-1.5">
              {data.residuos.map((r, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="text-neutral-700">{r.tipoResiduo.nombre} <span className="text-neutral-400 text-xs">({r.tipoResiduo.codigo})</span></span>
                  <span className="font-mono font-medium text-neutral-900">{r.cantidad} {r.unidad}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className="px-6 py-4 border-b border-neutral-100">
          <p className="text-xs text-neutral-500 mb-2">Fechas</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-neutral-500">Creación:</span></div>
            <div className="text-right font-medium">{formatDate(data.createdAt)}</div>
            {data.fechaFirma && (<>
              <div><span className="text-neutral-500">Firma:</span></div>
              <div className="text-right font-medium">{formatDate(data.fechaFirma)}</div>
            </>)}
            {data.fechaRetiro && (<>
              <div><span className="text-neutral-500">Retiro:</span></div>
              <div className="text-right font-medium">{formatDate(data.fechaRetiro)}</div>
            </>)}
            {data.fechaEntrega && (<>
              <div><span className="text-neutral-500">Entrega:</span></div>
              <div className="text-right font-medium">{formatDate(data.fechaEntrega)}</div>
            </>)}
            {data.fechaRecepcion && (<>
              <div><span className="text-neutral-500">Recepción:</span></div>
              <div className="text-right font-medium">{formatDate(data.fechaRecepcion)}</div>
            </>)}
            {data.fechaCierre && (<>
              <div><span className="text-neutral-500">Cierre:</span></div>
              <div className="text-right font-medium">{formatDate(data.fechaCierre)}</div>
            </>)}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 py-5 text-center">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
          >
            Iniciar sesión para ver detalle completo
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificarManifiestoPage;
