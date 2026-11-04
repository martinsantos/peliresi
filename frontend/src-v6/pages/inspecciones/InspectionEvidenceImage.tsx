import React, { useEffect, useState } from 'react';
import { Expand, Image as ImageIcon } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { inspeccionService } from '../../services/inspeccion.service';

export function InspectionEvidenceImage({ inspectionId, evidenceId, alt, className = '', preview = false }: {
  inspectionId: string;
  evidenceId: string;
  alt: string;
  className?: string;
  preview?: boolean;
}) {
  const requestKey = `${inspectionId}:${evidenceId}`;
  return <EvidenceImageLoader key={requestKey} inspectionId={inspectionId} evidenceId={evidenceId} alt={alt} className={className} preview={preview} />;
}

function EvidenceImageLoader({ inspectionId, evidenceId, alt, className, preview }: {
  inspectionId: string;
  evidenceId: string;
  alt: string;
  className: string;
  preview: boolean;
}) {
  const [image, setImage] = useState<{ url: string | null; failed: boolean; loaded: boolean }>({ url: null, failed: false, loaded: false });
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    inspeccionService.evidenceObjectUrl(inspectionId, evidenceId).then((next) => {
      objectUrl = next;
      if (active) setImage({ url: next, failed: false, loaded: false });
      else URL.revokeObjectURL(next);
    }).catch(() => {
      if (active) setImage({ url: null, failed: true, loaded: false });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, evidenceId]);

  const [open, setOpen] = useState(false);

  const thumbnail = <span className={`relative block overflow-hidden bg-neutral-100 text-neutral-400 ${className}`}>
    {(!image.url || !image.loaded) && <span role="img" aria-label={image.failed ? `Miniatura no disponible: ${alt}` : `Cargando miniatura: ${alt}`} className="absolute inset-0 flex items-center justify-center bg-neutral-100"><ImageIcon size={24} /></span>}
    {image.url && !image.failed && <img
      src={image.url}
      alt={alt}
      loading="eager"
      decoding="sync"
      data-loaded={image.loaded ? 'true' : 'false'}
      onLoad={() => setImage((value) => ({ ...value, loaded: true }))}
      onError={() => setImage({ url: null, failed: true, loaded: false })}
      className={`h-full w-full object-cover transition-opacity duration-150 ${image.loaded ? 'opacity-100' : 'opacity-0'}`}
    />}
  </span>;

  return <>
    {preview ? <button type="button" onClick={() => image.loaded && setOpen(true)} disabled={!image.loaded} aria-label={`Ampliar evidencia: ${alt}`} className="group relative block w-full cursor-zoom-in overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 disabled:cursor-default">
      {thumbnail}
      {image.loaded && <span className="absolute right-2 top-2 rounded-md bg-[#10213A]/80 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Expand size={15} /></span>}
    </button> : thumbnail}
    <Modal isOpen={Boolean(preview && open && image.url)} onClose={() => setOpen(false)} title="Vista ampliada" size="xl">
      {image.url && <figure className="flex min-w-0 flex-col items-center gap-3">
        <img src={image.url} alt={alt} className="max-h-[65dvh] max-w-full rounded-lg object-contain" />
        <figcaption className="max-w-full text-center text-sm font-semibold text-neutral-700 [overflow-wrap:anywhere]">{alt}</figcaption>
      </figure>}
    </Modal>
  </>;
}
