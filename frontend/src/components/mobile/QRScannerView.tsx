/**
 * QRScannerView - QR scanning screen component
 * Extracted from MobileApp.tsx 'escanear' case in renderContent
 * Full screen camera view for QR code scanning
 */

import React from 'react';
import { Camera, X, QrCode } from 'lucide-react';

interface QRScannerViewProps {
    cameraActive: boolean;
    scannedQR: string | null;
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    onStartCamera: () => void;
    onStopCamera: () => void;
    onBack: () => void;
}

const QRScannerView: React.FC<QRScannerViewProps> = ({
    cameraActive,
    scannedQR,
    videoRef,
    canvasRef,
    onStartCamera,
    onStopCamera,
    onBack,
}) => {
    return (
        <div className="qr-scanner-screen">
            <div className="scanner-header">
                <button className="back-btn" onClick={() => { onStopCamera(); onBack(); }}>
                    <X size={24} />
                </button>
                <h2>Escanear QR</h2>
            </div>

            {!cameraActive ? (
                <div className="scanner-placeholder">
                    <div className="scanner-icon">
                        <QrCode size={64} />
                    </div>
                    <p>Escanea el código QR del manifiesto para verificar su autenticidad</p>
                    <button className="start-scan-btn" onClick={onStartCamera}>
                        <Camera size={20} />
                        <span>Activar Cámara</span>
                    </button>
                    
                    {scannedQR && (
                        <div className="last-scan">
                            <strong>Último QR:</strong>
                            <code>{scannedQR}</code>
                        </div>
                    )}
                </div>
            ) : (
                <div className="camera-container">
                    <video
                        ref={videoRef}
                        className="camera-video"
                        playsInline
                        muted
                    />
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'none' }}
                    />
                    <div className="scan-overlay">
                        <div className="scan-frame">
                            <div className="corner tl"></div>
                            <div className="corner tr"></div>
                            <div className="corner bl"></div>
                            <div className="corner br"></div>
                            <div className="scan-line"></div>
                        </div>
                        <p className="scan-hint">Alinea el código QR dentro del marco</p>
                    </div>
                    <button className="stop-scan-btn" onClick={onStopCamera}>
                        <X size={20} />
                        <span>Cancelar</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default QRScannerView;
