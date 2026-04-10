/**
 * SITREP v6 - SignaturePad
 * Canvas-based signature input with touch + mouse support
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface SignaturePadProps {
  onConfirm: (dataUrl: string) => void;
  onClear?: () => void;
  width?: number;
  height?: number;
  penColor?: string;
  lineWidth?: number;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onConfirm,
  onClear,
  width = 400,
  height = 200,
  penColor = '#1B5E3C',
  lineWidth = 2,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d'), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [penColor, lineWidth]);

  const isDrawingRef = useRef(false);

  const getPos = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    const me = e as MouseEvent;
    return {
      x: (me.clientX - rect.left) * scaleX,
      y: (me.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    isDrawingRef.current = true;
    setIsDrawing(true);
    setHasContent(true);
  }, [getCtx]);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [getCtx]);

  const endDraw = useCallback(() => {
    isDrawingRef.current = false;
    setIsDrawing(false);
  }, []);

  // Register touch handlers with { passive: false } to allow preventDefault
  // React synthetic events are passive by default in modern Chrome, causing
  // "Unable to preventDefault inside passive event listener" warnings.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
    canvas.addEventListener('mousedown', startDraw as EventListener);
    canvas.addEventListener('mousemove', draw as EventListener);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);
    return () => {
      canvas.removeEventListener('touchstart', startDraw);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', endDraw);
      canvas.removeEventListener('mousedown', startDraw as EventListener);
      canvas.removeEventListener('mousemove', draw as EventListener);
      canvas.removeEventListener('mouseup', endDraw);
      canvas.removeEventListener('mouseleave', endDraw);
    };
  }, [startDraw, draw, endDraw]);

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasContent(false);
    onClear?.();
  };

  const handleConfirm = () => {
    if (!hasContent || !canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onConfirm(dataUrl);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-xl border-2 border-dashed border-neutral-300 overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full cursor-crosshair touch-none"
          style={{ aspectRatio: `${width}/${height}` }}
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-neutral-400 text-sm">Firme aquí</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-colors"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!hasContent}
          className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar Firma
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;
