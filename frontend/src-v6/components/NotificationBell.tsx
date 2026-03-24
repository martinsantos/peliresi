/**
 * SITREP v6 - NotificationBell Component
 * =======================================
 * Bell icon with unread count badge and dropdown panel
 * showing recent notifications. Polls using React Query.
 * Works for all roles (ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Info, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificacionService } from '../services/notificacion.service';
import { getAccessToken } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Notificacion } from '../types/models';
import { TipoNotificacion } from '../types/models';

// ========================================
// HELPERS
// ========================================

type NotificationType = 'info' | 'warning' | 'error' | 'success';

function getNotificationType(notif: Notificacion): NotificationType {
  switch (notif.tipo) {
    case TipoNotificacion.INCIDENTE_REPORTADO:
    case TipoNotificacion.MANIFIESTO_RECHAZADO:
    case TipoNotificacion.VENCIMIENTO_PROXIMO:
      return 'error';
    case TipoNotificacion.ANOMALIA_DETECTADA:
    case TipoNotificacion.ALERTA_SISTEMA:
      return 'warning';
    case TipoNotificacion.MANIFIESTO_FIRMADO:
    case TipoNotificacion.MANIFIESTO_EN_TRANSITO:
    case TipoNotificacion.MANIFIESTO_ENTREGADO:
    case TipoNotificacion.MANIFIESTO_RECIBIDO:
    case TipoNotificacion.MANIFIESTO_TRATADO:
      return 'success';
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

  const hasToken = !!getAccessToken();

  // Fetch últimas 5 sin filtrar por leída; badge usa noLeidas del response
  const { data } = useQuery({
    queryKey: ['notificaciones', 'bell'],
    queryFn: () => notificacionService.list({ limit: 5 }),
    refetchInterval: hasToken ? 30_000 : false,
    staleTime: 15_000,
    enabled: hasToken && !!currentUser,
  });

  const items: Notificacion[] = data?.items ?? [];
  // noLeidas viene en data.noLeidas via service; fallback a contar items no leídos
  const unreadCount = Math.min((data as any)?.noLeidas ?? items.filter(i => !i.leida).length, 99);

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
    (notif: Notificacion) => {
      notificacionService.marcarLeida(notif.id).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['notificaciones'] });
      setIsOpen(false);

      // Notificaciones de nuevo registro → ir a gestión de usuarios
      const datos = notif.datos ? (() => { try { return JSON.parse(notif.datos!); } catch { return null; } })() : null;
      if (datos?.tipo === 'nuevo_registro') {
        navigate(`${basePath}/admin/usuarios`);
      } else if (notif.manifiestoId) {
        navigate(`${basePath}/manifiestos/${notif.manifiestoId}`);
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
                  {unreadCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-400 transition-colors"
              aria-label="Cerrar notificaciones"
            >
              <X size={16} />
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={32} className="mx-auto text-neutral-300 mb-2" />
                <p className="text-sm text-neutral-500">No hay notificaciones pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {items.map((notif) => {
                  const type = getNotificationType(notif);
                  const isUnread = !notif.leida;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
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
                              {notif.titulo}
                            </p>
                            {isUnread && (
                              <span className="w-2 h-2 bg-primary-500 rounded-full shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {notif.mensaje}
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-1">
                            {formatTimeAgo(notif.createdAt)}
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
