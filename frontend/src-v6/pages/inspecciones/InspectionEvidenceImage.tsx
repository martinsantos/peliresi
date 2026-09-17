import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { inspeccionService } from '../../services/inspeccion.service';

export function InspectionEvidenceImage({ inspectionId, evidenceId, alt, className = '' }: {
  inspectionId: string;
  evidenceId: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    inspeccionService.evidenceObjectUrl(inspectionId, evidenceId).then((next) => {
      objectUrl = next;
      if (active) setUrl(next);
      else URL.revokeObjectURL(next);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, evidenceId]);

  if (!url) return <div role="img" aria-label={failed ? `Miniatura no disponible: ${alt}` : `Cargando miniatura: ${alt}`} className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className}`}><ImageIcon size={24} /></div>;
  return <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => { setFailed(true); setUrl(null); }} className={className} />;
}
