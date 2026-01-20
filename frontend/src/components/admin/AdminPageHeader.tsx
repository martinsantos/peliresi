/**
 * AdminPageHeader - Unified page header for admin pages
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
 */

import React from 'react';
import './admin.css';

export interface AdminPageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  icon,
  title,
  subtitle,
  actions,
  className = '',
}) => {
  return (
    <div className={`admin-page-header ${className}`}>
      <div className="admin-page-header__content">
        <h1 className="admin-page-header__title">
          {icon && <span className="admin-page-header__icon">{icon}</span>}
          {title}
        </h1>
        {subtitle && (
          <p className="admin-page-header__subtitle">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="admin-page-header__actions">
          {actions}
        </div>
      )}
    </div>
  );
};

export default AdminPageHeader;
