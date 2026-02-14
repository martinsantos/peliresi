/**
 * SITREP v6 - Notificaciones Page
 * ================================
 * Centro de notificaciones del usuario
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { useNotificaciones, useMarcarLeida, useMarcarTodasLeidas } from '../../hooks/useNotificaciones';
import { formatRelativeTime } from '../../utils/formatters';

const getIconByType = (tipo: string) => {
  switch (tipo) {
    case 'success':
      return <CheckCircle2 className="text-success-500" size={20} />;
    case 'warning':
      return <AlertTriangle className="text-warning-500" size={20} />;
    case 'info':
    default:
      return <Info className="text-info-500" size={20} />;
  }
};

const getBgByType = (tipo: string) => {
  switch (tipo) {
    case 'success':
      return 'bg-success-50';
    case 'warning':
      return 'bg-warning-50';
    case 'info':
    default:
      return 'bg-info-50';
  }
};


const NotificacionesPage: React.FC = () => {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState<'todas' | 'no-leidas'>('todas');

  // Real API hooks
  const { data: apiData, isLoading } = useNotificaciones({ leida: filtro === 'no-leidas' ? false : undefined });
  const marcarLeidaMutation = useMarcarLeida();
  const marcarTodasMutation = useMarcarTodasLeidas();

  const notificaciones = useMemo(() => {
    const items = apiData?.items || [];
    return items.map((n: any) => ({
      id: n.id,
      tipo: n.tipo?.includes('RECHAZ') || n.tipo?.includes('INCIDENTE') ? 'warning' :
            n.tipo?.includes('TRATADO') || n.tipo?.includes('RECIBIDO') ? 'success' : 'info',
      titulo: n.titulo,
      mensaje: n.mensaje,
      fecha: new Date(n.createdAt),
      leida: n.leida,
    }));
  }, [apiData]);

  const notificacionesFiltradas = notificaciones;

  const marcarLeida = (id: number | string) => {
    marcarLeidaMutation.mutate(String(id));
  };

  const marcarTodasLeidas = () => {
    marcarTodasMutation.mutate();
  };

  const eliminarNotificacion = (_id: number | string) => {
    // Deletion handled by API when available
  };

  const noLeidasCount = notificaciones.filter(n => !n.leida).length;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-neutral-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Notificaciones</h2>
            <p className="text-neutral-600 mt-1">
              Centro de notificaciones del sistema
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {noLeidasCount > 0 && (
            <Button 
              variant="outline" 
              leftIcon={<CheckCheck size={18} />}
              onClick={marcarTodasLeidas}
            >
              Marcar todas leídas
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-neutral-200">
        <button
          onClick={() => setFiltro('todas')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            filtro === 'todas' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          Todas
          <Badge variant="soft" color="neutral" className="ml-2">
            {notificaciones.length}
          </Badge>
        </button>
        <button
          onClick={() => setFiltro('no-leidas')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            filtro === 'no-leidas' 
              ? 'border-primary-500 text-primary-600' 
              : 'border-transparent text-neutral-600 hover:text-neutral-900'
          }`}
        >
          No leídas
          {noLeidasCount > 0 && (
            <Badge variant="soft" color="primary" className="ml-2">
              {noLeidasCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Lista de notificaciones */}
      <div className="space-y-3">
        {notificacionesFiltradas.length === 0 ? (
          <Card className="py-16">
            <div className="text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="text-neutral-400" size={24} />
              </div>
              <h3 className="text-lg font-medium text-neutral-900 mb-1">
                No hay notificaciones
              </h3>
              <p className="text-neutral-600">
                {filtro === 'no-leidas' 
                  ? 'Todas las notificaciones han sido leídas'
                  : 'No tienes notificaciones en este momento'
                }
              </p>
            </div>
          </Card>
        ) : (
          notificacionesFiltradas.map((notif) => (
            <Card 
              key={notif.id}
              className={`transition-all ${!notif.leida ? 'border-primary-200 bg-primary-50/30' : ''}`}
            >
              <div className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div className={`w-10 h-10 ${getBgByType(notif.tipo)} rounded-full flex items-center justify-center flex-shrink-0`}>
                  {getIconByType(notif.tipo)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className={`font-medium ${!notif.leida ? 'text-neutral-900' : 'text-neutral-700'}`}>
                        {notif.titulo}
                        {!notif.leida && (
                          <span className="ml-2 inline-block w-2 h-2 bg-primary-500 rounded-full" />
                        )}
                      </h4>
                      <p className="text-sm text-neutral-600 mt-1">
                        {notif.mensaje}
                      </p>
                      <span className="text-xs text-neutral-500 mt-2 block">
                        {formatRelativeTime(notif.fecha instanceof Date ? notif.fecha.toISOString() : notif.fecha)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!notif.leida && (
                    <button
                      onClick={() => marcarLeida(notif.id)}
                      className="p-2 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Marcar como leída"
                    >
                      <Check size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => eliminarNotificacion(notif.id)}
                    className="p-2 text-neutral-400 hover:text-error-500 hover:bg-error-50 rounded-lg transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificacionesPage;
