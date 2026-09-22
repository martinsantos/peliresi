import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Expand, Image as ImageIcon, X } from 'lucide-react';
import { inspeccionService } from '../../services/inspeccion.service';

export function InspectionEvidenceImage({ inspectionId, evidenceId, alt, className = '', preview = false }: {
  inspectionId: string;
  evidenceId: string;
  alt: string;
  className?: string;
  preview?: boolean;
}) {
  const requestKey = `${inspectionId}:${evidenceId}`;
  const [image, setImage] = useState<{ key: string; url: string | null; failed: boolean; loaded: boolean }>({ key: '', url: null, failed: false, loaded: false });
  const current = image.key === requestKey ? image : { key: requestKey, url: null, failed: false, loaded: false };
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImage({ key: requestKey, url: null, failed: false, loaded: false });
    inspeccionService.evidenceObjectUrl(inspectionId, evidenceId).then((next) => {
      objectUrl = next;
      if (active) setImage({ key: requestKey, url: next, failed: false, loaded: false });
      else URL.revokeObjectURL(next);
    }).catch(() => {
      if (active) setImage({ key: requestKey, url: null, failed: true, loaded: false });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, evidenceId, requestKey]);

  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [open]);

  const thumbnail = <span className={`relative block overflow-hidden bg-neutral-100 text-neutral-400 ${className}`}>
    {(!current.url || !current.loaded) && <span role="img" aria-label={current.failed ? `Miniatura no disponible: ${alt}` : `Cargando miniatura: ${alt}`} className="absolute inset-0 flex items-center justify-center bg-neutral-100"><ImageIcon size={24} /></span>}
    {current.url && !current.failed && <img
      src={current.url}
      alt={alt}
      loading="eager"
      decoding="sync"
      data-loaded={current.loaded ? 'true' : 'false'}
      onLoad={() => setImage((value) => value.key === requestKey ? { ...value, loaded: true } : value)}
      onError={() => setImage({ key: requestKey, url: null, failed: true, loaded: false })}
      className={`h-full w-full object-cover transition-opacity duration-150 ${current.loaded ? 'opacity-100' : 'opacity-0'}`}
    />}
  </span>;

  return <>
    {preview ? <button type="button" onClick={() => current.loaded && setOpen(true)} disabled={!current.loaded} aria-label={`Ampliar evidencia: ${alt}`} className="group relative block w-full cursor-zoom-in overflow-hidden text-left disabled:cursor-default">
      {thumbnail}
      {current.loaded && <span className="absolute right-2 top-2 rounded-md bg-[#10213A]/80 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Expand size={15} /></span>}
    </button> : thumbnail}
    {preview && open && current.url && createPortal(<div role="dialog" aria-modal="true" aria-label={`Vista ampliada: ${alt}`} className="fixed inset-0 z-[10050] flex items-center justify-center bg-[#07111F]/90 p-3 sm:p-8" onClick={() => setOpen(false)}>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar vista ampliada" className="absolute right-4 top-4 rounded-full border border-white/30 bg-black/40 p-2 text-white hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X size={22} /></button>
      <figure className="flex max-h-full max-w-6xl flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
        <img src={current.url} alt={alt} className="max-h-[calc(100vh-7rem)] max-w-full rounded-lg object-contain shadow-2xl" />
        <figcaption className="max-w-3xl text-center text-sm font-semibold text-white">{alt}</figcaption>
      </figure>
    </div>, document.body)}
  </>;
}
