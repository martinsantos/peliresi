/**
 * SITREP v6 - GenericCRUDPage Component
 * =======================================
 * Config-driven layout for admin CRUD pages.
 * Handles: header, stats, search+filters, table+pagination, delete modal, export buttons.
 * Each page owns its data hooks, enrichment, column renderers, and business logic.
 */

import React from 'react';
import {
  Download,
  FileDown,
  Printer,
  Loader2,
} from 'lucide-react';
import { Card } from '../ui/CardV2';
import { CRUDSummary } from './CRUDSummary';
import { RecordListToolbar } from './RecordListToolbar';
import { RecordListFilters } from './RecordListFilters';
import { Table, Pagination } from '../ui/Table';
import { ConfirmModal } from '../ui/Modal';
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
    // Data
    data,
    isLoading,
    isError,
    errorMessage,
    loadingMessage,
    // Table
    columns,
    tableClassName,
    getRowKey,
    getRowLabel,
    onRowClick,
    emptyMessage = 'No se encontraron registros',
    // Search
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Buscar...',
    searchDebounce = 0,
    // Filters
    filters,
    // Stats
    stats,
    // Sort
    sort,
    selection,
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

  const [exporting, setExporting] = React.useState<'csv' | 'pdf' | null>(null);

  // ========================================
  // EXPORT HANDLERS
  // ========================================
  const handleCsvExport = async () => {
    if (!csvExport) return;
    setExporting('csv');
    try {
      if (csvExport.onExport) {
        await csvExport.onExport();
      } else if (csvExport.mapRow) {
        const rows = data.map(csvExport.mapRow);
        downloadCsv(rows, csvExport.filename, csvExport.metadata);
      }
      toast.success('Exportar', 'CSV descargado');
    } catch (error) {
      toast.error('Exportar', error instanceof Error ? error.message : 'No se pudo generar el CSV');
    } finally {
      setExporting(null);
    }
  };

  const handlePdfExport = async () => {
    if (!pdfExport) return;
    setExporting('pdf');
    try {
      if (pdfExport.onExport) {
        await pdfExport.onExport();
      } else {
        await exportReportePDF(pdfExport);
      }
      toast.success('Exportar', 'PDF descargado');
    } catch (error) {
      toast.error('Exportar', error instanceof Error ? error.message : 'No se pudo generar el PDF');
    } finally {
      setExporting(null);
    }
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
    <div className="space-y-4 animate-fade-in">
      <RecordListToolbar title={title} onNew={onNew} newLabel={newLabel} exports={[
        ...(csvExport ? [{label: exporting === 'csv' ? 'Preparando CSV…' : 'Descargar CSV', icon: <Download size={16} />, onClick: handleCsvExport, disabled: isLoading || isError || exporting !== null || data.length === 0}] : []),
        ...(pdfExport ? [{label: exporting === 'pdf' ? 'Preparando PDF…' : 'Descargar PDF', icon: <FileDown size={16} />, onClick: handlePdfExport, disabled: isLoading || isError || exporting !== null || data.length === 0}] : []),
        {label: 'Imprimir', icon: <Printer size={16} />, onClick: () => window.print(), disabled: isLoading || isError},
      ]} />

      {/* ── Stats ── */}
      {stats && stats.length > 0 && (
        <CRUDSummary stats={stats} />
      )}

      {renderAfterStats?.()}

      <RecordListFilters title={title} value={searchValue} onChange={onSearchChange}
        placeholder={searchPlaceholder} debounce={searchDebounce} filters={filters} />

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
              {data.map((item) => {
                const key = getRowKey(item);
                const selected = selection?.selectedKeys.includes(key) ?? false;
                return <div key={key} className="relative">
                  {selection && <label className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-white shadow-sm" aria-label={`${selection.ariaLabel || 'Seleccionar registro'} ${getRowLabel?.(item) || key}`} onClick={(event) => event.stopPropagation()}>
                    <input type="checkbox" checked={selected} onChange={() => selection.onSelectionChange(selected ? selection.selectedKeys.filter((id) => id !== key) : [...selection.selectedKeys, key])} className="h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500" />
                  </label>}
                  {onRowClick ? <button type="button" aria-label={getRowLabel ? `Abrir ${getRowLabel(item)}` : undefined} onClick={() => onRowClick(item)} className="block w-full rounded-xl text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
                    {renderMobileCard(item)}
                  </button> : renderMobileCard(item)}
                </div>
              })}
              <div className="flex items-center justify-between py-3 text-xs text-neutral-500">
                <span>Pág. {pagination.currentPage}/{pagination.totalPages} — {pagination.totalItems} total</span>
                <div className="flex gap-1">
                  <button disabled={pagination.currentPage <= 1} onClick={() => pagination.onPageChange(pagination.currentPage - 1)} className="min-h-11 px-3 rounded-lg border border-neutral-200 disabled:opacity-50">Anterior</button>
                  <button disabled={pagination.currentPage >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.currentPage + 1)} className="min-h-11 px-3 rounded-lg border border-neutral-200 disabled:opacity-50">Siguiente</button>
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
              className={tableClassName}
              data={data}
              columns={columns}
              keyExtractor={getRowKey}
              selectable={!!selection}
              selectedKeys={selection?.selectedKeys}
              onSelectionChange={selection?.onSelectionChange}
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
