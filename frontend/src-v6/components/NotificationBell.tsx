/**
 * SITREP v6 - NotificationBell Component
 * =======================================
 * Bell icon with unread count badge and dropdown panel
 * showing recent alertas. Polls using React Query.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, AlertTriangle, Info, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { alertaService } from '../services/alerta.service';
import { getAccessToken } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { AlertaGenerada } from '../types/models';
import { EstadoAlerta, EventoAlerta } from '../types/models';

// ========================================
// HELPERS
// ========================================

type NotificationType = 'info' | 'warning' | 'error' | 'success';

function getNotificationType(alerta: AlertaGenerada): NotificationType {
  if (!alerta.regla) return 'info';
  switch (alerta.regla.evento) {
    case EventoAlerta.INCIDENTE:
    case EventoAlerta.RECHAZO_CARGA:
      return 'error';
    case EventoAlerta.DESVIO_RUTA:
    case EventoAlerta.TIEMPO_EXCESIVO:
    case EventoAlerta.DIFERENCIA_PESO:
    case EventoAlerta.ANOMALIA_GPS:
      return 'warning';
    case EventoAlerta.CAMBIO_ESTADO:
      return 'success';
    case EventoAlerta.VENCIMIENTO:
    default:
      return 'info';
  }
}

function getTypeIcon(type: NotificationType) {
  switch (type) {
    case 'error':
      return <AlertCircle size={16} className="text-error-500 shrink-0" />;
    case 'warning':
      return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
    case 'success':
      return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
    case 'info':
    default:
      return <Info size={16} className="text-primary-500 shrink-0" />;
  }
}

function getTypeBg(type: NotificationType): string {
  switch (type) {
    case 'error':
      return 'bg-error-50 border-error-100';
    case 'warning':
      return 'bg-amber-50 border-amber-100';
    case 'success':
      return 'bg-emerald-50 border-emerald-100';
    case 'info':
    default:
      return 'bg-primary-50 border-primary-100';
  }
}

function getTitle(alerta: AlertaGenerada): string {
  if (alerta.regla?.nombre) return alerta.regla.nombre;
  return 'Alerta del sistema';
}

function getMessage(alerta: AlertaGenerada): string {
  try {
    const datos = JSON.parse(alerta.datos);
    return datos.mensaje || datos.descripcion || datos.message || alerta.datos;
  } catch {
    return alerta.datos;
  }
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr}h`;
  if (diffDay < 7) return `Hace ${diffDay}d`;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

// ========================================
// COMPONENT
// ========================================

interface NotificationBellProps {
  /** Base path for navigation (e.g. '' for desktop, '/mobile' for mobile) */
  basePath?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ basePath = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  // Only poll when there is a valid JWT token (skip in demo mode)
  const hasToken = !!getAccessToken();

  const { data: alertasData } = useQuery({
    queryKey: ['alertas', 'notifications', { estado: EstadoAlerta.PENDIENTE, limit: 5 }],
    queryFn: () =>
      alertaService.listAlertas({ estado: EstadoAlerta.PENDIENTE, limit: 5 }),
    refetchInterval: hasToken ? 30_000 : false,
    staleTime: 15_000,
    enabled: hasToken && currentUser?.rol === 'ADMIN',
  });

  const alertas = Array.isArray(alertasData?.items) ? alertasData.items : (Array.isArray((alertasData as any)?.data) ? (alertasData as any).data : []);
  const totalCount = alertasData?.total ?? alertas.length;
  const unreadCount = currentUser?.rol === 'ADMIN' ? Math.min(totalCount, 99) : 0;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleBellClick = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleNotificationClick = useCallback(
    (alerta: AlertaGenerada) => {
      // Mark as resolved (read) silently
      alertaService.resolverAlerta(alerta.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      setIsOpen(false);

      // Navigate to the alerta detail or manifesto if available
      if (alerta.manifiestoId) {
        navigate(`${basePath}/manifiestos/${alerta.manifiestoId}`);
      } else {
        navigate(`${basePath}/alertas`);
      }
    },
    [navigate, queryClient, basePath]
  );

  const handleViewAll = useCallback(() => {
    setIsOpen(false);
    navigate(`${basePath}/alertas`);
  }, [navigate, basePath]);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleBellClick}
        className="relative p-2 rounded-xl hover:bg-neutral-100 transition-colors"
        aria-label={`Notificaciones${unreadCount > 0 ? ` (${unreadCount} sin leer)` : ''}`}
      >
        <Bell size={20} className="text-neutral-600" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-neutral-200 rounded-2xl shadow-xl z-50 animate-scale-in overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-neutral-900 text-sm">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-error-100 text-error-700 text-xs font-semibold rounded-full">
                  {totalCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {alertas.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={32} className="mx-auto text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-500">No hay notificaciones pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {(alertas as AlertaGenerada[]).map((alerta) => {
                  const type = getNotificationType(alerta);
                  const isUnread = alerta.estado === EstadoAlerta.PENDIENTE;

                  return (
                    <button
                      key={alerta.id}
                      onClick={() => handleNotificationClick(alerta)}
                      className={`
                        w-full text-left px-4 py-3 hover:bg-neutral-50 transition-colors
                        ${isUnread ? 'bg-neutral-25' : ''}
                      `}
                    >
                      <div className="flex gap-3">
                        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${getTypeBg(type)}`}>
                          {getTypeIcon(type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-tight truncate ${isUnread ? 'font-semibold text-neutral-900' : 'font-medium text-neutral-700'}`}>
                              {getTitle(alerta)}
                            </p>
                            {isUnread && (
                              <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {getMessage(alerta)}
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-1">
                            {formatTimeAgo(alerta.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-neutral-100 p-2">
            <button
              onClick={handleViewAll}
              className="w-full py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
            >
              Ver todas las alertas
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
