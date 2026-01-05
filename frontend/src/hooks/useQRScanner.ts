/**
 * useQRScanner - Hook for QR code scanning with camera
 * Enhanced with visual feedback, vibration, timeout, and manual fallback
 *
 * Features:
 * - Visual overlay showing QR detection zone
 * - Vibration feedback on successful scan
 * - Optional sound confirmation
 * - Timeout with user notification
 * - Manual code input fallback
 * - Scan history for quick re-selection
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import jsQR from 'jsqr';

// Configuration
const SCAN_TIMEOUT_MS = 15000; // 15 seconds timeout
const SCAN_HISTORY_KEY = 'sitrep_qr_scan_history';
const MAX_HISTORY_ITEMS = 10;

// QR code pattern for validation
const SITREP_QR_PATTERN = /^https?:\/\/.*\/manifiesto\/([a-zA-Z0-9-]+)/;

interface UseQRScannerOptions {
    onScan?: (data: string) => void;
    onToast?: (message: string) => void;
    enableVibration?: boolean;
    enableSound?: boolean;
    autoOpenUrl?: boolean;
    timeoutMs?: number;
}

interface QRDetectionState {
    detecting: boolean;
    location: { x: number; y: number; width: number; height: number } | null;
}

interface ScanHistoryItem {
    code: string;
    timestamp: string;
    manifiestoId?: string;
}

interface UseQRScannerReturn {
    // State
    cameraActive: boolean;
    scannedQR: string | null;
    isScanning: boolean;
    scanProgress: number; // 0-100 for timeout progress
    detectionState: QRDetectionState;
    error: string | null;

    // History
    scanHistory: ScanHistoryItem[];

    // Refs for video/canvas elements
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;

    // Actions
    startCamera: () => Promise<void>;
    stopCamera: () => void;
    clearScannedQR: () => void;
    submitManualCode: (code: string) => void;
    clearHistory: () => void;
    selectFromHistory: (item: ScanHistoryItem) => void;
}

export function useQRScanner({
    onScan,
    onToast,
    enableVibration = true,
    enableSound = false,
    autoOpenUrl = false,
    timeoutMs = SCAN_TIMEOUT_MS
}: UseQRScannerOptions = {}): UseQRScannerReturn {
    const [cameraActive, setCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [scannedQR, setScannedQR] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [detectionState, setDetectionState] = useState<QRDetectionState>({
        detecting: false,
        location: null
    });
    const [error, setError] = useState<string | null>(null);
    const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scanningRef = useRef<boolean>(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);

    // Load scan history on mount
    useEffect(() => {
        try {
            const history = localStorage.getItem(SCAN_HISTORY_KEY);
            if (history) {
                setScanHistory(JSON.parse(history));
            }
        } catch {
            // Ignore parse errors
        }
    }, []);

    const showToast = useCallback((msg: string) => {
        onToast?.(msg);
    }, [onToast]);

    // Provide haptic feedback
    const triggerVibration = useCallback(() => {
        if (enableVibration && 'vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]); // Short-pause-short pattern
        }
    }, [enableVibration]);

    // Play success sound
    const playSuccessSound = useCallback(() => {
        if (enableSound) {
            try {
                // Create a simple beep using Web Audio API
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 880; // A5 note
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;

                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.15);
            } catch {
                // Audio not available
            }
        }
    }, [enableSound]);

    // Add to scan history
    const addToHistory = useCallback((code: string) => {
        const manifiestoMatch = code.match(SITREP_QR_PATTERN);
        const newItem: ScanHistoryItem = {
            code,
            timestamp: new Date().toISOString(),
            manifiestoId: manifiestoMatch ? manifiestoMatch[1] : undefined
        };

        setScanHistory(prev => {
            // Remove duplicate if exists
            const filtered = prev.filter(item => item.code !== code);
            const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);

            // Persist to localStorage
            try {
                localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
            } catch {
                // Storage full, ignore
            }

            return updated;
        });
    }, []);

    // Process a scanned/submitted code
    const processCode = useCallback((code: string, source: 'camera' | 'manual' | 'history') => {
        console.log(`QR Code processed (${source}):`, code);
        setScannedQR(code);
        addToHistory(code);

        // Feedback
        if (source === 'camera') {
            triggerVibration();
            playSuccessSound();
        }

        // Callback
        onScan?.(code);

        // Handle URL
        if (autoOpenUrl && code.startsWith('http')) {
            window.open(code, '_blank');
            showToast('QR escaneado - Abriendo verificacion');
        } else {
            const isManifiesto = SITREP_QR_PATTERN.test(code);
            showToast(isManifiesto ? 'QR de manifiesto detectado' : `QR: ${code.substring(0, 50)}...`);
        }
    }, [onScan, addToHistory, triggerVibration, playSuccessSound, autoOpenUrl, showToast]);

    // Clear timeout handlers
    const clearTimeoutHandlers = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
        setScanProgress(0);
    }, []);

    // Stop camera and cleanup
    const stopCamera = useCallback(() => {
        scanningRef.current = false;
        setIsScanning(false);
        clearTimeoutHandlers();

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setCameraActive(false);
        setDetectionState({ detecting: false, location: null });
        setError(null);
    }, [cameraStream, clearTimeoutHandlers]);

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
                    inversionAttempts: 'attemptBoth',
                });

                if (code && code.data) {
                    // Update detection state with location
                    setDetectionState({
                        detecting: true,
                        location: {
                            x: code.location.topLeftCorner.x,
                            y: code.location.topLeftCorner.y,
                            width: code.location.topRightCorner.x - code.location.topLeftCorner.x,
                            height: code.location.bottomLeftCorner.y - code.location.topLeftCorner.y
                        }
                    });

                    // Brief delay to show detection visual
                    setTimeout(() => {
                        scanningRef.current = false;
                        stopCamera();
                        processCode(code.data, 'camera');
                    }, 200);

                    return;
                } else {
                    // No QR detected, clear detection state
                    setDetectionState(prev =>
                        prev.detecting ? { detecting: false, location: null } : prev
                    );
                }
            } catch (err) {
                console.error('Error scanning QR:', err);
            }
        }

        if (scanningRef.current) {
            requestAnimationFrame(scanQRFromVideo);
        }
    }, [stopCamera, processCode]);

    // Bind stream to video when camera becomes active
    useEffect(() => {
        if (cameraActive && cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(err => console.warn('Video play error:', err));
            videoRef.current.onloadedmetadata = () => {
                scanningRef.current = true;
                setIsScanning(true);
                requestAnimationFrame(scanQRFromVideo);
            };
        }
    }, [cameraActive, cameraStream, scanQRFromVideo]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            scanningRef.current = false;
            clearTimeoutHandlers();
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [cameraStream, clearTimeoutHandlers]);

    const startCamera = useCallback(async () => {
        setScannedQR(null);
        setError(null);
        setDetectionState({ detecting: false, location: null });

        try {
            // Request camera with environment-facing preference
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            setCameraStream(stream);
            setCameraActive(true);
            showToast('Camara activada - Apunte al codigo QR');

            // Set up timeout
            startTimeRef.current = Date.now();

            progressIntervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTimeRef.current;
                const progress = Math.min((elapsed / timeoutMs) * 100, 100);
                setScanProgress(progress);
            }, 100);

            timeoutRef.current = setTimeout(() => {
                if (scanningRef.current) {
                    setError('No se detecto codigo QR. Intente de nuevo o ingrese el codigo manualmente.');
                    showToast('Tiempo agotado - Use entrada manual');
                    stopCamera();
                }
            }, timeoutMs);

        } catch (err: any) {
            console.error('Camera error:', err);
            let errorMsg = 'No se pudo acceder a la camara';

            if (err.name === 'NotAllowedError') {
                errorMsg = 'Permiso de camara denegado. Habilite el acceso en configuracion.';
            } else if (err.name === 'NotFoundError') {
                errorMsg = 'No se encontro camara disponible.';
            } else if (err.name === 'NotReadableError') {
                errorMsg = 'La camara esta siendo usada por otra aplicacion.';
            }

            setError(errorMsg);
            showToast(errorMsg);
        }
    }, [showToast, timeoutMs, stopCamera]);

    const clearScannedQR = useCallback(() => {
        setScannedQR(null);
        setError(null);
    }, []);

    // Manual code submission
    const submitManualCode = useCallback((code: string) => {
        const trimmed = code.trim();
        if (!trimmed) {
            setError('Ingrese un codigo valido');
            return;
        }

        // Validate format if it looks like a SITREP code
        if (trimmed.startsWith('http') && !SITREP_QR_PATTERN.test(trimmed)) {
            console.warn('URL does not match SITREP pattern, but accepting anyway');
        }

        processCode(trimmed, 'manual');
    }, [processCode]);

    // Clear scan history
    const clearHistory = useCallback(() => {
        setScanHistory([]);
        localStorage.removeItem(SCAN_HISTORY_KEY);
    }, []);

    // Select from history
    const selectFromHistory = useCallback((item: ScanHistoryItem) => {
        processCode(item.code, 'history');
    }, [processCode]);

    return {
        // State
        cameraActive,
        scannedQR,
        isScanning,
        scanProgress,
        detectionState,
        error,

        // History
        scanHistory,

        // Refs
        videoRef,
        canvasRef,

        // Actions
        startCamera,
        stopCamera,
        clearScannedQR,
        submitManualCode,
        clearHistory,
        selectFromHistory,
    };
}
