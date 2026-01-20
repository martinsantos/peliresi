/**
 * AdminPagination - Unified pagination component for admin pages
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './admin.css';

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  showInfo?: boolean;
  className?: string;
}

export const AdminPagination: React.FC<AdminPaginationProps> = ({
  page,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  showInfo = true,
  className = '',
}) => {
  const startItem = (page - 1) * itemsPerPage + 1;
  const endItem = Math.min(page * itemsPerPage, totalItems);

  const handlePrevious = () => {
    if (page > 1) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      onPageChange(page + 1);
    }
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className={`admin-pagination ${className}`}>
      {showInfo && (
        <span className="admin-pagination__info">
          Mostrando {startItem.toLocaleString('es-AR')}-{endItem.toLocaleString('es-AR')} de{' '}
          {totalItems.toLocaleString('es-AR')}
        </span>
      )}

      <div className="admin-pagination__controls">
        <button
          className="admin-pagination__btn"
          onClick={handlePrevious}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          <ChevronLeft size={18} />
          <span className="admin-pagination__btn-text">Anterior</span>
        </button>

        <span className="admin-pagination__current">
          Página {page} de {totalPages}
        </span>

        <button
          className="admin-pagination__btn"
          onClick={handleNext}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          <span className="admin-pagination__btn-text">Siguiente</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default AdminPagination;
