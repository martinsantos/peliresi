import React, { useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Copy, ExternalLink, QrCode, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { InspectionVerification } from '../../types/inspection';

function absoluteVerificationUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  if (typeof window === 'undefined') return value;
  return new URL(value, window.location.origin).toString();
}

export function InspectionVerificationBlock({
  verification,
  compact = false,
  showPublicLink = true,
}: {
  verification?: InspectionVerification | null;
  compact?: boolean;
  showPublicLink?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const url = verification?.url ? absoluteVerificationUrl(verification.url) : '';
  const isHistorical = verification?.estadoVerificacion === 'HISTORICA_AUTENTICA';
  const statusLabel = verification?.estadoVerificacion === 'VIGENTE'
    ? 'Documento vigente'
    : isHistorical ? 'Versión histórica auténtica' : 'Documento verificable';

  if (!verification?.url) {
    return (
      <section id="verificacion" data-testid="inspection-verification" className="scroll-mt-24 border-y border-amber-200 bg-amber-50/70 px-4 py-4 text-amber-950 sm:px-5">
        <div className="flex items-start gap-3">
          <ShieldCheck size={19} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div><h3 className="font-extrabold">Trazabilidad pública pendiente</h3><p className="mt-1 text-xs leading-relaxed">Esta versión todavía no tiene un enlace público de verificación. La huella interna permanece preservada.</p></div>
        </div>
      </section>
    );
  }

  const copyValue = async (value: string, onCopied: (copied: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(value);
      onCopied(true);
      window.setTimeout(() => onCopied(false), 1800);
    } catch {
      onCopied(false);
    }
  };

  return (
    <section id="verificacion" data-testid="inspection-verification" aria-labelledby="inspection-verification-title" className={`scroll-mt-24 border-y ${isHistorical ? 'border-amber-300 bg-amber-50/70' : 'border-[#B9D9C5] bg-[#F3FAF5]'} ${compact ? 'px-4 py-4 sm:px-5' : 'px-4 py-5 sm:px-6'}`}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.14em] ${isHistorical ? 'text-amber-800' : 'text-[#1B5E3C]'}`}>{isHistorical ? <AlertTriangle size={14} aria-hidden="true" /> : verification.estadoVerificacion === 'VIGENTE' ? <CheckCircle2 size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}{statusLabel}</p>
          <h3 id="inspection-verification-title" className="mt-1 text-lg font-extrabold text-[#10213A]">Trazabilidad pública de la inspección</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-700">{isHistorical ? <>Este enlace conserva la versión <strong>{verification.version}</strong> emitida por SITREP. La versión actual registrada del expediente es la <strong>{verification.versionActual ?? 'más reciente'}</strong>.</> : <>Escaneá el código para consultar la versión registrada por SITREP y su huella documental.</>} La página pública no expone evidencias privadas ni sustituye una firma digital.</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral-600">
            <span className="font-semibold">Versión <span className="font-mono text-[#10213A]">{verification.version}</span></span>
            <span className="max-w-full break-all font-mono text-[11px] text-[#1B5E3C]" title={verification.huella}>SHA-256 {verification.huella.slice(0, 20)}…</span>
            <button type="button" onClick={() => void copyValue(verification.huella, setCopiedHash)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-[#9CC8AA] bg-white px-2 py-1 text-[11px] font-extrabold text-[#1B5E3C] hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E3C] focus-visible:ring-offset-2">{copiedHash ? 'Huella copiada' : 'Copiar huella'}</button>
          </div>
          <details className="mt-3 max-w-full text-xs text-neutral-600"><summary className="w-fit cursor-pointer font-bold text-[#1B5E3C]">Ver huella completa</summary><code className="mt-2 block max-w-full break-all rounded-md border border-[#C6E1CE] bg-white px-2 py-2 font-mono text-[10px] leading-relaxed text-[#10213A]">{verification.huella}</code></details>
          <div className="mt-4 flex flex-wrap gap-2">
            {showPublicLink && <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#1B5E3C] px-3.5 py-2 text-xs font-extrabold text-white transition-colors hover:bg-[#15492E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E3C] focus-visible:ring-offset-2"><ExternalLink size={15} aria-hidden="true" />Abrir verificación pública</a>}
            <button type="button" onClick={() => void copyValue(url, setCopied)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#9CC8AA] bg-white px-3.5 py-2 text-xs font-extrabold text-[#1B5E3C] transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E3C] focus-visible:ring-offset-2"><span aria-hidden="true">{copied ? <Check size={15} /> : <Copy size={15} />}</span>{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-start rounded-xl border border-[#C6E1CE] bg-white p-3 sm:self-center">
          <div className="rounded-lg bg-white p-1" aria-label="Código QR de verificación pública"><QRCodeSVG value={url} size={compact ? 176 : 200} level="M" marginSize={4} bgColor="#FFFFFF" fgColor="#10213A" /></div>
          <div className="hidden max-w-[130px] sm:block"><p className="flex items-center gap-1.5 text-xs font-extrabold text-[#10213A]"><QrCode size={15} className="text-[#1B5E3C]" aria-hidden="true" />Escanear para verificar</p><p className="mt-1 text-[11px] leading-relaxed text-neutral-500">Acceso público autorizado por SITREP.</p></div>
        </div>
      </div>
    </section>
  );
}

export default InspectionVerificationBlock;
