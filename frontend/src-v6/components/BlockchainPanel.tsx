import React, { useState } from 'react';
import {
  Shield, ShieldCheck, ExternalLink, Copy, Check, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, Link2,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useBlockchainStatus } from '../hooks/useBlockchain';
import { manifiestoService } from '../services/manifiesto.service';
import type { BlockchainSello } from '../types/models';

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

function SelloCard({ sello, label }: { sello: BlockchainSello; label: string }) {
  if (sello.status === 'PENDIENTE') {
    return (
      <div className="px-4 py-3 bg-amber-50/60 rounded-xl border border-amber-200/50">
        <div className="flex items-center gap-2 mb-1">
          <Loader2 size={14} className="text-amber-500 animate-spin" />
          <span className="text-xs font-semibold text-amber-800">{label}</span>
          <span className="ml-auto text-[10px] text-amber-500 font-medium px-1.5 py-0.5 bg-amber-100 rounded-full">Pendiente</span>
        </div>
        {sello.txHash && (
          <a href={`${ETHERSCAN_BASE}/tx/${sello.txHash}`} target="_blank" rel="noopener noreferrer"
            className="font-mono text-[11px] text-amber-600 hover:underline">
            Tx: {truncateHash(sello.txHash, 6)} <ExternalLink size={10} className="inline" />
          </a>
        )}
      </div>
    );
  }

  if (sello.status === 'ERROR') {
    return (
      <div className="px-4 py-3 bg-red-50/60 rounded-xl border border-red-200/50">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-red-500" />
          <span className="text-xs font-semibold text-red-800">{label}</span>
          <span className="ml-auto text-[10px] text-red-500 font-medium px-1.5 py-0.5 bg-red-100 rounded-full">Error</span>
        </div>
      </div>
    );
  }

  // CONFIRMADO
  return (
    <div className="px-4 py-3 bg-emerald-50/40 rounded-xl border border-emerald-200/50">
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span className="text-xs font-semibold text-emerald-900">{label}</span>
        <span className="ml-auto text-[10px] text-emerald-600 font-medium px-1.5 py-0.5 bg-emerald-100 rounded-full">Verificado</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-neutral-400 uppercase tracking-wider shrink-0 w-12">SHA-256</span>
          <code className="font-mono text-[11px] text-neutral-700 truncate">{truncateHash(sello.hash, 8)}</code>
          <CopyButton text={sello.hash} />
        </div>
        {sello.txHash && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider shrink-0 w-12">Tx</span>
            <a href={`${ETHERSCAN_BASE}/tx/${sello.txHash}`} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] text-emerald-600 hover:underline truncate">
              {truncateHash(sello.txHash, 6)}
            </a>
            <ExternalLink size={10} className="text-neutral-400 shrink-0" />
          </div>
        )}
        <div className="flex items-center gap-3 text-[11px] text-neutral-500">
          {sello.blockNumber != null && (
            <span>Bloque: <span className="font-mono text-neutral-700">{sello.blockNumber.toLocaleString()}</span></span>
          )}
          {sello.blockTimestamp && (
            <span>{new Date(sello.blockTimestamp).toLocaleString('es-AR')}</span>
          )}
        </div>
      </div>
    </div>
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

  const sellos: BlockchainSello[] = data?.sellos || [];
  const genesisSello = sellos.find(s => s.tipo === 'GENESIS');
  const cierreSello = sellos.find(s => s.tipo === 'CIERRE');
  const status = data?.blockchainStatus || initialStatus;
  const canCertify = !status && !genesisSello && !isLoading && manifiestoEstado !== 'BORRADOR' && manifiestoEstado !== 'CANCELADO';

  // While loading, show nothing
  if (isLoading && !status && sellos.length === 0) return null;

  // If no status and can't certify, don't show
  if (!status && !canCertify && sellos.length === 0) return null;

  // --- NOT CERTIFIED YET: Show CTA button ---
  if (!genesisSello && canCertify) {
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

  // Count confirmed sellos for header
  const confirmedCount = sellos.filter(s => s.status === 'CONFIRMADO').length;
  const hasPending = sellos.some(s => s.status === 'PENDIENTE');
  const hasError = sellos.some(s => s.status === 'ERROR');

  // --- MAIN PANEL: 2 sellos + chain ---
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg shadow-emerald-100">
      {/* Header banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center ring-2 ring-white/30">
            {hasPending ? (
              <Loader2 size={22} className="text-white animate-spin" />
            ) : hasError ? (
              <AlertTriangle size={22} className="text-white" />
            ) : (
              <ShieldCheck size={22} className="text-white drop-shadow" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm tracking-tight">
              {confirmedCount > 0 ? 'Certificacion Blockchain' : 'Blockchain'}
            </p>
            <p className="text-emerald-100 text-xs">
              Ethereum Sepolia
              {confirmedCount > 0 && ` \u00b7 ${confirmedCount} sello${confirmedCount > 1 ? 's' : ''} verificado${confirmedCount > 1 ? 's' : ''}`}
            </p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-white/70" /> : <ChevronDown size={16} className="text-white/70" />}
        </div>
      </button>

      {expanded && (
        <div className="bg-white border border-emerald-100 border-t-0 p-4 space-y-3">
          {/* Genesis sello */}
          {genesisSello ? (
            <>
              <SelloCard sello={genesisSello} label="Sello Genesis (APROBADO)" />
              {genesisSello.status === 'CONFIRMADO' && (
                <p className="text-xs text-neutral-500 leading-relaxed px-4 -mt-1">
                  Este sello certifica la identidad del manifiesto al momento de su firma legal: numero, CUIT del generador,
                  transportista y operador, residuos declarados y fecha de firma. Cualquier modificacion posterior a estos datos
                  seria detectable.
                </p>
              )}
            </>
          ) : status === 'PENDIENTE' ? (
            <div className="px-4 py-3 bg-amber-50/60 rounded-xl border border-amber-200/50">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-amber-500 animate-spin" />
                <span className="text-xs font-semibold text-amber-800">Registrando sello genesis...</span>
              </div>
            </div>
          ) : status === 'ERROR' ? (
            <div className="px-4 py-3 bg-red-50/60 rounded-xl border border-red-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500" />
                  <span className="text-xs font-semibold text-red-800">Error en registro</span>
                </div>
                <button
                  onClick={() => registrarMutation.mutate()}
                  disabled={registrarMutation.isPending}
                  className="text-[11px] text-red-600 hover:text-red-800 font-medium"
                >
                  {registrarMutation.isPending ? 'Reintentando...' : 'Reintentar'}
                </button>
              </div>
            </div>
          ) : null}

          {/* Chain indicator */}
          {genesisSello && genesisSello.status === 'CONFIRMADO' && (
            <div className="px-4 py-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-dashed border-emerald-300" />
                <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider shrink-0">
                  cadena de integridad
                  {data?.rollingHash && ' \u00b7 chain activa'}
                </span>
                <div className="flex-1 border-t border-dashed border-emerald-300" />
              </div>
              <p className="text-xs text-neutral-500 leading-relaxed">
                En cada cambio de estado se calcula un hash acumulativo que encadena todos los datos anteriores.
                Si alguien modificara cualquier dato intermedio, la cadena se romperia y el sello de cierre no
                coincidiria con blockchain.
              </p>
            </div>
          )}

          {/* Cierre sello */}
          {cierreSello && (
            <>
              <SelloCard sello={cierreSello} label="Sello de Cierre (TRATADO)" />
              {cierreSello.status === 'CONFIRMADO' && (
                <p className="text-xs text-neutral-500 leading-relaxed px-4 -mt-1">
                  Este sello certifica el ciclo de vida completo del manifiesto: todas las fechas de transicion
                  (retiro, entrega, recepcion, cierre), estados intermedios, eventos registrados y observaciones.
                  Garantiza que ningun dato fue alterado durante todo el proceso.
                </p>
              )}
            </>
          )}

          {/* Contract info */}
          {data?.contractAddress && (
            <div className="pt-2 border-t border-neutral-100 px-1">
              <div className="flex items-center justify-between text-[10px] text-neutral-400">
                <span>Red: Ethereum Sepolia (Testnet)</span>
                <a href={`${ETHERSCAN_BASE}/address/${data.contractAddress}`} target="_blank" rel="noopener noreferrer"
                  className="text-emerald-500 hover:underline">
                  Contrato: {truncateHash(data.contractAddress, 4)}
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
