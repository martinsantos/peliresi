/**
 * SITREP v6 - GenericCRUDPage Types
 * ==================================
 * Config-driven types for admin CRUD pages.
 * The generic component handles layout (header, stats, filters, table, pagination, delete modal).
 * Each page owns its data hooks, enrichment, and column render functions.
 */

import type { ReactNode } from 'react';
import type { Column } from '../ui/Table';

// Re-export Column so consumers only need one import
export type { Column };

// ========================================
// STAT CARD
// ========================================
export interface CRUDStatCard {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconBg: string;       // e.g. 'bg-purple-100'
  iconColor: string;    // e.g. 'text-purple-600'
}

// ========================================
// FILTER DROPDOWN
// ========================================
export interface CRUDFilter {
  key: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;  // e.g. "Todos los rubros"
}

// ========================================
// CSV EXPORT CONFIG
// ========================================
export interface CRUDExportConfig {
  /** Map each item to a flat row for CSV export */
  mapRow: (item: any) => Record<string, unknown>;
  filename: string;
  metadata: {
    titulo: string;
    periodo: string;
    filtros: string;
    total: number;
  };
}

// ========================================
// PDF EXPORT CONFIG
// ========================================
export interface CRUDPdfExportConfig {
  titulo: string;
  subtitulo: string;
  periodo: string;
  kpis: { label: string; value: string | number }[];
  tabla: {
    headers: string[];
    rows: (string | number)[][];
  };
}

// ========================================
// DELETE CONFIG
// ========================================
export interface CRUDDeleteConfig {
  /** Currently targeted item for deletion */
  target: { id: string; label: string } | null;
  onDelete: () => void | Promise<void>;
  onClose: () => void;  // Called when modal is dismissed (cancel / overlay click)
  isLoading: boolean;
  title: string;        // e.g. "Eliminar Generador"
}

// ========================================
// SORT CONFIG
// ========================================
export interface CRUDSortConfig {
  onSort: (key: string, direction: 'asc' | 'desc') => void;
}

// ========================================
// PAGINATION CONFIG
// ========================================
export interface CRUDPaginationConfig {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

// ========================================
// MAIN CONFIG
// ========================================
export interface GenericCRUDConfig<T> {
  // Page metadata
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconBg: string;       // e.g. 'bg-purple-100'

  // Data
  data: T[];
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  loadingMessage?: string;

  // Table
  columns: Column<T>[];
  getRowKey: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;

  // Search
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Filters
  filters?: CRUDFilter[];

  // Stats
  stats?: CRUDStatCard[];

  // Sort
  sort?: CRUDSortConfig;

  // Pagination
  pagination: CRUDPaginationConfig;

  // Actions — header buttons
  onNew?: () => void;
  newLabel?: string;     // e.g. "Nuevo Generador"

  // Export
  csvExport?: CRUDExportConfig;
  pdfExport?: CRUDPdfExportConfig;

  // Delete
  deleteConfig?: CRUDDeleteConfig;

  // Mobile card view: when provided, renders cards on mobile instead of the table
  renderMobileCard?: (item: T) => ReactNode;

  // Escape hatch: render extra content between sections
  renderAfterStats?: () => ReactNode;
  renderAfterFilters?: () => ReactNode;
  renderAfterTable?: () => ReactNode;
}
