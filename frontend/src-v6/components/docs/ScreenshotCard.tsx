/**
 * ScreenshotCard — Tarjeta de captura de pantalla para documentación
 * ==================================================================
 * Muestra una imagen de screenshot con caption, badge de rol y badge de plataforma.
 */

import React, { useState } from 'react';

type Role = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'TODOS';
type Platform = 'desktop' | 'mobile' | 'ambos';

interface ScreenshotCardProps {
  src: string;
  caption: string;
  role?: Role;
  platform?: Platform;
  alt?: string;
}

const roleBadge: Record<Role, { label: string; className: string }> = {
  ADMIN:         { label: 'Admin',         className: 'bg-blue-100 text-blue-800' },
  GENERADOR:     { label: 'Generador',     className: 'bg-purple-100 text-purple-800' },
  TRANSPORTISTA: { label: 'Transportista', className: 'bg-orange-100 text-orange-800' },
  OPERADOR:      { label: 'Operador',      className: 'bg-green-100 text-green-800' },
  TODOS:         { label: 'Todos',         className: 'bg-neutral-100 text-neutral-700' },
};

const platformBadge: Record<Platform, { label: string; className: string }> = {
  desktop: { label: 'Desktop', className: 'bg-slate-100 text-slate-700' },
  mobile:  { label: 'Mobile',  className: 'bg-indigo-100 text-indigo-700' },
  ambos:   { label: 'Desktop + Mobile', className: 'bg-teal-100 text-teal-700' },
};

const ScreenshotCard: React.FC<ScreenshotCardProps> = ({
  src,
  caption,
  role = 'TODOS',
  platform = 'desktop',
  alt,
}) => {
  const [lightbox, setLightbox] = useState(false);

  return (
    <>
      <div
        className="group border border-neutral-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-zoom-in"
        onClick={() => setLightbox(true)}
      >
        <div className="bg-neutral-100 aspect-video flex items-center justify-center overflow-hidden">
          <img
            src={src}
            alt={alt ?? caption}
            className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform duration-300"
            loading="lazy"
          />
        </div>
        <div className="p-3 bg-white">
          <p className="text-sm font-medium text-neutral-800 mb-2">{caption}</p>
          <div className="flex gap-1.5 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge[role].className}`}>
              {roleBadge[role].label}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${platformBadge[platform].className}`}>
              {platformBadge[platform].label}
            </span>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightbox(false)}
        >
          <img
            src={src}
            alt={alt ?? caption}
            className="max-w-full max-h-full rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-2xl bg-black/40 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/60"
            onClick={() => setLightbox(false)}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
};

export default ScreenshotCard;
