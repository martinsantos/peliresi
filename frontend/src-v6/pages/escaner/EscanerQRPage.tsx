/**
 * SITREP v6 - Escaner QR Page
 * ============================
 * Pagina para escanear codigos QR de manifiestos.
 * Uses the real camera-based QRScanner component with jsQR.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  AlertCircle,
  QrCode,
  ScanLine,
} from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { toast } from '../../components/ui/Toast';
import QRScanner from '../../components/QRScanner';
import { getCachedManifiestos } from '../../services/offline-sync';
import { useAuth } from '../../contexts/AuthContext';
import { parseQrPayload } from './qrParser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

const EscanerQRPage: React.FC = () => {
  const navigate = useNavigate();

  // "idle"       -> scanner is open
  // "success"    -> valid manifiesto detected
  // "error"      -> QR decoded but not a valid manifiesto
  const [phase, setPhase] = useState<'idle' | 'success' | 'error'>('idle');
  const [scanResult, setScanResult] = useState<{ kind: 'inspection' | 'manifiesto'; value: string } | null>(null);
  const [rawData, setRawData] = useState<string>('');

  // -----------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------

  const handleScan = (data: string) => {
    setRawData(data);
    const parsed = parseQrPayload(data);
    if (parsed) {
      setScanResult({ kind: parsed.kind, value: parsed.kind === 'inspection' ? parsed.token : parsed.id });
      setPhase('success');
    } else {
      setScanResult(null);
      setPhase('error');
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  const handleRetry = () => {
    setPhase('idle');
    setScanResult(null);
    setRawData('');
  };

  const { currentUser } = useAuth();

  const handleViewManifiesto = async () => {
    if (!scanResult) return;
    if (scanResult.kind === 'inspection') {
      navigate(`/verificar/inspecciones/${encodeURIComponent(scanResult.value)}`);
      return;
    }
    // Offline check: verify we have this manifiesto cached before navigating
    if (!navigator.onLine && currentUser?.id) {
      const cached = await getCachedManifiestos(currentUser.id);
      const found = cached.find(m => m.numero === scanResult.value || m.id === scanResult.value);
      if (!found) {
        toast.info('Sin conexión — Se verificará cuando haya conexión');
        // Save for later verification
        const pending = JSON.parse(localStorage.getItem('sitrep_pending_qr') || '[]');
        if (!pending.includes(scanResult.value)) pending.push(scanResult.value);
        localStorage.setItem('sitrep_pending_qr', JSON.stringify(pending));
        return;
      }
    }

    navigate(`/manifiestos/${scanResult.value}`);
  };

  // -----------------------------------------------------------
  // Render: active scanner
  // -----------------------------------------------------------
  if (phase === 'idle') {
    return <QRScanner onScan={handleScan} onClose={handleClose} title="Escanear QR" />;
  }

  // -----------------------------------------------------------
  // Render: result screen (success or error)
  // -----------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-neutral-900/90 backdrop-blur z-10">
        <button
          onClick={handleClose}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Cerrar"
        >
          <QrCode size={24} className="text-white/60" />
        </button>
        <h1 className="text-lg font-semibold text-white">Resultado del escaneo</h1>
        <div className="w-10" />
      </header>

      {/* Result area */}
      <div className="flex-1 flex items-center justify-center px-6">
        {phase === 'success' && scanResult && (
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-600/30">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <p className="text-white text-xl font-bold mb-1 break-all">{scanResult.kind === 'inspection' ? 'QR de inspección' : scanResult.value}</p>
            <p className="text-white/60 text-sm">{scanResult.kind === 'inspection' ? 'Código reconocido. Consultá SITREP para verificarlo.' : 'Manifiesto encontrado'}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="text-center animate-fade-in">
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-600/30">
              <AlertCircle size={40} className="text-white" />
            </div>
            <p className="text-white text-lg font-semibold mb-1">Codigo no valido</p>
            <p className="text-white/50 text-sm max-w-xs mx-auto break-all">
              {rawData.length > 120 ? rawData.slice(0, 120) + '...' : rawData}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-6 bg-neutral-900/90 backdrop-blur space-y-3">
        {phase === 'success' ? (
          <>
            <Button fullWidth size="lg" onClick={handleViewManifiesto}>
              {scanResult?.kind === 'inspection' ? 'Ver inspección' : 'Ver Manifiesto'}
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={handleRetry}
              className="border-white/20 text-white hover:bg-white/10"
              leftIcon={<ScanLine size={18} />}
            >
              Escanear otro
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth size="lg" onClick={handleRetry} leftIcon={<ScanLine size={18} />}>
              Intentar de nuevo
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={handleClose}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default EscanerQRPage;
