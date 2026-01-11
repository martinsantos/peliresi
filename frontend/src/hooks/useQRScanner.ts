/**
 * useQRScanner - Hook for QR code scanning with camera
 * Extracted from MobileApp.tsx (lines 69-78, 295-365)
 * Handles camera stream, QR detection, and cleanup
 *
 * v2.0 - Enhanced with QR parsing for manifiesto detection
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';

// ===== QR PARSING TYPES =====
export type QRType = 'manifiesto' | 'verify_url' | 'unknown';

export interface QRScanResult {
    raw: string;
    type: QRType;
    manifiestoId?: string;
    verifyUrl?: string;
}

/**
 * Parse QR code data to extract manifiesto information
 * Supports multiple QR formats:
 * - Direct verify URL: https://sitrep.../verify/MANIFIESTO_ID
 * - Manifiesto path: /manifiestos/MANIFIESTO_ID
 * - Direct ID: M-2024-001 or cuid format
 */
export function parseQRData(data: string): QRScanResult {
    const result: QRScanResult = { raw: data, type: 'unknown' };

    // Pattern 1: Verify URL - https://sitrep.ultimamilla.com.ar/verify/MANIFIESTO_ID
    const verifyMatch = data.match(/verify[\/=]([a-zA-Z0-9_-]+)/i);
    if (verifyMatch) {
        result.type = 'verify_url';
        result.manifiestoId = verifyMatch[1];
        result.verifyUrl = data.startsWith('http') ? data : undefined;
        return result;
    }

    // Pattern 2: Manifiesto path - /manifiestos/MANIFIESTO_ID or manifiestos/MANIFIESTO_ID
    const manifiestoPathMatch = data.match(/manifiestos?[\/=]([a-zA-Z0-9_-]+)/i);
    if (manifiestoPathMatch) {
        result.type = 'manifiesto';
        result.manifiestoId = manifiestoPathMatch[1];
        return result;
    }

    // Pattern 3: Direct manifiesto number format - M-2024-001
    const numeroMatch = data.match(/^M-\d{4}-\d{3,}$/i);
    if (numeroMatch) {
        result.type = 'manifiesto';
        // For numero format, we'll need to search by numero, not ID
        result.manifiestoId = data;
        return result;
    }

    // Pattern 4: CUID format (used by Prisma) - starts with 'c' followed by alphanumeric
    const cuidMatch = data.match(/^c[a-z0-9]{24,}$/i);
    if (cuidMatch) {
        result.type = 'manifiesto';
        result.manifiestoId = data;
        return result;
    }

    // Pattern 5: Any URL with ID parameter
    const urlIdMatch = data.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (urlIdMatch) {
        result.type = 'manifiesto';
        result.manifiestoId = urlIdMatch[1];
        result.verifyUrl = data.startsWith('http') ? data : undefined;
        return result;
    }

    return result;
}

interface UseQRScannerOptions {
    onScan?: (data: string, parsed: QRScanResult) => void;
    onToast?: (message: string) => void;
    autoOpenUrl?: boolean; // Default false - let parent handle URL opening
}

interface UseQRScannerReturn {
    // State
    cameraActive: boolean;
    scannedQR: string | null;
    parsedQR: QRScanResult | null;

    // Refs for video/canvas elements
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;

    // Actions
    startCamera: () => Promise<void>;
    stopCamera: () => void;
    clearScannedQR: () => void;
}

