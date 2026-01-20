/**
 * AdminBadge - Unified badge/pill component for admin pages
 * SITREP Design System v4.0 - NASA Control Room Aesthetic
 */

import React from 'react';
import './admin.css';

export type BadgeVariant =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  // Role-based variants
  | 'admin'
  | 'generador'
  | 'transportista'
  | 'operador'
  // Module-based variants
  | 'auth'
  | 'manifiestos'
  | 'reportes'
  | 'usuarios'
  | 'reversiones';

export type BadgeSize = 'xs' | 'sm' | 'md';

export interface AdminBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  // Semantic variants
  primary: {
    bg: 'var(--color-primary-surface, rgba(6, 182, 212, 0.15))',
    color: 'var(--color-primary-bright, #22d3ee)',
    border: 'var(--color-primary-dim, rgba(6, 182, 212, 0.3))',
  },
  success: {
    bg: 'var(--color-success-surface, rgba(16, 185, 129, 0.15))',
    color: 'var(--color-success-bright, #34d399)',
    border: 'var(--color-success-dim, rgba(16, 185, 129, 0.3))',
  },
  warning: {
    bg: 'var(--color-warning-surface, rgba(245, 158, 11, 0.15))',
    color: 'var(--color-warning-bright, #fbbf24)',
    border: 'var(--color-warning-dim, rgba(245, 158, 11, 0.3))',
  },
  danger: {
    bg: 'var(--color-danger-surface, rgba(239, 68, 68, 0.15))',
    color: 'var(--color-danger-bright, #f87171)',
    border: 'var(--color-danger-dim, rgba(239, 68, 68, 0.3))',
  },
  info: {
    bg: 'var(--color-accent-surface, rgba(139, 92, 246, 0.15))',
    color: 'var(--color-accent-bright, #a78bfa)',
    border: 'var(--color-accent-dim, rgba(139, 92, 246, 0.3))',
  },
  neutral: {
    bg: 'var(--color-bg-hover, rgba(100, 116, 139, 0.15))',
    color: 'var(--color-text-secondary, #cbd5e1)',
    border: 'var(--color-border-subtle, rgba(100, 116, 139, 0.3))',
  },

  // Role-based variants
  admin: {
    bg: 'var(--role-admin-surface, rgba(77, 159, 255, 0.15))',
    color: 'var(--role-admin, #4d9fff)',
    border: 'rgba(77, 159, 255, 0.3)',
  },
  generador: {
    bg: 'var(--role-generador-surface, rgba(167, 139, 250, 0.15))',
    color: 'var(--role-generador, #a78bfa)',
    border: 'rgba(167, 139, 250, 0.3)',
  },
  transportista: {
    bg: 'var(--role-transportista-surface, rgba(251, 191, 36, 0.15))',
    color: 'var(--role-transportista, #fbbf24)',
    border: 'rgba(251, 191, 36, 0.3)',
  },
  operador: {
    bg: 'var(--role-operador-surface, rgba(74, 222, 128, 0.15))',
    color: 'var(--role-operador, #4ade80)',
    border: 'rgba(74, 222, 128, 0.3)',
  },

  // Module-based variants (for audit logs)
  auth: {
    bg: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  manifiestos: {
    bg: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  reportes: {
    bg: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  usuarios: {
    bg: 'rgba(139, 92, 246, 0.15)',
    color: '#a78bfa',
    border: 'rgba(139, 92, 246, 0.3)',
  },
  reversiones: {
    bg: 'rgba(239, 68, 68, 0.15)',
    color: '#f87171',
    border: 'rgba(239, 68, 68, 0.3)',
  },
};

export const AdminBadge: React.FC<AdminBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'sm',
  icon,
  className = '',
}) => {
  const styles = variantStyles[variant];

  return (
    <span
      className={`admin-badge admin-badge--${size} ${className}`}
      style={{
        background: styles.bg,
        color: styles.color,
        borderColor: styles.border,
      }}
    >
      {icon && <span className="admin-badge__icon">{icon}</span>}
      {children}
    </span>
  );
};

// Helper function to get variant from role
export const getRoleVariant = (role: string): BadgeVariant => {
  const roleMap: Record<string, BadgeVariant> = {
    ADMIN: 'admin',
    GENERADOR: 'generador',
    TRANSPORTISTA: 'transportista',
    OPERADOR: 'operador',
  };
  return roleMap[role.toUpperCase()] || 'neutral';
};

// Helper function to get variant from module
export const getModuleVariant = (module: string): BadgeVariant => {
  const moduleMap: Record<string, BadgeVariant> = {
    AUTH: 'auth',
    MANIFIESTOS: 'manifiestos',
    REPORTES: 'reportes',
    USUARIOS: 'usuarios',
    REVERSIONES: 'reversiones',
  };
  return moduleMap[module.toUpperCase()] || 'neutral';
};

// Helper function to get variant from status
export const getStatusVariant = (status: string): BadgeVariant => {
  const statusMap: Record<string, BadgeVariant> = {
    ACTIVO: 'success',
    INACTIVO: 'danger',
    PENDIENTE: 'warning',
    APROBADO: 'success',
    RECHAZADO: 'danger',
  };
  return statusMap[status.toUpperCase()] || 'neutral';
};

export default AdminBadge;
