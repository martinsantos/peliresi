/**
 * AdminStatCard - Unified stat card component for admin pages
 * SITREP Design System v5.0 - Versión Humanista
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import './admin.css';

export type StatVariant = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface AdminStatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  variant?: StatVariant;
  trend?: {
    value: number;
    label?: string;
  };
  onClick?: () => void;
  className?: string;
}

const variantColors: Record<StatVariant, { border: string; iconBg: string; iconColor: string }> = {
  primary: {
    border: 'var(--color-primary, #1B5E3C)',
    iconBg: 'var(--color-primary-lightest, #E8F5E9)',
    iconColor: 'var(--color-primary, #1B5E3C)',
  },
  success: {
    border: 'var(--color-success, #059669)',
    iconBg: 'var(--color-success-lightest, #D1FAE5)',
    iconColor: 'var(--color-success-dark, #047857)',
  },
  warning: {
    border: 'var(--color-warning, #D97706)',
    iconBg: 'var(--color-warning-lightest, #FEF3C7)',
    iconColor: 'var(--color-warning-dark, #B45309)',
  },
  danger: {
    border: 'var(--color-danger, #DC2626)',
    iconBg: 'var(--color-danger-lightest, #FEE2E2)',
    iconColor: 'var(--color-danger-dark, #B91C1C)',
  },
  info: {
    border: 'var(--color-secondary, #2563EB)',
    iconBg: 'var(--color-secondary-lightest, #EFF6FF)',
    iconColor: 'var(--color-secondary-dark, #1D4ED8)',
  },
  neutral: {
    border: 'var(--color-border-default, #E0E0E0)',
    iconBg: 'var(--color-bg-hover, #F5F5F3)',
    iconColor: 'var(--color-text-muted, #606060)',
  },
};

export const AdminStatCard: React.FC<AdminStatCardProps> = ({
  icon,
  value,
  label,
  variant = 'primary',
  trend,
  onClick,
  className = '',
}) => {
  const colors = variantColors[variant];
  const isClickable = !!onClick;

  return (
    <div
      className={`admin-stat-card ${isClickable ? 'admin-stat-card--clickable' : ''} ${className}`}
      style={{ '--stat-border-color': colors.border } as React.CSSProperties}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onClick?.() : undefined}
    >
      <div
        className="admin-stat-card__icon"
        style={{
          background: colors.iconBg,
          color: colors.iconColor,
        }}
      >
        {icon}
      </div>
      <div className="admin-stat-card__content">
        <span className="admin-stat-card__value">
          {typeof value === 'number' ? value.toLocaleString('es-AR') : value}
        </span>
        <span className="admin-stat-card__label">{label}</span>
        {trend && (
          <div
            className={`admin-stat-card__trend ${trend.value >= 0 ? 'admin-stat-card__trend--up' : 'admin-stat-card__trend--down'}`}
          >
            {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>
              {trend.value >= 0 ? '+' : ''}
              {trend.value}%
              {trend.label && <span className="admin-stat-card__trend-label"> {trend.label}</span>}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminStatCard;
