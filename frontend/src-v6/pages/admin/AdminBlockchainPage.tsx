import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Shield, ExternalLink, Copy, Check, Loader2,
  AlertTriangle, Link2, ChevronLeft, ChevronRight,
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
            Certificación Blockchain
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Manifiestos certificados en Ethereum Sepolia &middot; {total} registro{total !== 1 ? 's' : ''}
          </p>
        </div>
        {contractAddress && (
          <a
            href={`${ETHERSCAN_BASE}/address/${contractAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors"
          >
            <Link2 size={16} />
            Ver Contrato
            <ExternalLink size={12} />
          </a>
        )}
      </div>

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
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Estado</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Blockchain</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">TX Hash</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Bloque</th>
                    <th className="text-left py-3 px-3 text-xs text-neutral-500 uppercase tracking-wider">Fecha Registro</th>
                  </tr>
                </thead>
                <tbody>
                  {manifiestos.map((m: any) => {
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
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>
                            {st.icon}
                            {m.blockchainStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <code className="font-mono text-xs text-neutral-600">{truncateHash(m.blockchainHash)}</code>
                            {m.blockchainHash && <CopyBtn text={m.blockchainHash} />}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          {m.blockchainTxHash ? (
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
                        <td className="py-3 px-3 font-mono text-xs text-neutral-600">
                          {m.blockchainBlockNumber?.toLocaleString() || '-'}
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
