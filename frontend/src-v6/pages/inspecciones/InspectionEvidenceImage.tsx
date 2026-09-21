import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { inspeccionService } from '../../services/inspeccion.service';

export function InspectionEvidenceImage({ inspectionId, evidenceId, alt, className = '' }: {
  inspectionId: string;
  evidenceId: string;
  alt: string;
  className?: string;
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

  return <span className={`relative block overflow-hidden bg-neutral-100 text-neutral-400 ${className}`}>
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
}
