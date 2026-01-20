/**
 * AdminFilterPanel - Collapsible filter panel for admin pages
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
 */

import React from 'react';
import { Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './admin.css';

export interface AdminFilterPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const AdminFilterPanel: React.FC<AdminFilterPanelProps> = ({
  isOpen,
  onToggle,
  children,
  title = 'Filtros',
  className = '',
}) => {
  return (
    <div className={`admin-filter-panel ${className}`}>
      <button
        className={`admin-filter-panel__toggle ${isOpen ? 'admin-filter-panel__toggle--active' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="filter-content"
      >
        <Filter size={18} />
        <span>{title}</span>
        {isOpen && <X size={16} className="admin-filter-panel__close-icon" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="filter-content"
            className="admin-filter-panel__content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="admin-filter-panel__inner">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFilterPanel;
