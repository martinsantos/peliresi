import React, { useState } from 'react';
import {
  Shield, ShieldCheck, ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Link2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlockchainStatus } from '../hooks/useBlockchain';
import { manifiestoService } from '../services/manifiesto.service';

const ETHERSCAN_BASE = 'https://sepolia.etherscan.io';

function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 hover:bg-white/20 rounded transition-colors" title="Copiar">
      {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} className="text-emerald-400/70" />}
    </button>
  );
}

interface BlockchainPanelProps {
  manifiestoId: string;
  manifiestoEstado: string;
  blockchainStatus?: string | null;
}

export default function BlockchainPanel({ manifiestoId, manifiestoEstado, blockchainStatus: initialStatus }: BlockchainPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();
  const { data, isLoading } = useBlockchainStatus(manifiestoId, true);

  const registrarMutation = useMutation({
    mutationFn: () => manifiestoService.registrarBlockchain(manifiestoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blockchain', manifiestoId] });
      queryClient.invalidateQueries({ queryKey: ['manifiesto', manifiestoId] });
    },
  });

  const status = data?.blockchainStatus || initialStatus;
  const canCertify = !status && !isLoading && manifiestoEstado !== 'BORRADOR' && manifiestoEstado !== 'CANCELADO';

  // While loading, show nothing (prevents flash of "Certificar" button)
  if (isLoading && !status) return null;

  // If no status and can't certify, don't show
  if (!status && !canCertify) return null;

  const hash = data?.blockchainHash;
  const txHash = data?.blockchainTxHash;
  const blockNumber = data?.blockchainBlockNumber;
  const timestamp = data?.blockchainTimestamp;
  const contractAddress = data?.contractAddress;

  // --- NOT CERTIFIED YET: Show CTA button ---
  if (!status && canCertify) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 p-5 text-center">
        <Shield size={32} className="mx-auto text-emerald-400 mb-2" />
        <p className="text-sm font-semibold text-emerald-800 mb-1">Certificacion Blockchain</p>
        <p className="text-xs text-emerald-600 mb-3">
          Registra este manifiesto en la blockchain de Ethereum para garantizar su inmutabilidad
        </p>
        <button
          onClick={() => registrarMutation.mutate()}
          disabled={registrarMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:from-emerald-700 hover:to-teal-700 transition-all disabled:opacity-50"
        >
          {registrarMutation.isPending ? (
            <><Loader2 size={16} className="animate-spin" /> Registrando...</>
          ) : (
            <><Link2 size={16} /> Certificar en Blockchain</>
          )}
        </button>
        {registrarMutation.isError && (
          <p className="text-xs text-red-500 mt-2">Error al registrar. Intenta de nuevo.</p>
        )}
      </div>
    );
  }

  // --- PENDING ---
  if (status === 'PENDIENTE') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Loader2 size={22} className="text-amber-600 animate-spin" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">Registrando en Blockchain</p>
            <p className="text-xs text-amber-600">Esperando confirmacion de la red Ethereum...</p>
          </div>
        </div>
        {txHash && (
          <div className="mt-2 px-3 py-2 bg-white/60 rounded-lg">
            <p className="text-[10px] text-amber-500 mb-0.5">TX Hash</p>
            <a href={`${ETHERSCAN_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-xs text-amber-700 hover:underline">
              {truncateHash(txHash)} <ExternalLink size={10} className="inline" />
            </a>
          </div>
        )}
      </div>
    );
  }

  // --- ERROR ---
  if (status === 'ERROR') {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
            <AlertTriangle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-900">Error de Registro</p>
            <p className="text-xs text-red-600">No se pudo registrar en blockchain</p>
          </div>
        </div>
        <button
          onClick={() => registrarMutation.mutate()}
          disabled={registrarMutation.isPending}
          className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
        >
          {registrarMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
          Reintentar
        </button>
      </div>
    );
  }

  // --- CONFIRMED: The main visual ---
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg shadow-emerald-100">
      {/* Header banner with gradient */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
            <ShieldCheck size={28} className="text-white drop-shadow" />
          </div>
          <div>
            <p className="text-white font-bold text-base tracking-tight">Verificado en Blockchain</p>
            <p className="text-emerald-100 text-xs">Ethereum Sepolia &middot; Inmutable</p>
          </div>
        </div>
      </div>

      {/* Hash highlight bar */}
      <div className="bg-emerald-800 px-5 py-2.5 flex items-center gap-2">
        <span className="text-[10px] text-emerald-300 uppercase tracking-wider font-semibold shrink-0">SHA-256</span>
        <code className="font-mono text-xs text-emerald-100 truncate flex-1">{hash ? truncateHash(hash, 10) : '...'}</code>
        {hash && <CopyButton text={hash} />}
      </div>

      {/* Technical details */}
      <div className="bg-white border border-emerald-100 border-t-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-emerald-700 hover:bg-emerald-50/50 transition-colors"
        >
          <span className="font-medium">{expanded ? 'Ocultar detalles' : 'Ver detalles tecnicos'}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && !isLoading && (
          <div className="px-5 pb-4 space-y-3 border-t border-emerald-50">
            {txHash && (
              <div className="pt-3">
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-1">Transaccion</p>
                <div className="flex items-center gap-1.5">
                  <a href={`${ETHERSCAN_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    className="font-mono text-xs text-emerald-600 hover:underline">
                    {truncateHash(txHash)}
                  </a>
                  <ExternalLink size={11} className="text-neutral-400" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {blockNumber != null && (
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-0.5">Bloque</p>
                  <p className="font-mono text-xs text-neutral-800">{blockNumber.toLocaleString()}</p>
                </div>
              )}
              {timestamp && (
                <div>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-0.5">Timestamp</p>
                  <p className="text-xs text-neutral-800">{new Date(timestamp).toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>

            {contractAddress && (
              <div>
                <p className="text-[10px] text-neutral-400 uppercase tracking-wider mb-0.5">Contrato</p>
                <a href={`${ETHERSCAN_BASE}/address/${contractAddress}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-emerald-600 hover:underline">
                  {truncateHash(contractAddress)}
                </a>
              </div>
            )}

            <div className="pt-2 border-t border-neutral-100">
              <p className="text-[10px] text-neutral-400">Red: Ethereum Sepolia (Testnet)</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
