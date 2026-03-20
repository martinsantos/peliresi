import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Shield, ExternalLink, Copy, Check, Loader2,
  AlertTriangle, Link2, ChevronLeft, ChevronRight, Search,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import api from '../../services/api';

const ETHERSCAN_BASE = 'https://sepolia.etherscan.io';

function truncateHash(hash: string, chars = 6): string {
  if (!hash || hash.length <= chars * 2 + 2) return hash || '';
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 hover:bg-neutral-100 rounded"
    >
      {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-neutral-400" />}
    </button>
  );
}

const statusStyles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  CONFIRMADO: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: <ShieldCheck size={14} /> },
  PENDIENTE: { bg: 'bg-amber-50', text: 'text-amber-700', icon: <Loader2 size={14} className="animate-spin" /> },
  ERROR: { bg: 'bg-red-50', text: 'text-red-700', icon: <AlertTriangle size={14} /> },
};

const integridadStyles: Record<string, { bg: string; text: string }> = {
  COMPLETA: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  PARCIAL: { bg: 'bg-amber-50', text: 'text-amber-700' },
  FALLIDA: { bg: 'bg-red-50', text: 'text-red-700' },
  SIN_SELLOS: { bg: 'bg-neutral-50', text: 'text-neutral-500' },
};

export default function AdminBlockchainPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<string>('');
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['blockchain-registro', page, filter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filter) params.set('status', filter);
      const { data } = await api.get(`/blockchain/registro?${params}`);
      return data.data;
    },
  });

  // Verification mutation
  const verificarMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/blockchain/verificar-lote');
      return data.data;
    },
  });

  const manifiestos = data?.manifiestos || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const contractAddress = data?.contractAddress;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <ShieldCheck size={28} className="text-emerald-600" />
            Certificacion Blockchain
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Manifiestos certificados en Ethereum Sepolia &middot; {total} registro{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => verificarMutation.mutate()}
            disabled={verificarMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {verificarMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Search size={16} />
            )}
            Verificar Integridad
          </button>
          {contractAddress && (
            <a
              href={`${ETHERSCAN_BASE}/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              <Link2 size={16} />
              Contrato
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Verification Results */}
      {verificarMutation.data && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-neutral-900">Verificacion de Integridad</h3>
              <span className="text-xs text-neutral-400">
                {verificarMutation.data.totalVerificados} manifiestos verificados
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{verificarMutation.data.integridadCompleta}</p>
                <p className="text-xs text-emerald-600">Completa</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-700">{verificarMutation.data.integridadParcial}</p>
                <p className="text-xs text-amber-600">Parcial</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{verificarMutation.data.integridadFallida}</p>
                <p className="text-xs text-red-600">Fallida</p>
              </div>
              <div className="bg-neutral-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-neutral-600">{verificarMutation.data.sinBlockchain}</p>
                <p className="text-xs text-neutral-500">Sin blockchain</p>
              </div>
            </div>
            {/* Failures detail */}
            {verificarMutation.data.detalle?.filter((d: any) => d.integridad === 'FALLIDA').length > 0 && (
              <div className="border-t border-neutral-100 pt-3">
                <p className="text-xs font-semibold text-red-700 mb-2">Discrepancias detectadas:</p>
                {verificarMutation.data.detalle
                  .filter((d: any) => d.integridad === 'FALLIDA')
                  .map((d: any) => (
                    <div key={d.id} className="flex items-center gap-2 py-1.5 text-sm">
                      <AlertTriangle size={14} className="text-red-500 shrink-0" />
                      <span className="font-mono text-red-800">{d.numero}</span>
                      <span className="text-red-600 text-xs">
                        {d.discrepancias?.join(', ')}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: '', label: 'Todos' },
          { value: 'CONFIRMADO', label: 'Confirmados' },
          { value: 'PENDIENTE', label: 'Pendientes' },
          { value: 'ERROR', label: 'Con Error' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-emerald-500" />
            </div>
          ) : manifiestos.length === 0 ? (
            <div className="text-center py-12">
              <Shield size={48} className="mx-auto text-neutral-300 mb-3" />
              <p className="text-neutral-500">No hay registros blockchain</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Manifiesto</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Generador</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Sellos</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Genesis</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Cierre</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {manifiestos.map((m: any) => {
                    const sellos = m.sellosBlockchain || [];
                    const genesis = sellos.find((s: any) => s.tipo === 'GENESIS');
                    const cierre = sellos.find((s: any) => s.tipo === 'CIERRE');
                    const st = statusStyles[m.blockchainStatus] || statusStyles.PENDIENTE;
                    return (
                      <tr
                        key={m.id}
                        className="border-b border-neutral-50 hover:bg-neutral-50/50 cursor-pointer transition-colors"
                        onClick={() => navigate(`/manifiestos/${m.id}`)}
                      >
                        <td className="py-3 px-3">
                          <span className="font-mono font-semibold text-neutral-900">{m.numero}</span>
                        </td>
                        <td className="py-3 px-3 text-neutral-600 max-w-[180px] truncate">
                          {m.generador?.razonSocial || '-'}
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            {genesis && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                statusStyles[genesis.status]?.bg || 'bg-neutral-50'
                              } ${statusStyles[genesis.status]?.text || 'text-neutral-500'}`}>
                                G
                              </span>
                            )}
                            {cierre && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                statusStyles[cierre.status]?.bg || 'bg-neutral-50'
                              } ${statusStyles[cierre.status]?.text || 'text-neutral-500'}`}>
                                C
                              </span>
                            )}
                            {!genesis && !cierre && (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                                {st.icon}
                                {m.blockchainStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {genesis?.txHash ? (
                            <a
                              href={`${ETHERSCAN_BASE}/tx/${genesis.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {truncateHash(genesis.txHash)}
                              <ExternalLink size={10} />
                            </a>
                          ) : m.blockchainTxHash ? (
                            <a
                              href={`${ETHERSCAN_BASE}/tx/${m.blockchainTxHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {truncateHash(m.blockchainTxHash)}
                              <ExternalLink size={10} />
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3">
                          {cierre?.txHash ? (
                            <a
                              href={`${ETHERSCAN_BASE}/tx/${cierre.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-mono text-xs text-emerald-600 hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {truncateHash(cierre.txHash)}
                              <ExternalLink size={10} />
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-xs text-neutral-600">
                          {m.blockchainTimestamp
                            ? new Date(m.blockchainTimestamp).toLocaleString('es-AR')
                            : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-neutral-100 mt-2">
              <span className="text-xs text-neutral-500">
                Mostrando {(page - 1) * limit + 1}-{Math.min(page * limit, total)} de {total}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
