/**
 * SITREP v6 - User Switcher Component
 * ====================================
 * Componente para cambiar entre usuarios de demo
 */

import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Users, 
  Shield, 
  Factory, 
  Truck, 
  Building2, 
  User, 
  Check,
  ChevronDown,
  X
} from 'lucide-react';
import { useAuth, MOCK_USERS } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import { Button } from './ButtonV2';
import { Badge } from './BadgeV2';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ========================================
// CONFIGURACIÓN DE ROLES
// ========================================
const roleConfig: Record<UserRole, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  ADMIN: { 
    label: 'Administrador', 
    icon: Shield, 
    color: 'text-primary-700',
    bgColor: 'bg-primary-100',
    borderColor: 'border-primary-200'
  },
  GENERADOR: { 
    label: 'Generador', 
    icon: Factory, 
    color: 'text-purple-700',
    bgColor: 'bg-purple-100',
    borderColor: 'border-purple-200'
  },
  TRANSPORTISTA: { 
    label: 'Transportista', 
    icon: Truck, 
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    borderColor: 'border-orange-200'
  },
  OPERADOR: { 
    label: 'Operador', 
    icon: Building2, 
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-200'
  },
  AUDITOR: { 
    label: 'Auditor', 
    icon: User, 
    color: 'text-info-700',
    bgColor: 'bg-info-100',
    borderColor: 'border-info-200'
  },
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
interface UserSwitcherProps {
  variant?: 'dropdown' | 'modal' | 'sidebar';
  className?: string;
}