export function useQRScanner({ onScan, onToast, autoOpenUrl = false }: UseQRScannerOptions = {}): UseQRScannerReturn {
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [scannedQR, setScannedQR] = useState<string | null>(null);
    const [parsedQR, setParsedQR] = useState<QRScanResult | null>(null);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scanningRef = useRef<boolean>(false);
    const scanStartTimeRef = useRef<number>(0);
    const SCAN_TIMEOUT_MS = 15000; // 15 seconds timeout

    const showToast = useCallback((msg: string) => {
        onToast?.(msg);
    }, [onToast]);

    // Scan QR from video frame
    const scanQRFromVideo = useCallback(() => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });
                
                if (code && code.data) {
                    console.log('✅ QR Code detected:', code.data);
                    scanningRef.current = false;

                    // Parse QR data to extract manifiesto info
                    const parsed = parseQRData(code.data);
                    console.log('📋 Parsed QR:', parsed);

                    // Haptic feedback (vibration)
                    if ('vibrate' in navigator) {
                        navigator.vibrate([100, 50, 100]);
                    }

                    // Audio feedback (short beep)
                    try {
                        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        const oscillator = audioCtx.createOscillator();
                        const gainNode = audioCtx.createGain();
                        oscillator.connect(gainNode);
                        gainNode.connect(audioCtx.destination);
                        oscillator.frequency.value = 880; // A5 note
                        oscillator.type = 'sine';
                        gainNode.gain.value = 0.3;
                        oscillator.start();
                        setTimeout(() => oscillator.stop(), 150);
                    } catch (e) {
                        console.log('Audio feedback not available');
                    }

                    setScannedQR(code.data);
                    setParsedQR(parsed);

                    // Stop camera after successful scan
                    if (cameraStream) {
                        cameraStream.getTracks().forEach(track => track.stop());
                        setCameraStream(null);
                    }
                    setCameraActive(false);

                    // Callback with scanned data AND parsed result
                    onScan?.(code.data, parsed);

                    // Show appropriate toast based on parsed type
                    if (parsed.type === 'manifiesto' || parsed.type === 'verify_url') {
                        showToast(`✅ Manifiesto detectado: ${parsed.manifiestoId}`);

                        // Only auto-open URL if explicitly enabled
                        if (autoOpenUrl && parsed.verifyUrl) {
                            window.open(parsed.verifyUrl, '_blank');
                        }
                    } else if (code.data.startsWith('http') && autoOpenUrl) {
                        window.open(code.data, '_blank');
                        showToast('✅ QR escaneado - Abriendo enlace');
                    } else {
                        showToast(`✅ QR: ${code.data}`);
                    }
                    return;
                }
            } catch (err) {
                console.error('Error scanning QR:', err);
            }
        }
        
        // Check for timeout
        if (scanningRef.current) {
            const elapsed = Date.now() - scanStartTimeRef.current;
            if (elapsed > SCAN_TIMEOUT_MS) {
                console.log('⏰ QR scan timeout after 15s');
                scanningRef.current = false;
                showToast('⏰ Tiempo agotado. Intente de nuevo o ingrese el código manualmente.');
                return;
            }
            requestAnimationFrame(scanQRFromVideo);
        }
    }, [cameraStream, onScan, showToast]);

    // Bind stream to video when camera becomes active
    useEffect(() => {
        if (cameraActive && cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(err => console.warn('Video play error:', err));
            videoRef.current.onloadedmetadata = () => {
                scanningRef.current = true;
                requestAnimationFrame(scanQRFromVideo);
            };
        }
    }, [cameraActive, cameraStream, scanQRFromVideo]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            scanningRef.current = false;
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [cameraStream]);

    const startCamera = useCallback(async () => {
        setScannedQR(null);
        setParsedQR(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment', width: 640, height: 480 }
            });
            setCameraStream(stream);
            setCameraActive(true);
            scanStartTimeRef.current = Date.now();
            showToast('📷 Cámara activada - Escaneando QR...');
        } catch (err: any) {
            console.error('❌ Camera error:', err);
            showToast('❌ No se pudo acceder a la cámara: ' + (err.message || 'Permiso denegado'));
        }
    }, [showToast]);

    const stopCamera = useCallback(() => {
        scanningRef.current = false;
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCameraActive(false);
    }, [cameraStream]);

    const clearScannedQR = useCallback(() => {
        setScannedQR(null);
        setParsedQR(null);
    }, []);

    return {
        cameraActive,
        scannedQR,
        parsedQR,
        videoRef,
        canvasRef,
        startCamera,
        stopCamera,
        clearScannedQR,
    };
}
