/**
 * SITREP v6 - QR Scanner Component
 * ==================================
 * Real camera-based QR code scanner using jsQR library.
 * Uses getUserMedia API for camera access with front/back toggle.
 *
 * NOTE: requires `jsQR` package. Install with:
 *   npm install jsqr
 *   npm install -D @types/jsqr   (if needed, or the lib ships its own types)
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  X,
  SwitchCamera,
  Flashlight,
  Camera,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from './ui/ButtonV2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QRScannerProps {
  /** Called when a QR code is successfully decoded */
  onScan: (data: string) => void;
  /** Called when the user dismisses the scanner */
  onClose: () => void;
  /** Optional title shown in the header */
  title?: string;
}

type CameraFacing = 'environment' | 'user';
type ScannerStatus = 'initializing' | 'scanning' | 'denied' | 'error' | 'no-camera';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onClose,
  title = 'Escanear QR',
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  // State
  const [status, setStatus] = useState<ScannerStatus>('initializing');
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scanLineY, setScanLineY] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  // -----------------------------------------------------------
  // Stop any running stream
  // -----------------------------------------------------------
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  // -----------------------------------------------------------
  // Start camera
  // -----------------------------------------------------------
  const startCamera = useCallback(
    async (facingMode: CameraFacing) => {
      stopStream();
      setStatus('initializing');

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        // Check torch capability
        const videoTrack = stream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        setTorchSupported(!!capabilities?.torch);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('scanning');
        }
      } catch (err: unknown) {
        const error = err as DOMException;
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setStatus('denied');
          setErrorMessage('Se requiere acceso a la camara para escanear codigos QR.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          setStatus('no-camera');
          setErrorMessage('No se detecto ninguna camara en este dispositivo.');
        } else {
          setStatus('error');
          setErrorMessage(error.message || 'Error al acceder a la camara.');
        }
      }
    },
    [stopStream],
  );

  // -----------------------------------------------------------
  // QR scanning loop
  // -----------------------------------------------------------
  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      // Successfully decoded
      stopStream();
      onScan(code.data);
      return; // stop the loop
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopStream]);

  // -----------------------------------------------------------
  // Kick off scanning when status changes to "scanning"
  // -----------------------------------------------------------
  useEffect(() => {
    if (status === 'scanning') {
      animFrameRef.current = requestAnimationFrame(scanFrame);
    }
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [status, scanFrame]);

  // -----------------------------------------------------------
  // Initial mount: start camera
  // -----------------------------------------------------------
  useEffect(() => {
    startCamera(facing);
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------
  // Animate the scanning line
  // -----------------------------------------------------------
  useEffect(() => {
    if (status !== 'scanning') return;
    let direction = 1;
    let y = 0;
    const interval = setInterval(() => {
      y += direction * 2;
      if (y >= 100) direction = -1;
      if (y <= 0) direction = 1;
      setScanLineY(y);
    }, 20);
    return () => clearInterval(interval);
  }, [status]);

  // -----------------------------------------------------------
  // Toggle camera facing
  // -----------------------------------------------------------
  const toggleCamera = () => {
    const newFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(newFacing);
    startCamera(newFacing);
  };

  // -----------------------------------------------------------
  // Toggle torch
  // -----------------------------------------------------------
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const newVal = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: newVal }] } as unknown as MediaTrackConstraints);
      setTorchOn(newVal);
    } catch {
      // torch not supported or failed
    }
  };

  // -----------------------------------------------------------
  // Retry after error
  // -----------------------------------------------------------
  const handleRetry = () => {
    setErrorMessage('');
    startCamera(facing);
  };

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900">
      {/* ---- Header ---- */}
      <header className="flex items-center justify-between px-4 py-3 bg-neutral-900/90 backdrop-blur-sm z-20">
        <button
          onClick={() => {
            stopStream();
            onClose();
          }}
          className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          aria-label="Cerrar escaner"
        >
          <X size={24} />
        </button>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <div className="w-10" /> {/* spacer */}
      </header>

      {/* ---- Camera / Status Area ---- */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {/* Video element (hidden behind canvas overlay logic but visually present) */}
        {(status === 'scanning' || status === 'initializing') && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        )}

        {/* Hidden canvas for QR decoding */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Semi-transparent overlay with cutout */}
        {status === 'scanning' && (
          <div className="absolute inset-0 z-10 pointer-events-none">
            {/* Top overlay */}
            <div className="absolute top-0 left-0 right-0 bg-black/50" style={{ height: 'calc(50% - 144px)' }} />
            {/* Bottom overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-black/50" style={{ height: 'calc(50% - 144px)' }} />
            {/* Left overlay */}
            <div
              className="absolute bg-black/50"
              style={{
                top: 'calc(50% - 144px)',
                bottom: 'calc(50% - 144px)',
                left: 0,
                width: 'calc(50% - 144px)',
              }}
            />
            {/* Right overlay */}
            <div
              className="absolute bg-black/50"
              style={{
                top: 'calc(50% - 144px)',
                bottom: 'calc(50% - 144px)',
                right: 0,
                width: 'calc(50% - 144px)',
              }}
            />

            {/* Viewfinder frame (288x288) */}
            <div
              className="absolute"
              style={{
                top: 'calc(50% - 144px)',
                left: 'calc(50% - 144px)',
                width: '288px',
                height: '288px',
              }}
            >
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-10 h-10 border-l-4 border-t-4 border-primary-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-10 h-10 border-r-4 border-t-4 border-primary-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-l-4 border-b-4 border-primary-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-r-4 border-b-4 border-primary-400 rounded-br-lg" />

              {/* Animated scan line */}
              <div
                className="absolute left-2 right-2 h-0.5 bg-primary-400 shadow-[0_0_12px_rgba(13,138,79,0.8)] transition-none"
                style={{ top: `${scanLineY}%` }}
              />
            </div>
          </div>
        )}

        {/* Initializing state */}
        {status === 'initializing' && (
          <div className="relative z-20 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
            <p className="text-white/80 text-sm">Iniciando camara...</p>
          </div>
        )}

        {/* Permission denied */}
        {status === 'denied' && (
          <div className="relative z-20 flex flex-col items-center gap-4 px-8 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
              <AlertCircle size={32} className="text-amber-400" />
            </div>
            <h2 className="text-white text-lg font-semibold">Acceso a camara denegado</h2>
            <p className="text-white/60 text-sm max-w-xs">{errorMessage}</p>
            <p className="text-white/40 text-xs max-w-xs">
              Habilita el permiso de camara en la configuracion de tu navegador y vuelve a intentar.
            </p>
            <Button variant="primary" onClick={handleRetry} leftIcon={<RefreshCw size={18} />}>
              Reintentar
            </Button>
          </div>
        )}

        {/* No camera found */}
        {status === 'no-camera' && (
          <div className="relative z-20 flex flex-col items-center gap-4 px-8 text-center">
            <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center">
              <Camera size={32} className="text-neutral-400" />
            </div>
            <h2 className="text-white text-lg font-semibold">Camara no disponible</h2>
            <p className="text-white/60 text-sm max-w-xs">{errorMessage}</p>
            <Button
              variant="outline"
              onClick={() => {
                stopStream();
                onClose();
              }}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Volver
            </Button>
          </div>
        )}

        {/* Generic error */}
        {status === 'error' && (
          <div className="relative z-20 flex flex-col items-center gap-4 px-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertCircle size={32} className="text-red-400" />
            </div>
            <h2 className="text-white text-lg font-semibold">Error de camara</h2>
            <p className="text-white/60 text-sm max-w-xs">{errorMessage}</p>
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleRetry} leftIcon={<RefreshCw size={18} />}>
                Reintentar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  stopStream();
                  onClose();
                }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Instructions text (only when scanning) */}
        {status === 'scanning' && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-white/70 text-sm px-8 z-20">
            Centra el codigo QR dentro del marco para escanearlo
          </p>
        )}
      </div>

      {/* ---- Controls bar ---- */}
      {status === 'scanning' && (
        <div className="px-6 py-5 bg-neutral-900/90 backdrop-blur-sm z-20">
          <div className="flex items-center justify-center gap-8">
            {/* Torch toggle */}
            <button
              onClick={toggleTorch}
              disabled={!torchSupported}
              className={[
                'p-4 rounded-full transition-colors',
                torchOn ? 'bg-primary-500 text-white' : 'bg-white/10 text-white',
                !torchSupported && 'opacity-40 cursor-not-allowed',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={torchOn ? 'Apagar linterna' : 'Encender linterna'}
            >
              <Flashlight size={24} />
            </button>

            {/* Camera switch */}
            <button
              onClick={toggleCamera}
              className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="Cambiar camara"
            >
              <SwitchCamera size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
