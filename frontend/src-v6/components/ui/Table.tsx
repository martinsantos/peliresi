/**
 * SITREP v6 - Table Component
 * ============================
 * Tabla avanzada con ordenamiento, selección y paginación
 */

import React, { useState, useMemo, forwardRef } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ChevronDown, ChevronUp, ArrowUpDown, MoreHorizontal, Search } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  hiddenBelow?: 'sm' | 'md' | 'lg';
  truncate?: boolean;
  render?: (row: T) => React.ReactNode;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T) => string;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  sortable?: boolean;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
  emptyMessage?: string;
  striped?: boolean;
  compact?: boolean;
  bordered?: boolean;
  stickyHeader?: boolean;
  className?: string;
  onRowClick?: (row: T) => void;
  renderExpandedRow?: (row: T) => React.ReactNode | null;
}

// ========================================
// TABLE COMPONENT
// ========================================
export function Table<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  sortable = false,
  onSort,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  striped = false,
  compact = false,
  stickyHeader = false,
  bordered = false,
  className,
  onRowClick,
  renderExpandedRow,
}: TableProps<T>) {
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    if (!sortable) return;
    
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    onSort?.(key, direction);
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(safeData.map(keyExtractor));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange) return;
    if (selectedKeys.includes(key)) {
      onSelectionChange(selectedKeys.filter((k) => k !== key));
    } else {
      onSelectionChange([...selectedKeys, key]);
    }
  };

  const safeData = Array.isArray(data) ? data : [];

  const allSelected = safeData.length > 0 && selectedKeys.length === safeData.length;
  const someSelected = selectedKeys.length > 0 && selectedKeys.length < safeData.length;

  const cellPadding = compact ? 'px-3 py-2' : 'px-3 py-2.5';
  const headerPadding = compact ? 'px-3 py-2' : 'px-3 py-2.5';

  const hiddenClass = (col: Column<T>) => {
    if (!col.hiddenBelow) return '';
    if (col.hiddenBelow === 'sm') return 'hidden sm:table-cell';
    if (col.hiddenBelow === 'md') return 'hidden md:table-cell';
    if (col.hiddenBelow === 'lg') return 'hidden lg:table-cell';
    return '';
  };

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-neutral-200 bg-white', stickyHeader ? 'max-h-[70vh] overflow-y-auto' : 'overflow-hidden', className)}>
        <table className="w-full text-left">
          <thead className={cn('bg-neutral-50 border-b border-neutral-200', stickyHeader && 'sticky top-0 z-10')}>
            <tr>
              {selectable && (
                <th className={cn(headerPadding, 'w-px whitespace-nowrap')}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    headerPadding,
                    'text-xs font-semibold text-neutral-600 uppercase tracking-wider',
                    column.sortable && sortable && 'cursor-pointer select-none hover:text-neutral-900',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    hiddenClass(column)
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className={cn('flex items-center gap-1', column.align === 'center' && 'justify-center', column.align === 'right' && 'justify-end')}>
                    {column.header}
                    {column.sortable && sortable && (
                      <span className="text-neutral-400">
                        {sortConfig?.key === column.key ? (
                          sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                        ) : (
                          <ArrowUpDown size={14} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {selectable && <td className={cellPadding}><div className="w-4 h-4 bg-neutral-200 rounded" /></td>}
                  {columns.map((col, j) => (
                    <td key={j} className={cellPadding}>
                      <div className="h-4 bg-neutral-200 rounded w-3/4" />
                    </td>
                  ))}
                </tr>
              ))
            ) : safeData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-neutral-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Search size={24} className="text-neutral-300" />
                    <p>{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              safeData.map((row, index) => {
                const rowKey = keyExtractor(row);
                const isSelected = selectedKeys.includes(rowKey);
                const expandedContent = renderExpandedRow?.(row);
                return (
                  <React.Fragment key={rowKey}>
                  <tr
                    className={cn(
                      'transition-colors',
                      striped && index % 2 === 1 && 'bg-neutral-50/50',
                      isSelected && 'bg-primary-50/50',
                      onRowClick && 'cursor-pointer hover:bg-neutral-50',
                      bordered && 'border-b border-neutral-100 last:border-0'
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className={cn(cellPadding, 'whitespace-nowrap')} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(rowKey)}
                          className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          cellPadding,
                          'text-sm text-neutral-900',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right',
                          column.truncate && 'truncate max-w-0',
                          hiddenClass(column)
                        )}
                      >
                        {column.render ? column.render(row) : row[column.key]}
                      </td>
                    ))}
                  </tr>
                  {expandedContent && (
                    <tr>
                      <td colSpan={columns.length + (selectable ? 1 : 0)} className="p-0">
                        {expandedContent}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
    </div>
  );
}

// ========================================
// PAGINATION
// ========================================
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (items: number) => void;
  itemsPerPageOptions?: number[];
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [10, 25, 50, 100],
}: PaginationProps) {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    const pages: (number | string)[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-neutral-200 bg-white">
      <div className="flex items-center gap-4 text-sm text-neutral-600">
        <span>
          Mostrando <strong className="text-neutral-900">{startItem}-{endItem}</strong> de{' '}
          <strong className="text-neutral-900">{totalItems}</strong>
        </span>
        {onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span>/</span>
            <select
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="text-sm border-neutral-200 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              {itemsPerPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span>por página</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Anterior
        </button>

        {getVisiblePages().map((page, i) => (
          <React.Fragment key={i}>
            {page === '...' ? (
              <span className="px-2 text-neutral-400">...</span>
            ) : (
              <button
                onClick={() => onPageChange(page as number)}
                className={cn(
                  'min-w-[32px] px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  currentPage === page
                    ? 'bg-primary-500 text-white'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                )}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

export default Table;
