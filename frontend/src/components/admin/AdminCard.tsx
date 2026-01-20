/**
 * AdminCard - Generic card component for admin pages
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
 */

import React from 'react';
import './admin.css';

export interface AdminCardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  children,
  title,
  subtitle,
  icon,
  actions,
  variant = 'default',
  padding = 'md',
  className = '',
  onClick,
}) => {
  const isClickable = !!onClick;

  return (
    <div
      className={`admin-card admin-card--${variant} admin-card--padding-${padding} ${isClickable ? 'admin-card--clickable' : ''} ${className}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
    >
      {(title || actions) && (
        <div className="admin-card__header">
          <div className="admin-card__header-content">
            {icon && <span className="admin-card__header-icon">{icon}</span>}
            <div className="admin-card__header-text">
              {title && <h3 className="admin-card__title">{title}</h3>}
              {subtitle && <p className="admin-card__subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="admin-card__actions">{actions}</div>}
        </div>
      )}
      <div className="admin-card__body">
        {children}
      </div>
    </div>
  );
};

export default AdminCard;
