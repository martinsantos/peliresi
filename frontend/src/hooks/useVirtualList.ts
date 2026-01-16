/**
 * useVirtualList - Hook para virtualización de listas grandes
 * OPTIMIZADO: Evita renderizar todos los items cuando hay 100+ elementos
 *
 * Uso:
 * const { virtualItems, totalSize, parentRef } = useVirtualList({
 *   count: items.length,
 *   estimateSize: () => 60, // altura estimada por fila
 * });
 */

import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface UseVirtualListOptions {
  /** Total de items */
  count: number;
  /** Función que retorna altura estimada de cada item */
  estimateSize: (index: number) => number;
  /** Items extras renderizados fuera del viewport */
  overscan?: number;
  /** Orientación (vertical u horizontal) */
  horizontal?: boolean;
}

export function useVirtualList(options: UseVirtualListOptions) {
  const { count, estimateSize, overscan = 5, horizontal = false } = options;
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    horizontal,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  // Helper para obtener estilos de posicionamiento
  const getItemStyle = useCallback(
    (index: number) => {
      const item = virtualItems.find((v) => v.index === index);
      if (!item) return {};

      return horizontal
        ? {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: `${item.size}px`,
            height: '100%',
            transform: `translateX(${item.start}px)`,
          }
        : {
            position: 'absolute' as const,
            top: 0,
            left: 0,
            width: '100%',
            height: `${item.size}px`,
            transform: `translateY(${item.start}px)`,
          };
    },
    [virtualItems, horizontal]
  );

  return {
    parentRef,
    virtualItems,
    totalSize,
    getItemStyle,
    measureElement: virtualizer.measureElement,
  };
}

export default useVirtualList;