export const UserSwitcher: React.FC<UserSwitcherProps> = ({ 
  variant = 'dropdown',
  className 
}) => {
  const { currentUser, users, switchUser, getUsersByRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');

  const currentConfig = roleConfig[currentUser.rol];
  const CurrentIcon = currentConfig.icon;

  const filteredUsers = selectedRole === 'all' 
    ? users 
    : getUsersByRole(selectedRole);

  const [isSwitching, setIsSwitching] = useState(false);

  const handleSwitch = (userId: number) => {
    if (userId === currentUser.id) {
      setIsOpen(false);
      return;
    }
    setIsSwitching(true);
    setIsOpen(false);
    // Breve feedback visual antes del cambio
    setTimeout(() => {
      switchUser(userId);
      setIsSwitching(false);
    }, 150);
  };

  // ========================================
  // VARIANTE: DROPDOWN (para header)
  // ========================================
  if (variant === 'dropdown') {
    return (
      <div className={cn('relative', className)}>
        {isSwitching && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-2xl p-6 shadow-4 flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-neutral-700 font-medium">Cambiando usuario...</p>
            </div>
          </div>
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isSwitching}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl transition-all',
            'border-2 hover:shadow-md',
            currentConfig.bgColor,
            currentConfig.borderColor,
            isSwitching && 'opacity-50 cursor-not-allowed'
          )}
        >
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-sm',
            'bg-white/80',
            currentConfig.color
          )}>
            {currentUser.avatar}
          </div>
          <div className="hidden md:block text-left">
            <p className={cn('text-sm font-semibold', currentConfig.color)}>
              {currentUser.nombre}
            </p>
            <p className="text-xs text-neutral-500">
              {currentConfig.label}
            </p>
          </div>
          <ChevronDown size={16} className={cn('ml-1', currentConfig.color)} />
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-4 border border-neutral-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              {/* Header */}
              <div className={cn('p-4 border-b', currentConfig.bgColor, currentConfig.borderColor)}>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70">
                  Usuario Actual
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center font-bold text-lg">
                    {currentUser.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-900">{currentUser.nombre}</p>
                    <div className="flex items-center gap-1">
                      <CurrentIcon size={12} className={currentConfig.color} />
                      <span className={cn('text-xs', currentConfig.color)}>
                        {currentConfig.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filtros por rol */}
              <div className="p-3 border-b border-neutral-100">
                <p className="text-xs font-semibold text-neutral-500 uppercase mb-2">
                  Filtrar por rol
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setSelectedRole('all')}
                    className={cn(
                      'px-2 py-1 rounded-lg text-xs font-medium transition-colors',
                      selectedRole === 'all' 
                        ? 'bg-neutral-800 text-white' 
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    )}
                  >
                    Todos
                  </button>
                  {(Object.keys(roleConfig) as UserRole[]).map((role) => {
                    const config = roleConfig[role];
                    const Icon = config.icon;
                    return (
                      <button
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        className={cn(
                          'px-2 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1',
                          selectedRole === role
                            ? config.bgColor + ' ' + config.color
                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                        )}
                      >
                        <Icon size={10} />
                        {config.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de usuarios */}
              <div className="max-h-80 overflow-y-auto">
                <p className="px-3 py-2 text-xs font-semibold text-neutral-500 uppercase">
                  Cambiar a:
                </p>
                {filteredUsers.map((user) => {
                  const config = roleConfig[user.rol];
                  const Icon = config.icon;
                  const isCurrent = user.id === currentUser.id;

                  return (
                    <button
                      key={user.id}
                      onClick={() => handleSwitch(user.id)}
                      disabled={isCurrent}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-3 transition-colors text-left',
                        isCurrent 
                          ? 'bg-neutral-50 cursor-default' 
                          : 'hover:bg-neutral-50'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm',
                        config.bgColor,
                        config.color
                      )}>
                        {user.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'font-medium truncate',
                          isCurrent ? 'text-neutral-900' : 'text-neutral-700'
                        )}>
                          {user.nombre}
                        </p>
                        <div className="flex items-center gap-1">
                          <Icon size={10} className={config.color} />
                          <span className="text-xs text-neutral-500 truncate">
                            {user.sector}
                          </span>
                        </div>
                      </div>
                      {isCurrent && (
                        <Check size={16} className="text-success-500" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-neutral-100 bg-neutral-50">
                <p className="text-xs text-neutral-500 text-center">
                  {filteredUsers.length} usuarios disponibles
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ========================================
  // VARIANTE: MODAL (para página dedicada)
  // ========================================
  if (variant === 'modal') {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Usuario Actual */}
        <div className={cn(
          'p-4 rounded-2xl border-2',
          currentConfig.bgColor,
          currentConfig.borderColor
        )}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center text-2xl font-bold shadow-sm">
              {currentUser.avatar}
            </div>
            <div>
              <p className="text-sm text-neutral-500">Usuario Actual</p>
              <h3 className="text-xl font-bold text-neutral-900">{currentUser.nombre}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="soft" color={
                  currentUser.rol === 'ADMIN' ? 'primary' :
                  currentUser.rol === 'GENERADOR' ? 'purple' :
                  currentUser.rol === 'TRANSPORTISTA' ? 'orange' :
                  currentUser.rol === 'OPERADOR' ? 'green' : 'info'
                }>
                  <CurrentIcon size={12} className="mr-1" />
                  {currentConfig.label}
                </Badge>
                <span className="text-sm text-neutral-500">• {currentUser.sector}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selector por categorías */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-700 uppercase tracking-wider">
            Seleccionar Perfil
          </p>
          
          {(Object.keys(roleConfig) as UserRole[]).map((role) => {
            const config = roleConfig[role];
            const Icon = config.icon;
            const roleUsers = getUsersByRole(role);

            return (
              <div key={role} className="space-y-2">
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  config.bgColor
                )}>
                  <Icon size={18} className={config.color} />
                  <span className={cn('font-semibold', config.color)}>
                    {config.label}s
                  </span>
                  <Badge variant="soft" color="neutral" size="sm">
                    {roleUsers.length}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                  {roleUsers.map((user) => {
                    const isCurrent = user.id === currentUser.id;
                    return (
                      <button
                        key={user.id}
                        onClick={() => handleSwitch(user.id)}
                        disabled={isCurrent}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left',
                          isCurrent
                            ? 'border-success-300 bg-success-50'
                            : 'border-neutral-200 hover:border-primary-300 hover:shadow-md bg-white'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center font-semibold',
                          config.bgColor,
                          config.color
                        )}>
                          {user.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 truncate">
                            {user.nombre}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">
                            {user.sector}
                          </p>
                        </div>
                        {isCurrent ? (
                          <Badge variant="solid" color="success" size="sm">
                            Activo
                          </Badge>
                        ) : (
                          <ChevronDown size={16} className="text-neutral-400 rotate-[-90deg]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ========================================
  // VARIANTE: SIDEBAR (compacta)
  // ========================================
  return (
    <div className={cn('space-y-2', className)}>
      <p className="px-3 text-xs font-semibold text-neutral-500 uppercase">
        Cambiar Usuario
      </p>
      {users.map((user) => {
        const config = roleConfig[user.rol];
        const Icon = config.icon;
        const isCurrent = user.id === currentUser.id;

        return (
          <button
            key={user.id}
            onClick={() => handleSwitch(user.id)}
            disabled={isCurrent}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left',
              isCurrent
                ? 'bg-primary-100 text-primary-700'
                : 'hover:bg-neutral-100 text-neutral-600'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold',
              config.bgColor,
              config.color
            )}>
              {user.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.nombre}</p>
            </div>
            {isCurrent && <Check size={14} />}
          </button>
        );
      })}
    </div>
  );
};

export default UserSwitcher;
