/**
 * AdminStatsGrid - Grid container for stat cards
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
 */

import React from 'react';
import './admin.css';

export interface AdminStatsGridProps {
  children: React.ReactNode;
  columns?: 2 | 3 | 4 | 'auto';
  className?: string;
}

export const AdminStatsGrid: React.FC<AdminStatsGridProps> = ({
  children,
  columns = 'auto',
  className = '',
}) => {
  const columnClass = columns === 'auto' ? '' : `admin-stats-grid--cols-${columns}`;

  return (
    <div className={`admin-stats-grid ${columnClass} ${className}`}>
      {children}
    </div>
  );
};

export default AdminStatsGrid;
