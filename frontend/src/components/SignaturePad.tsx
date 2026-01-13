/**
 * SignaturePad - Canvas para captura de firma táctil
 * Funcionalidades:
 * - Dibujo táctil y mouse
 * - Exportar como base64
 * - Limpiar y confirmar
 * - Validación de firma no vacía
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Trash2, Check, RotateCcw } from 'lucide-react';
import './SignaturePad.css';

interface SignaturePadProps {
    onConfirm: (signatureBase64: string) => void;
    onCancel?: () => void;
    width?: number;
    height?: number;
    lineColor?: string;
    lineWidth?: number;
    title?: string;
    subtitle?: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({
    onConfirm,
    onCancel,
    width = 320,
    height = 200,
    lineColor = '#1a1a2e',
    lineWidth = 2,
    title = 'Firma Digital',
    subtitle = 'Firme en el área de abajo'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [lastPosition, setLastPosition] = useState<{ x: number; y: number } | null>(null);

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        canvas.width = width;
        canvas.height = height;

        // Set initial styles
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [width, height, lineColor, lineWidth]);

    // Get position from event (touch or mouse)
    const getPosition = useCallback((e: React.TouchEvent | React.MouseEvent): { x: number; y: number } => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0];
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY
            };
        }
    }, []);

    // Start drawing
    const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault();
        const pos = getPosition(e);
        setIsDrawing(true);
        setLastPosition(pos);
    }, [getPosition]);

    // Draw
    const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        if (!isDrawing || !lastPosition) return;
        e.preventDefault();

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const pos = getPosition(e);

        ctx.beginPath();
        ctx.moveTo(lastPosition.x, lastPosition.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();

        setLastPosition(pos);
        setHasSignature(true);
    }, [isDrawing, lastPosition, getPosition]);

    // Stop drawing
    const handleEnd = useCallback(() => {
        setIsDrawing(false);
        setLastPosition(null);
    }, []);

    // Clear canvas
    const handleClear = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
    }, []);

    // Confirm and export
    const handleConfirm = useCallback(() => {
        if (!hasSignature) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const signatureBase64 = canvas.toDataURL('image/png');
        onConfirm(signatureBase64);
    }, [hasSignature, onConfirm]);

    return (
        <div className="signature-pad-container">
            <div className="signature-header">
                <h3>{title}</h3>
                <p>{subtitle}</p>
            </div>

            <div className="signature-canvas-wrapper">
                <canvas
                    ref={canvasRef}
                    className="signature-canvas"
                    onMouseDown={handleStart}
                    onMouseMove={handleMove}
                    onMouseUp={handleEnd}
                    onMouseLeave={handleEnd}
                    onTouchStart={handleStart}
                    onTouchMove={handleMove}
                    onTouchEnd={handleEnd}
                />
                {!hasSignature && (
                    <div className="signature-placeholder">
                        <span>Firme aquí</span>
                    </div>
                )}
            </div>

            <div className="signature-actions">
                <button
                    type="button"
                    className="signature-btn clear"
                    onClick={handleClear}
                    disabled={!hasSignature}
                >
                    <RotateCcw size={18} />
                    <span>Limpiar</span>
                </button>

                {onCancel && (
                    <button
                        type="button"
                        className="signature-btn cancel"
                        onClick={onCancel}
                    >
                        <Trash2 size={18} />
                        <span>Cancelar</span>
                    </button>
                )}

                <button
                    type="button"
                    className="signature-btn confirm"
                    onClick={handleConfirm}
                    disabled={!hasSignature}
                >
                    <Check size={18} />
                    <span>Confirmar</span>
                </button>
            </div>

            {!hasSignature && (
                <p className="signature-hint">
                    Dibuje su firma en el área blanca para continuar
                </p>
            )}
        </div>
    );
};

export default SignaturePad;
