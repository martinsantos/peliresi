/**
 * SITREP v6 - Escaner QR Page
 * ============================
 * Página para escanear códigos QR de manifiestos
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, 
  X, 
  Flashlight, 
  Image as ImageIcon, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { CardContent } from '../../components/ui/CardV2';

const EscanerQRPage: React.FC = () => {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [flashlight, setFlashlight] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);

  // Simular escaneo después de 3 segundos
  useEffect(() => {
    if (isScanning) {
      const timer = setTimeout(() => {
        const mockResults = [
          'M-2025-0089',
          'M-2025-0090',
          'M-2025-0091',
          'INVALID-CODE',
        ];
        const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
        
        setScanResult(randomResult);
        setIsScanning(false);
        
        if (randomResult === 'INVALID-CODE') {
          setShowError(true);
        } else {
          setShowSuccess(true);
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isScanning]);

  const handleRetry = () => {
    setIsScanning(true);
    setScanResult(null);
    setShowSuccess(false);
    setShowError(false);
  };

  const handleViewManifiesto = () => {
    const isMobile = window.location.pathname.includes('/mobile');
    navigate(isMobile ? `/mobile/manifiestos/${scanResult}` : `/manifiestos/${scanResult}`);
  };

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-neutral-900/90 backdrop-blur z-10">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
        <h1 className="text-lg font-semibold text-white">Escanear QR</h1>
        <div className="w-10" />
      </header>

      {/* Scanner Area */}
      <div className="flex-1 relative flex items-center justify-center">
        {/* Camera Viewfinder */}
        <div className="relative w-72 h-72">
          {/* Corner markers */}
          <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-primary-500" />
          <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-primary-500" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-primary-500" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-primary-500" />

          {/* Scanning animation */}
          {isScanning && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary-500 shadow-[0_0_10px_rgba(13,138,79,0.8)] animate-scan" />
            </div>
          )}

          {/* Center icon */}
          {!isScanning && !showSuccess && !showError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <QrCode size={64} className="text-white/30" />
            </div>
          )}

          {/* Success state */}
          {showSuccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-success-500/20 rounded-lg">
              <div className="text-center">
                <div className="w-16 h-16 bg-success-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <p className="text-white font-medium">{scanResult}</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {showError && (
            <div className="absolute inset-0 flex items-center justify-center bg-error-500/20 rounded-lg">
              <div className="text-center">
                <div className="w-16 h-16 bg-error-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <AlertCircle size={32} className="text-white" />
                </div>
                <p className="text-white font-medium">Código no válido</p>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <p className="absolute bottom-32 left-0 right-0 text-center text-white/70 text-sm px-8">
          {isScanning 
            ? 'Centra el código QR dentro del marco para escanearlo'
            : showSuccess 
              ? 'Manifiesto encontrado'
              : showError
                ? 'No se pudo reconocer el código'
                : 'Escaneo completado'
          }
        </p>
      </div>

      {/* Controls */}
      <div className="p-6 bg-neutral-900/90 backdrop-blur">
        {isScanning ? (
          <div className="flex items-center justify-center gap-8">
            <button 
              onClick={() => setFlashlight(!flashlight)}
              className={`p-4 rounded-full transition-colors ${
                flashlight ? 'bg-primary-500 text-white' : 'bg-white/10 text-white'
              }`}
            >
              <Flashlight size={24} />
            </button>
            <button className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
              <ImageIcon size={24} />
            </button>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {showSuccess ? (
              <>
                <Button 
                  fullWidth 
                  size="lg"
                  onClick={handleViewManifiesto}
                >
                  Ver Manifiesto
                </Button>
                <Button 
                  variant="outline" 
                  fullWidth
                  onClick={handleRetry}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Escanear otro
                </Button>
              </>
            ) : (
              <>
                <Button 
                  fullWidth 
                  size="lg"
                  onClick={handleRetry}
                >
                  Intentar de nuevo
                </Button>
                <Button 
                  variant="outline" 
                  fullWidth
                  onClick={() => navigate(-1)}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancelar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* CSS for scan animation */}
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(288px); }
          100% { transform: translateY(0); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default EscanerQRPage;
