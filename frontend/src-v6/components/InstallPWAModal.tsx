/**
 * SITREP v6 - Install PWA Modal
 * ==============================
 * Banner/modal que aparece tras un tiempo de uso para sugerir
 * la instalacion de la app. Recuerda el descarte por 7 dias.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  X,
  Zap,
  WifiOff,
  BellRing,
  Share2,
  Smartphone,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISS_KEY = 'sitrep_pwa_dismiss';
const DISMISS_DAYS = 7;
const SHOW_DELAY_MS = 45_000; // 45 seconds of usage before showing

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // storage full or unavailable
  }
}

export const InstallPWAModal: React.FC = () => {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [visible, setVisible] = useState(false);

  // Should we even consider showing?
  const shouldShow = !isInstalled && (canInstall || isIOS);

  useEffect(() => {
    if (!shouldShow || isDismissed()) return;

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  const handleDismiss = () => {
    setDismissed();
    setVisible(false);
  };

  const handleInstall = async () => {
    await promptInstall();
    setVisible(false);
  };

  if (!visible) return null;

  const benefits = [
    { icon: Zap, text: 'Acceso rapido desde tu pantalla de inicio' },
    { icon: WifiOff, text: 'Funciona sin conexion a internet' },
    { icon: BellRing, text: 'Recibe notificaciones en tiempo real' },
  ];

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={handleDismiss}
      />

      {/* Modal panel */}
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-2xl rounded-t-2xl shadow-4 z-10 animate-slide-up safe-area-bottom overflow-hidden">
        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-600 z-10"
          aria-label="Cerrar"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="pt-6 pb-4 px-6 text-center">
          <div className="w-14 h-14 mx-auto mb-3 bg-primary-100 rounded-2xl flex items-center justify-center">
            {isIOS ? <Smartphone size={28} className="text-primary-600" /> : <Download size={28} className="text-primary-600" />}
          </div>
          <h3 className="text-lg font-bold text-neutral-900">
            {isIOS ? 'Agrega SITREP a tu pantalla' : 'Instala SITREP'}
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            Obtene la mejor experiencia instalando la app en tu dispositivo
          </p>
        </div>

        {/* Benefits */}
        <div className="px-6 space-y-3 pb-4">
          {benefits.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-primary-600" />
              </div>
              <p className="text-sm text-neutral-700">{text}</p>
            </div>
          ))}
        </div>

        {/* iOS instructions */}
        {isIOS && (
          <div className="mx-6 mb-4 p-3 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-800 font-medium mb-1">Como instalar:</p>
            <p className="text-sm text-blue-700">
              Toca <Share2 size={13} className="inline mx-0.5" /> <strong>Compartir</strong> y luego{' '}
              <strong>"Agregar a pantalla de inicio"</strong>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 pt-2 flex gap-3">
          <button
            onClick={handleDismiss}
            className="flex-1 px-4 py-3 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
          >
            Ahora no
          </button>
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Instalar
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default InstallPWAModal;
