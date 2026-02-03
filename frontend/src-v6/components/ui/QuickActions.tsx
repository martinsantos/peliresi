/**
 * SITREP v6 - Quick Actions Component
 * ====================================
 * Sistema consistente de acciones rápidas
 */

import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardContent } from './CardV2';

interface QuickAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
}

/**
 * Sistema consistente de Acciones Rápidas
 * 
 * Uso:
 * <QuickActions 
 *   title="Acciones Rápidas"
 *   actions={[
 *     { icon: FileText, label: 'Ver Manifiestos', onClick: () => {} },
 *     { icon: MapPin, label: 'Tracking', onClick: () => {} },
 *   ]}
 * />
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  title = 'Acciones Rápidas',
  actions,
}) => {
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent className="space-y-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const variantStyles = {
            default: 'border-neutral-200 text-neutral-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/50',
            primary: 'border-primary-200 text-primary-700 hover:border-primary-500 hover:bg-primary-50',
            danger: 'border-error-200 text-error-700 hover:border-error-500 hover:bg-error-50',
          };
          
          const iconColors = {
            default: 'text-neutral-400 group-hover:text-primary-500',
            primary: 'text-primary-500',
            danger: 'text-error-500',
          };

          return (
            <button
              key={index}
              onClick={action.onClick}
              className={`
                w-full flex items-center justify-between 
                px-4 py-3 bg-white border rounded-xl 
                text-sm font-medium
                transition-all duration-200
                group
                ${variantStyles[action.variant || 'default']}
              `}
            >
              <span className="flex items-center gap-3">
                <Icon size={18} className={`transition-colors ${iconColors[action.variant || 'default']}`} />
                {action.label}
              </span>
              <ArrowRight 
                size={16} 
                className={`
                  transition-all duration-200
                  group-hover:translate-x-1
                  ${action.variant === 'danger' 
                    ? 'text-error-300 group-hover:text-error-500' 
                    : 'text-neutral-300 group-hover:text-primary-500'}
                `} 
              />
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
};

/**
 * Versión compacta para usar en espacios reducidos
 */
interface QuickActionsCompactProps {
  actions: QuickAction[];
}

export const QuickActionsCompact: React.FC<QuickActionsCompactProps> = ({ actions }) => {
  return (
    <div className="grid grid-cols-2 gap-2">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <button
            key={index}
            onClick={action.onClick}
            className="
              flex items-center justify-center gap-2 
              px-3 py-2.5 
              bg-white border border-neutral-200 
              rounded-xl text-sm font-medium text-neutral-700 
              hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/30
              active:scale-[0.98]
              transition-all
            "
          >
            <Icon size={16} />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickActions;
