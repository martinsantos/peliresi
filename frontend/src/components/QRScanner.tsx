import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    QrCode,
    Camera,
    X,
    AlertTriangle,
    Loader2,
    FileText,
    CheckCircle
} from 'lucide-react';
import './QRScanner.css';

interface QRScannerProps {
    onClose: () => void;
    onScanSuccess?: (manifiestoId: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onClose, onScanSuccess }) => {
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultado, setResultado] = useState<string | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, []);

    const startCamera = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 640, height: 480 }
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCameraActive(true);
                setScanning(true);

                // Iniciar escaneo periódico
                requestAnimationFrame(scanQR);
            }
        } catch (err: any) {
            if (err.name === 'NotAllowedError') {
                setError('Permiso de cámara denegado. Por favor, permite el acceso a la cámara.');
            } else if (err.name === 'NotFoundError') {
                setError('No se encontró ninguna cámara en el dispositivo.');
            } else {
                setError('Error al acceder a la cámara: ' + err.message);
            }
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
        setScanning(false);
    };

    const scanQR = () => {
        if (!scanning || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
                // Obtener datos de la imagen
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                // Nota: En producción usaríamos una librería como jsQR
                // Por ahora simulamos la detección
                const simulatedScan = checkForQRPattern(imageData);

                if (simulatedScan) {
                    handleScanResult(simulatedScan);
                    return;
                }
            } catch (err) {
                console.error('Error scanning:', err);
            }
        }

        if (scanning) {
            requestAnimationFrame(scanQR);
        }
    };

    // Simula la detección de QR - en producción usar jsQR
    const checkForQRPattern = (_imageData: ImageData): string | null => {
        // Esta es una simulación. En producción:
        // import jsQR from 'jsqr';
        // const code = jsQR(imageData.data, imageData.width, imageData.height);
        // return code?.data || null;
        return null;
    };

    const handleScanResult = (data: string) => {
        setScanning(false);
        stopCamera();

        // El QR contiene datos del manifiesto
        try {
            const qrData = JSON.parse(data);
            if (qrData.manifiestoId) {
                setResultado(qrData.manifiestoId);
                if (onScanSuccess) {
                    onScanSuccess(qrData.manifiestoId);
                }
            }
        } catch {
            // Si no es JSON, asume que es directamente el ID
            if (data.startsWith('MAN-') || data.length === 25) {
                setResultado(data);
                if (onScanSuccess) {
                    onScanSuccess(data);
                }
            } else {
                setError('QR no válido. No contiene datos de manifiesto.');
            }
        }
    };

    const irAlManifiesto = () => {
        if (resultado) {
            navigate(`/manifiestos/${resultado}`);
            onClose();
        }
    };

    // Entrada manual
    const [manualInput, setManualInput] = useState('');

    const buscarManual = () => {
        if (manualInput.trim()) {
            navigate(`/manifiestos/${manualInput.trim()}`);
            onClose();
        }
    };

    return (
        <div className="qr-scanner-overlay">
            <div className="qr-scanner-modal">
                <div className="scanner-header">
                    <h3>
                        <QrCode size={22} />
                        Escanear QR de Manifiesto
                    </h3>
                    <button className="btn-close" onClick={onClose}>
                        <X size={22} />
                    </button>
                </div>

                <div className="scanner-body">
                    {error && (
                        <div className="scanner-error">
                            <AlertTriangle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {resultado ? (
                        <div className="scan-success">
                            <CheckCircle size={48} />
                            <h4>¡QR Detectado!</h4>
                            <p>Manifiesto encontrado</p>
                            <span className="manifiesto-id">{resultado}</span>
                            <button className="btn btn-primary" onClick={irAlManifiesto}>
                                <FileText size={18} />
                                Ver Manifiesto
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="camera-container">
                                {cameraActive ? (
                                    <>
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                        />
                                        <canvas ref={canvasRef} hidden />
                                        <div className="scan-frame">
                                            <div className="corner tl" />
                                            <div className="corner tr" />
                                            <div className="corner bl" />
                                            <div className="corner br" />
                                            <div className="scan-line" />
                                        </div>
                                        {scanning && (
                                            <div className="scanning-indicator">
                                                <Loader2 size={16} className="spin" />
                                                Escaneando...
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="camera-placeholder">
                                        <Camera size={48} />
                                        <p>Presiona el botón para activar la cámara</p>
                                    </div>
                                )}
                            </div>

                            <div className="scanner-actions">
                                {!cameraActive ? (
                                    <button className="btn btn-primary" onClick={startCamera}>
                                        <Camera size={18} />
                                        Activar Cámara
                                    </button>
                                ) : (
                                    <button className="btn btn-secondary" onClick={stopCamera}>
                                        <X size={18} />
                                        Detener
                                    </button>
                                )}
                            </div>

                            <div className="manual-input-section">
                                <div className="divider">
                                    <span>o ingresa el número manualmente</span>
                                </div>
                                <div className="manual-input-group">
                                    <input
                                        type="text"
                                        placeholder="Número de manifiesto o ID"
                                        value={manualInput}
                                        onChange={(e) => setManualInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && buscarManual()}
                                    />
                                    <button className="btn btn-primary" onClick={buscarManual}>
                                        Buscar
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QRScanner;
