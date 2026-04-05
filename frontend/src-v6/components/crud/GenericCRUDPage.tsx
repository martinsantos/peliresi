/**
 * SITREP v6 - GenericCRUDPage Component
 * =======================================
 * Config-driven layout for admin CRUD pages.
 * Handles: header, stats, search+filters, table+pagination, delete modal, export buttons.
 * Each page owns its data hooks, enrichment, column renderers, and business logic.
 */

import React from 'react';
import {
  Plus,
  Download,
  FileDown,
  Printer,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '../ui/CardV2';
import { Button } from '../ui/ButtonV2';
import { SearchInput } from '../ui/SearchInput';
import { Table, Pagination } from '../ui/Table';
import { ConfirmModal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { toast } from '../ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import type { GenericCRUDConfig } from './GenericCRUDPage.types';

// ========================================
// COMPONENT
// ========================================
export function GenericCRUDPage<T extends Record<string, any>>(props: GenericCRUDConfig<T>) {
  const {
    // Page metadata
    title,
    subtitle,
    icon,
    iconBg,
    // Data
    data,
    isLoading,
    isError,
    errorMessage,
    loadingMessage,
    // Table
    columns,
    getRowKey,
    onRowClick,
    emptyMessage = 'No se encontraron registros',
    // Search
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Buscar...',
    // Filters
    filters,
    // Stats
    stats,
    // Sort
    sort,
    // Pagination
    pagination,
    // Actions
    onNew,
    newLabel = 'Nuevo',
    // Export
    csvExport,
    pdfExport,
    // Delete
    deleteConfig,
    // Mobile card view
    renderMobileCard,
    // Escape hatches
    renderAfterStats,
    renderAfterFilters,
    renderAfterTable,
  } = props;

  // ========================================
  // EXPORT HANDLERS
  // ========================================
  const handleCsvExport = () => {
    if (!csvExport) return;
    const rows = data.map(csvExport.mapRow);
    downloadCsv(rows, csvExport.filename, csvExport.metadata);
    toast.success('Exportar', 'CSV descargado');
  };

  const handlePdfExport = () => {
    if (!pdfExport) return;
    exportReportePDF(pdfExport);
  };

  // ========================================
  // DELETE MODAL
  // ========================================
  const deleteModalOpen = deleteConfig?.target != null;
  const deleteDescription = deleteConfig?.target
    ? `\u00bfEst\u00e1 seguro que desea eliminar a "${deleteConfig.target.label}"? Esta acci\u00f3n no se puede deshacer.`
    : '';

  // ========================================
  // RENDER
  // ========================================
  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-2 sm:p-3 ${iconBg} rounded-xl`}>
            {icon}
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-bold text-neutral-900">{title}</h2>
            <p className="text-sm sm:text-base text-neutral-600">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors"
            title="Imprimir"
          >
            <Printer size={14} />
            Imprimir
          </button>
          {csvExport && (
            <Button
              variant="outline"
              leftIcon={<Download size={18} />}
              onClick={handleCsvExport}
              className="hidden sm:inline-flex"
            >
              CSV
            </Button>
          )}
          {pdfExport && (
            <Button
              variant="outline"
              leftIcon={<FileDown size={18} />}
              onClick={handlePdfExport}
              className="hidden sm:inline-flex text-error-700 border-error-200 hover:bg-error-50"
            >
              PDF
            </Button>
          )}
          {onNew && (
            <Button leftIcon={<Plus size={18} />} onClick={onNew}>
              {newLabel}
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx}>
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-1.5 sm:p-2 ${stat.iconBg} rounded-lg shrink-0`}>
                    {stat.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-bold text-neutral-900">{stat.value}</p>
                    <p className="text-xs sm:text-sm text-neutral-600 truncate">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {renderAfterStats?.()}

      {/* ── Filters ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchValue}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                size="md"
              />
            </div>
            {filters && filters.length > 0 && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                {filters.map((filter) => (
                  <div key={filter.key} className="w-full sm:w-auto sm:min-w-[160px]">
                    <Select
                      value={filter.value}
                      onChange={filter.onChange}
                      options={filter.options}
                      placeholder={filter.placeholder || filter.options[0]?.label}
                      size="sm"
                      isFullWidth
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {renderAfterFilters?.()}

      {/* ── Mobile Card View ── */}
      {renderMobileCard && (
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={28} className="animate-spin text-primary-500" />
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-error-600 text-sm">
              Error al cargar datos
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm">{emptyMessage}</div>
          ) : (
            <>
              {data.map((item) => (
                <div key={getRowKey(item)} onClick={() => onRowClick?.(item)} className={onRowClick ? 'cursor-pointer' : ''}>
                  {renderMobileCard(item)}
                </div>
              ))}
              <div className="flex items-center justify-between py-3 text-xs text-neutral-500">
                <span>Pág. {pagination.currentPage}/{pagination.totalPages} — {pagination.totalItems} total</span>
                <div className="flex gap-1">
                  <button disabled={pagination.currentPage <= 1} onClick={() => pagination.onPageChange(pagination.currentPage - 1)} className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-30">Ant.</button>
                  <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.currentPage + 1)} className="px-3 py-1.5 rounded-lg border border-neutral-200 disabled:opacity-30">Sig.</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Desktop Table ── */}
      <Card className={renderMobileCard ? 'hidden md:block' : ''}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">
              {loadingMessage || `Cargando ${title.toLowerCase()}...`}
            </span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-error-600">
            <span>Error al cargar datos: {errorMessage || 'Error desconocido'}</span>
          </div>
        ) : (
          <>
            <Table
              data={data}
              columns={columns}
              keyExtractor={getRowKey}
              sortable={!!sort}
              onSort={sort?.onSort}
              onRowClick={onRowClick}
              emptyMessage={emptyMessage}
              stickyHeader
              fixedLayout
            />
            <Pagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={pagination.onPageChange}
            />
          </>
        )}
      </Card>

      {renderAfterTable?.()}

      {/* ── Delete Modal ── */}
      {deleteConfig && (
        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={deleteConfig.onClose}
          onConfirm={deleteConfig.onDelete}
          title={deleteConfig.title}
          description={deleteDescription}
          confirmText="Eliminar"
          variant="danger"
          isLoading={deleteConfig.isLoading}
        />
      )}
    </div>
  );
}

export default GenericCRUDPage;
