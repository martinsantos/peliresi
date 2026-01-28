/**
 * AdminBadge - Unified badge/pill component for admin pages
 * SITREP Design System v5.0 - Versión Humanista
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
  // Semantic variants - Humanist Light Theme
  primary: {
    bg: 'var(--color-primary-lightest, #E8F5E9)',
    color: 'var(--color-primary, #1B5E3C)',
    border: 'transparent',
  },
  success: {
    bg: 'var(--color-success-lightest, #D1FAE5)',
    color: 'var(--color-success-dark, #047857)',
    border: 'transparent',
  },
  warning: {
    bg: 'var(--color-warning-lightest, #FEF3C7)',
    color: 'var(--color-warning-dark, #B45309)',
    border: 'transparent',
  },
  danger: {
    bg: 'var(--color-danger-lightest, #FEE2E2)',
    color: 'var(--color-danger-dark, #B91C1C)',
    border: 'transparent',
  },
  info: {
    bg: 'var(--color-secondary-lightest, #EFF6FF)',
    color: 'var(--color-secondary-dark, #1D4ED8)',
    border: 'transparent',
  },
  neutral: {
    bg: 'var(--color-bg-hover, #F5F5F3)',
    color: 'var(--color-text-muted, #606060)',
    border: 'transparent',
  },

  // Role-based variants - Humanist
  admin: {
    bg: 'var(--role-admin-surface, rgba(37, 99, 235, 0.08))',
    color: 'var(--role-admin, #2563EB)',
    border: 'transparent',
  },
  generador: {
    bg: 'var(--role-generador-surface, rgba(124, 58, 237, 0.08))',
    color: 'var(--role-generador, #7C3AED)',
    border: 'transparent',
  },
  transportista: {
    bg: 'var(--role-transportista-surface, rgba(217, 119, 6, 0.08))',
    color: 'var(--role-transportista, #D97706)',
    border: 'transparent',
  },
  operador: {
    bg: 'var(--role-operador-surface, rgba(5, 150, 105, 0.08))',
    color: 'var(--role-operador, #059669)',
    border: 'transparent',
  },

  // Module-based variants (for audit logs)
  auth: {
    bg: '#EFF6FF',
    color: '#2563EB',
    border: 'transparent',
  },
  manifiestos: {
    bg: '#E8F5E9',
    color: '#1B5E3C',
    border: 'transparent',
  },
  reportes: {
    bg: '#FEF3C7',
    color: '#B45309',
    border: 'transparent',
  },
  usuarios: {
    bg: '#F3E8FF',
    color: '#7C3AED',
    border: 'transparent',
  },
  reversiones: {
    bg: '#FEE2E2',
    color: '#B91C1C',
    border: 'transparent',
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
