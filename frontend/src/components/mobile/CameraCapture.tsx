/**
 * CameraCapture - Componente de captura de foto con cámara real
 *
 * Implementa CU-T03, CU-T06, CU-O03 para evidencia fotográfica
 * Usa navigator.mediaDevices.getUserMedia() para acceso a cámara
 *
 * v7.0.0 - Captura real de cámara
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertTriangle, Image } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel?: () => void;
  maxWidth?: number;
  quality?: number;
  label?: string;
}

type CameraState = 'idle' | 'requesting' | 'streaming' | 'captured' | 'error';

const CameraCapture: React.FC<CameraCaptureProps> = ({
  onCapture,
  onCancel,
  maxWidth = 1280,
  quality = 0.8,
  label = 'Capturar Foto'
}) => {
  const [state, setState] = useState<CameraState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Limpiar stream al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setState('requesting');
    setErrorMessage('');

    try {
      // Verificar soporte de API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      // Solicitar permisos y stream
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: maxWidth },
          height: { ideal: Math.round(maxWidth * 0.75) }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setState('streaming');
      }
    } catch (error: any) {
      console.error('[CameraCapture] Error:', error);
      stopCamera();

      // Mensajes de error amigables
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Permiso de cámara denegado. Por favor habilita el acceso en la configuración del navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setErrorMessage('No se encontró ninguna cámara en este dispositivo.');
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        setErrorMessage('La cámara está siendo usada por otra aplicación.');
      } else if (error.name === 'OverconstrainedError') {
        setErrorMessage('La cámara no soporta la resolución solicitada.');
      } else {
        setErrorMessage(error.message || 'Error al acceder a la cámara');
      }

      setState('error');
    }
  }, [facingMode, maxWidth, stopCamera]);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Configurar canvas con dimensiones del video
    const aspectRatio = video.videoHeight / video.videoWidth;
    let width = Math.min(video.videoWidth, maxWidth);
    let height = Math.round(width * aspectRatio);

    canvas.width = width;
    canvas.height = height;

    // Dibujar frame del video en canvas
    context.drawImage(video, 0, 0, width, height);

    // Convertir a base64 JPEG
    const imageData = canvas.toDataURL('image/jpeg', quality);

    setCapturedImage(imageData);
    stopCamera();
    setState('captured');
  }, [maxWidth, quality, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
      setState('idle');
      setCapturedImage(null);
    }
  }, [capturedImage, onCapture]);

  const switchCamera = useCallback(() => {
    stopCamera();
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    // Reiniciar cámara con nueva facing mode
    setTimeout(() => startCamera(), 100);
  }, [stopCamera, startCamera]);

  const handleCancel = useCallback(() => {
    stopCamera();
    setCapturedImage(null);
    setState('idle');
    onCancel?.();
  }, [stopCamera, onCancel]);

  // Usar input file como fallback
  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Redimensionar si es necesario
        const aspectRatio = img.height / img.width;
        let width = Math.min(img.width, maxWidth);
        let height = Math.round(width * aspectRatio);

        canvas.width = width;
        canvas.height = height;
        context.drawImage(img, 0, 0, width, height);

        const imageData = canvas.toDataURL('image/jpeg', quality);
        setCapturedImage(imageData);
        setState('captured');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [maxWidth, quality]);

  return (
    <div className="camera-capture">
      {/* Canvas oculto para procesamiento */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Estado: Idle - Botón para iniciar */}
      {state === 'idle' && (
        <div className="camera-idle">
          <button
            type="button"
            className="btn-start-camera"
            onClick={startCamera}
          >
            <Camera size={24} />
            <span>{label}</span>
          </button>

          {/* Fallback: Input file para seleccionar de galería */}
          <label className="btn-gallery">
            <Image size={18} />
            <span>Galería</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {/* Estado: Requesting - Solicitando permisos */}
      {state === 'requesting' && (
        <div className="camera-requesting">
          <div className="spinner-camera" />
          <p>Solicitando acceso a la cámara...</p>
        </div>
      )}

      {/* Estado: Streaming - Vista previa de cámara */}
      {state === 'streaming' && (
        <div className="camera-preview">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="camera-video"
          />
          <div className="camera-controls">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleCancel}
              aria-label="Cancelar"
            >
              <X size={24} />
            </button>
            <button
              type="button"
              className="btn-capture"
              onClick={capturePhoto}
              aria-label="Capturar"
            >
              <div className="capture-ring" />
            </button>
            <button
              type="button"
              className="btn-switch"
              onClick={switchCamera}
              aria-label="Cambiar cámara"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Estado: Captured - Foto capturada */}
      {state === 'captured' && capturedImage && (
        <div className="camera-result">
          <img src={capturedImage} alt="Foto capturada" className="captured-image" />
          <div className="result-controls">
            <button
              type="button"
              className="btn-retake"
              onClick={retakePhoto}
            >
              <RefreshCw size={18} />
              <span>Repetir</span>
            </button>
            <button
              type="button"
              className="btn-confirm"
              onClick={confirmPhoto}
            >
              <Check size={18} />
              <span>Usar foto</span>
            </button>
          </div>
        </div>
      )}

      {/* Estado: Error */}
      {state === 'error' && (
        <div className="camera-error">
          <AlertTriangle size={32} />
          <p>{errorMessage}</p>
          <div className="error-actions">
            <button type="button" onClick={() => setState('idle')}>
              Volver
            </button>
            <label className="btn-gallery-fallback">
              <Image size={16} />
              <span>Usar galería</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      )}

      <style>{`
        .camera-capture {
          width: 100%;
        }

        .camera-idle {
          display: flex;
          gap: 12px;
        }

        .btn-start-camera {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          background: rgba(6, 182, 212, 0.1);
          border: 2px dashed rgba(6, 182, 212, 0.4);
          border-radius: 12px;
          color: #06b6d4;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-start-camera:hover {
          background: rgba(6, 182, 212, 0.15);
          border-color: #06b6d4;
        }

        .btn-start-camera:active {
          transform: scale(0.98);
        }

        .btn-gallery {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.6);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-gallery:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .camera-requesting {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          gap: 16px;
          color: rgba(255, 255, 255, 0.6);
        }

        .spinner-camera {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(6, 182, 212, 0.2);
          border-top-color: #06b6d4;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .camera-preview {
          position: relative;
          width: 100%;
          border-radius: 12px;
          overflow: hidden;
          background: #000;
        }

        .camera-video {
          width: 100%;
          height: auto;
          display: block;
          max-height: 60vh;
          object-fit: cover;
        }

        .camera-controls {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 40px;
          padding: 20px;
          background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
        }

        .btn-cancel, .btn-switch {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-cancel:active, .btn-switch:active {
          transform: scale(0.9);
          background: rgba(255, 255, 255, 0.25);
        }

        .btn-capture {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: transparent;
          border: 4px solid #fff;
          padding: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-capture:active {
          transform: scale(0.95);
        }

        .capture-ring {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.15s ease;
        }

        .btn-capture:active .capture-ring {
          transform: scale(0.9);
        }

        .camera-result {
          width: 100%;
        }

        .captured-image {
          width: 100%;
          height: auto;
          border-radius: 12px;
          display: block;
          max-height: 50vh;
          object-fit: contain;
          background: #111;
        }

        .result-controls {
          display: flex;
          gap: 12px;
          margin-top: 12px;
        }

        .btn-retake, .btn-confirm {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 14px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-retake {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.15);
        }

        .btn-retake:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
        }

        .btn-confirm {
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
        }

        .btn-confirm:hover {
          background: linear-gradient(135deg, #059669, #047857);
        }

        .btn-confirm:active, .btn-retake:active {
          transform: scale(0.98);
        }

        .camera-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 30px 20px;
          gap: 12px;
          text-align: center;
          color: #f87171;
        }

        .camera-error p {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          line-height: 1.5;
          margin: 0;
        }

        .error-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .error-actions button, .btn-gallery-fallback {
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .error-actions button:hover, .btn-gallery-fallback:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
      `}</style>
    </div>
  );
};

export default CameraCapture;
