/**
 * SITREP v6 - Install PWA Button
 * ===============================
 * Boton compacto para instalar la app como PWA.
 * Muestra instrucciones especificas en iOS Safari.
 */

import React, { useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const InstallPWAButton: React.FC = () => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showIOSTip, setShowIOSTip] = useState(false);

  // Nothing to show if already installed
  if (isInstalled) return null;

  // Nothing to show if not installable and not iOS
  if (!canInstall && !isIOS) return null;

  // --- iOS: show instructions tooltip ---
  if (isIOS) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowIOSTip((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors w-full"
        >
          <Download size={18} />
          <span className="flex-1 text-left">Instalar App</span>
        </button>

        {showIOSTip && (
          <div className="absolute bottom-full left-0 right-0 mb-2 p-4 bg-white rounded-xl shadow-4 border border-neutral-100 z-50 animate-scale-in">
            <div className="flex items-start justify-between mb-2">
              <p className="font-semibold text-neutral-900 text-sm">Instalar en iPhone/iPad</p>
              <button
                onClick={() => setShowIOSTip(false)}
                className="p-1 text-neutral-400 hover:text-neutral-600 rounded"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 text-sm text-neutral-600">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold shrink-0">1</span>
                <p>
                  Toca el icono <Share2 size={14} className="inline text-blue-500 mx-0.5" /> <strong>Compartir</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold shrink-0">2</span>
                <p>Selecciona <strong>"Agregar a pantalla de inicio"</strong></p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-600 text-xs font-bold shrink-0">3</span>
                <p>Toca <strong>"Agregar"</strong></p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Android / Desktop: native prompt ---
  return (
    <button
      onClick={promptInstall}
      className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 rounded-xl text-sm font-medium hover:bg-primary-100 transition-colors w-full"
    >
      <Download size={18} />
      <span className="flex-1 text-left">Instalar App</span>
    </button>
  );
};

export default InstallPWAButton;
