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
  const [image, setImage] = useState<{ key: string; url: string | null; failed: boolean }>({ key: '', url: null, failed: false });
  const current = image.key === requestKey ? image : { key: requestKey, url: null, failed: false };
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    inspeccionService.evidenceObjectUrl(inspectionId, evidenceId).then((next) => {
      objectUrl = next;
      if (active) setImage({ key: requestKey, url: next, failed: false });
      else URL.revokeObjectURL(next);
    }).catch(() => {
      if (active) setImage({ key: requestKey, url: null, failed: true });
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, evidenceId, requestKey]);

  if (!current.url) return <div role="img" aria-label={current.failed ? `Miniatura no disponible: ${alt}` : `Cargando miniatura: ${alt}`} className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className}`}><ImageIcon size={24} /></div>;
  return <img src={current.url} alt={alt} loading="lazy" decoding="async" onError={() => setImage({ key: requestKey, url: null, failed: true })} className={className} />;
}
