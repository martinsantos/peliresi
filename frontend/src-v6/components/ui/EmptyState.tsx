/**
 * SITREP v6 - Empty State Component
 * =================================
 * Estado vacío con ilustración y CTA
 */

import React from 'react';
import { FileQuestion, Search, FolderOpen, Inbox, FileText, Plus } from 'lucide-react';
import { Button } from './ButtonV2';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// TYPES
// ========================================
type EmptyIcon = 'search' | 'folder' | 'inbox' | 'file' | 'question';

interface EmptyStateProps {
  icon?: EmptyIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

// ========================================
// ICONS
// ========================================
const iconMap: Record<EmptyIcon, React.ReactNode> = {
  search: <Search size={48} />,
  folder: <FolderOpen size={48} />,
  inbox: <Inbox size={48} />,
  file: <FileText size={48} />,
  question: <FileQuestion size={48} />,
};

const iconStyles: Record<EmptyIcon, string> = {
  search: 'bg-info-50 text-info-500',
  folder: 'bg-warning-50 text-warning-500',
  inbox: 'bg-neutral-100 text-neutral-500',
  file: 'bg-primary-50 text-primary-500',
  question: 'bg-neutral-100 text-neutral-400',
};

// ========================================
// COMPONENT
// ========================================
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'question',
  title,
  description,
  action,
  secondaryAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-12 px-6',
        className
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-24 h-24 rounded-full flex items-center justify-center mb-6',
          iconStyles[icon]
        )}
      >
        {iconMap[icon]}
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-neutral-900 mb-2">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-neutral-600 max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              leftIcon={action.icon || <Plus size={18} />}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// ========================================
// PRESETS
// ========================================
export const NoResults: React.FC<{ onClear?: () => void }> = ({ onClear }) => (
  <EmptyState
    icon="search"
    title="No se encontraron resultados"
    description="Intenta ajustar los filtros o términos de búsqueda."
    action={onClear ? {
      label: 'Limpiar filtros',
      onClick: onClear,
    } : undefined}
  />
);

export const NoData: React.FC<{ onCreate?: () => void; itemName?: string }> = ({
  onCreate,
  itemName = 'elementos',
}) => (
  <EmptyState
    icon="folder"
    title={`No hay ${itemName} aún`}
    description={`Comienza creando tu primer ${itemName.slice(0, -1)}.`}
    action={onCreate ? {
      label: `Crear ${itemName.slice(0, -1)}`,
      onClick: onCreate,
    } : undefined}
  />
);

export const EmptyInbox: React.FC = () => (
  <EmptyState
    icon="inbox"
    title="Todo al día"
    description="No tienes notificaciones pendientes."
  />
);

export default EmptyState;
