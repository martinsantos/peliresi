/**
 * CategoriaBadges - Componente para mostrar categorías Y-code como badges
 * Soporta múltiples categorías separadas por guión/coma/espacio
 * Con tooltips que muestran la descripción completa
 */

import React, { useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import {
  getCategoriasInfo,
  esCategoriaGenerador,
  getLabelCategoriaGenerador,
  getPeligrosidadMaxima
} from '../utils/categorias';
import { CATEGORIAS_Y_CODES, type CategoriaYCode } from '../data/categorias-residuos';

interface CategoriaBadgesProps {
  categorias: string | null | undefined;
  showTooltip?: boolean;
  maxVisible?: number;
  size?: 'xs' | 'sm' | 'md';
  showPeligrosidad?: boolean;
  className?: string;
}

interface TooltipState {
  visible: boolean;
  codigo: string;
  x: number;
  y: number;
}

const peligrosidadStyles: Record<string, { bg: string; color: string; border: string }> = {
  Alta: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  Media: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  Baja: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  Variable: {
    bg: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    border: 'rgba(139, 92, 246, 0.3)',
  },
  'N/A': {
    bg: 'rgba(100, 116, 139, 0.15)',
    color: '#cbd5e1',
    border: 'rgba(100, 116, 139, 0.3)',
  },
};

const generadorStyles: Record<string, { bg: string; color: string; border: string }> = {
  GRAN_GENERADOR: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.3)',
  },
  MEDIANO_GENERADOR: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  PEQUENO_GENERADOR: {
    bg: 'rgba(6, 182, 212, 0.15)',
    color: '#22d3ee',
    border: 'rgba(6, 182, 212, 0.3)',
  },
};

const sizeStyles = {
  xs: { fontSize: '10px', padding: '2px 6px', gap: '3px' },
  sm: { fontSize: '11px', padding: '3px 8px', gap: '4px' },
  md: { fontSize: '12px', padding: '4px 10px', gap: '6px' },
};

