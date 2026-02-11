/**
 * SITREP v6 - QR Code Component
 * ==============================
 * Visualización de códigos QR para manifiestos
 */

import React from 'react';
import { Download, Share2, X, QrCode as QrCodeIcon } from 'lucide-react';
import { Button } from './ButtonV2';

interface QRCodeProps {
  value: string;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
}

/**
 * Componente QR Code visual
 * En producción, usaría una librería como qrcode.react
 */
export const QRCode: React.FC<QRCodeProps> = ({
  value,
  title,
  subtitle = 'Escanear para ver detalles',
  onClose,
  onDownload,
  onShare,
}) => {
  // Generar un patrón QR visual simple (simulado)
  const generateQRPattern = () => {
    const cells = [];
    const size = 29; // Tamaño de la matriz QR
    
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        // Posicionadores de esquina (finder patterns)
        const isCorner = 
          (row < 7 && col < 7) || // Esquina superior izquierda
          (row < 7 && col >= size - 7) || // Esquina superior derecha
          (row >= size - 7 && col < 7); // Esquina inferior izquierda
        
        // Patrón de alineación
        const isAlignment = row > 14 && row < 19 && col > 14 && col < 19;
        
        // Timing patterns
        const isTiming = row === 6 || col === 6;
        
        // Datos aleatorios basados en el valor
        const hash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const isData = ((row * size + col + hash) % 2 === 0);
        
        let isBlack = false;
        
        if (isCorner) {
          // Finder pattern: cuadrado exterior + interior
          const inInner = (row >= 2 && row <= 4 && col >= 2 && col <= 4) ||
                         (row >= size - 5 && row <= size - 3 && col >= 2 && col <= 4) ||
                         (row >= 2 && row <= 4 && col >= size - 5 && col <= size - 3);
          const inOuter = (row === 0 || row === 6 || col === 0 || col === 6) ||
                         (row === size - 7 || row === size - 1 || col === size - 7 || col === size - 1) ||
                         (row >= size - 7 && row <= size - 1 && (col === 0 || col === 6)) ||
                         (col >= size - 7 && col <= size - 1 && (row === 0 || row === 6));
          isBlack = inOuter || inInner;
        } else if (isAlignment) {
          // Alignment pattern
          const alignCenter = row === 16 && col === 16;
          const alignRing = (row >= 15 && row <= 17 && col >= 15 && col <= 17) && !alignCenter;
          isBlack = alignCenter || alignRing;
        } else if (isTiming) {
          // Timing pattern
          isBlack = (row + col) % 2 === 0;
        } else {
          // Datos
          isBlack = isData;
        }
        
        cells.push(
          <div
            key={`${row}-${col}`}
            className={`w-full h-full ${isBlack ? 'bg-neutral-900' : 'bg-white'}`}
          />
        );
      }
    }
    return cells;
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full mx-auto">
      {/* Header */}
      {(title || onClose) && (
        <div className="flex items-center justify-between p-4 border-b border-neutral-100">
          {title && <h3 className="font-semibold text-neutral-900">{title}</h3>}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-neutral-500" />
            </button>
          )}
        </div>
      )}

      {/* QR Code */}
      <div className="p-8 flex flex-col items-center">
        <div className="relative">
          {/* Fondo con padding blanco */}
          <div className="bg-white p-4 rounded-xl shadow-lg border-2 border-neutral-100">
            {/* Grid del QR */}
            <div
              data-qr-grid
              className="grid gap-0"
              style={{
                gridTemplateColumns: 'repeat(29, 1fr)',
                width: '200px',
                height: '200px'
              }}
            >
              {generateQRPattern()}
            </div>
          </div>
          
          {/* Logo/icono centrado (opcional) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 bg-white rounded-lg shadow-md flex items-center justify-center">
              <QrCodeIcon className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center">
          <p className="font-mono text-lg font-bold text-neutral-900">{value}</p>
          <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
        </div>
      </div>

      {/* Acciones */}
      {(onDownload || onShare) && (
        <div className="flex gap-2 p-4 border-t border-neutral-100">
          {onDownload && (
            <Button
              variant="outline"
              fullWidth
              leftIcon={<Download size={18} />}
              onClick={onDownload}
            >
              Descargar
            </Button>
          )}
          {onShare && (
            <Button
              fullWidth
              leftIcon={<Share2 size={18} />}
              onClick={onShare}
            >
              Compartir
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Modal para mostrar el QR
 */
interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  manifiestoId: string;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  manifiestoId,
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const qrEl = document.querySelector('[data-qr-grid]') as HTMLElement;
    if (!qrEl) return;

    // Use canvas to capture the QR grid
    const canvas = document.createElement('canvas');
    const size = 580; // 29 cells * 20px
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const cells = qrEl.children;
    const cellSize = 20;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as HTMLElement;
      const row = Math.floor(i / 29);
      const col = i % 29;
      if (cell.classList.contains('bg-neutral-900')) {
        ctx.fillStyle = '#171717';
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    const link = document.createElement('a');
    link.download = `QR-${manifiestoId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Manifiesto ${manifiestoId}`,
          text: `Ver detalles del manifiesto ${manifiestoId}`,
          url: `${window.location.origin}/manifiestos/${manifiestoId}`,
        });
      } catch {
        // Share cancelled or failed - no action needed
      }
    } else {
      // Fallback: copiar al portapapeles
      navigator.clipboard.writeText(`${window.location.origin}/manifiestos/${manifiestoId}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 animate-in zoom-in-95 duration-200">
        <QRCode
          value={manifiestoId}
          title="Código QR del Manifiesto"
          onClose={onClose}
          onDownload={handleDownload}
          onShare={handleShare}
        />
      </div>
    </div>
  );
};

export default QRCode;
