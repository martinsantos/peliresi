/**
 * AdminStatCard - Unified stat card component for admin pages
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
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
    border: 'var(--color-primary)',
    iconBg: 'var(--color-primary-surface, rgba(6, 182, 212, 0.12))',
    iconColor: 'var(--color-primary-bright, #22d3ee)',
  },
  success: {
    border: 'var(--color-success)',
    iconBg: 'var(--color-success-surface, rgba(16, 185, 129, 0.12))',
    iconColor: 'var(--color-success-bright, #34d399)',
  },
  warning: {
    border: 'var(--color-warning)',
    iconBg: 'var(--color-warning-surface, rgba(245, 158, 11, 0.12))',
    iconColor: 'var(--color-warning-bright, #fbbf24)',
  },
  danger: {
    border: 'var(--color-danger)',
    iconBg: 'var(--color-danger-surface, rgba(239, 68, 68, 0.12))',
    iconColor: 'var(--color-danger-bright, #f87171)',
  },
  info: {
    border: 'var(--color-accent, #8b5cf6)',
    iconBg: 'var(--color-accent-surface, rgba(139, 92, 246, 0.12))',
    iconColor: 'var(--color-accent-bright, #a78bfa)',
  },
  neutral: {
    border: 'var(--color-border-default, #334155)',
    iconBg: 'var(--color-bg-hover, #232c3a)',
    iconColor: 'var(--color-text-secondary, #cbd5e1)',
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