export const CategoriaBadges: React.FC<CategoriaBadgesProps> = ({
  categorias,
  showTooltip = true,
  maxVisible = 5,
  size = 'sm',
  showPeligrosidad = false,
  className = '',
}) => {
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    codigo: '',
    x: 0,
    y: 0
  });

  // Si es una categoría de generador (GRAN/MEDIANO/PEQUENO_GENERADOR)
  if (esCategoriaGenerador(categorias)) {
    const cat = categorias?.toUpperCase().trim() || '';
    const styles = generadorStyles[cat] || generadorStyles.MEDIANO_GENERADOR;

    return (
      <div className={`categoria-badges ${className}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: sizeStyles[size].gap,
            padding: sizeStyles[size].padding,
            fontSize: sizeStyles[size].fontSize,
            fontWeight: 500,
            background: styles.bg,
            color: styles.color,
            border: `1px solid ${styles.border}`,
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          {getLabelCategoriaGenerador(categorias)}
        </span>
      </div>
    );
  }

  // Parsear Y-codes
  const parsed = getCategoriasInfo(categorias);

  if (parsed.length === 0) {
    return (
      <span
        style={{
          color: 'var(--color-text-tertiary, #64748b)',
          fontSize: sizeStyles[size].fontSize,
          fontStyle: 'italic'
        }}
      >
        Sin categoría
      </span>
    );
  }

  const visible = parsed.slice(0, maxVisible);
  const remaining = parsed.length - maxVisible;

  const handleMouseEnter = (codigo: string, e: React.MouseEvent) => {
    if (!showTooltip) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      codigo,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ ...tooltip, visible: false });
  };

  const getStyleForCode = (info: CategoriaYCode | null): { bg: string; color: string; border: string } => {
    if (!info) {
      return peligrosidadStyles['N/A'];
    }
    return peligrosidadStyles[info.peligrosidad] || peligrosidadStyles['Variable'];
  };

  return (
    <div className={`categoria-badges ${className}`} style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
      {showPeligrosidad && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 600,
            background: peligrosidadStyles[getPeligrosidadMaxima(categorias)].bg,
            color: peligrosidadStyles[getPeligrosidadMaxima(categorias)].color,
            border: `1px solid ${peligrosidadStyles[getPeligrosidadMaxima(categorias)].border}`,
            borderRadius: '4px',
            marginRight: '4px',
          }}
          title={`Peligrosidad máxima: ${getPeligrosidadMaxima(categorias)}`}
        >
          <AlertTriangle size={10} />
          {getPeligrosidadMaxima(categorias)}
        </span>
      )}

      {visible.map((cat, index) => {
        const styles = getStyleForCode(cat.info);

        return (
          <span
            key={`${cat.codigo}-${index}`}
            onMouseEnter={(e) => handleMouseEnter(cat.codigo, e)}
            onMouseLeave={handleMouseLeave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: sizeStyles[size].gap,
              padding: sizeStyles[size].padding,
              fontSize: sizeStyles[size].fontSize,
              fontWeight: 500,
              fontFamily: 'monospace',
              background: styles.bg,
              color: styles.color,
              border: `1px solid ${styles.border}`,
              borderRadius: '4px',
              cursor: showTooltip ? 'help' : 'default',
              whiteSpace: 'nowrap',
              transition: 'transform 0.1s ease',
            }}
            title={cat.info ? `${cat.info.nombre}: ${cat.info.descripcion}` : cat.codigo}
          >
            {cat.codigo}
            {!cat.valido && <Info size={10} style={{ opacity: 0.7 }} />}
          </span>
        );
      })}

      {remaining > 0 && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: sizeStyles[size].padding,
            fontSize: sizeStyles[size].fontSize,
            fontWeight: 500,
            background: 'rgba(100, 116, 139, 0.15)',
            color: '#94a3b8',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '4px',
          }}
          title={parsed.slice(maxVisible).map(c => c.codigo).join(', ')}
        >
          +{remaining}
        </span>
      )}

      {/* Tooltip flotante */}
      {tooltip.visible && CATEGORIAS_Y_CODES[tooltip.codigo] && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: 'var(--color-bg-elevated, #1e293b)',
            border: '1px solid var(--color-border, #334155)',
            borderRadius: '6px',
            padding: '8px 12px',
            maxWidth: '280px',
            zIndex: 9999,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            fontWeight: 600,
            color: 'var(--color-text-primary, #f1f5f9)',
            marginBottom: '4px',
            fontSize: '13px'
          }}>
            {CATEGORIAS_Y_CODES[tooltip.codigo].nombre}
          </div>
          <div style={{
            fontSize: '11px',
            color: 'var(--color-text-secondary, #94a3b8)',
            lineHeight: 1.4
          }}>
            {CATEGORIAS_Y_CODES[tooltip.codigo].descripcion}
          </div>
          <div style={{
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid var(--color-border-subtle, #334155)',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <AlertTriangle size={10} style={{ color: peligrosidadStyles[CATEGORIAS_Y_CODES[tooltip.codigo].peligrosidad].color }} />
            <span style={{ color: peligrosidadStyles[CATEGORIAS_Y_CODES[tooltip.codigo].peligrosidad].color }}>
              Peligrosidad: {CATEGORIAS_Y_CODES[tooltip.codigo].peligrosidad}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Componente compacto para tablas
export const CategoriaBadgesCompact: React.FC<{
  categorias: string | null | undefined;
  maxVisible?: number;
}> = ({ categorias, maxVisible = 3 }) => {
  return (
    <CategoriaBadges
      categorias={categorias}
      size="xs"
      maxVisible={maxVisible}
      showTooltip={true}
    />
  );
};

// Componente expandido para detalles
export const CategoriasDetalle: React.FC<{
  categorias: string | null | undefined;
}> = ({ categorias }) => {
  const parsed = getCategoriasInfo(categorias);

  if (parsed.length === 0) {
    return (
      <div style={{ color: 'var(--color-text-tertiary, #64748b)', fontStyle: 'italic' }}>
        Sin categorías asignadas
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {parsed.map((cat, index) => {
        const styles = peligrosidadStyles[cat.info?.peligrosidad || 'N/A'];

        return (
          <div
            key={`${cat.codigo}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '10px 12px',
              background: styles.bg,
              border: `1px solid ${styles.border}`,
              borderRadius: '6px',
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontFamily: 'monospace',
                fontSize: '14px',
                color: styles.color,
                minWidth: '40px',
              }}
            >
              {cat.codigo}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: 500,
                color: 'var(--color-text-primary, #f1f5f9)',
                marginBottom: '2px'
              }}>
                {cat.info?.nombre || 'Categoría desconocida'}
              </div>
              {cat.info && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--color-text-secondary, #94a3b8)'
                }}>
                  {cat.info.descripcion}
                </div>
              )}
            </div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                fontSize: '10px',
                fontWeight: 600,
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                color: styles.color,
              }}
            >
              <AlertTriangle size={10} />
              {cat.info?.peligrosidad || 'N/A'}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default CategoriaBadges;
