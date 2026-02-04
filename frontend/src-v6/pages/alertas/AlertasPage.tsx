/**
 * SITREP v6 - Alertas Page
 * ========================
 * Gestion de alertas y notificaciones - Real API + fallback mock
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Trash2,
  Check,
  AlertCircle,
  Info,
  X,
  Loader2
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useAlertas, useResolverAlerta } from '../../hooks/useAlertas';
import { alertaService } from '../../services/alerta.service';
import { formatRelativeTime } from '../../utils/formatters';

// Local alert shape used by UI
interface AlertaLocal {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  accion: string;
}


const tipoConfig = {
  critical: { label: 'Critica', icon: AlertCircle, color: 'error', bgColor: 'bg-error-50', borderColor: 'border-error-200', textColor: 'text-error-800' },
  warning: { label: 'Advertencia', icon: AlertTriangle, color: 'warning', bgColor: 'bg-warning-50', borderColor: 'border-warning-200', textColor: 'text-warning-800' },
  info: { label: 'Informacion', icon: Info, color: 'info', bgColor: 'bg-info-50', borderColor: 'border-info-200', textColor: 'text-info-800' },
  success: { label: 'Exito', icon: CheckCircle, color: 'success', bgColor: 'bg-success-50', borderColor: 'border-success-200', textColor: 'text-success-800' },
};

export const AlertasPage: React.FC = () => {
  const navigate = useNavigate();
  // Real API data
  const { data: apiAlertas, isLoading, isError } = useAlertas();
  const resolverMutation = useResolverAlerta();

  // Local state for optimistic updates
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  // Use only API data
  const alertas: AlertaLocal[] = useMemo(() => {
    const items = Array.isArray(apiAlertas?.items) ? apiAlertas.items : [];
    return items
      .filter((a: any) => !deletedIds.has(a.id))
      .map((a: any) => ({
        id: a.id,
        tipo: a.estado === 'PENDIENTE' ? 'critical' : a.estado === 'EN_REVISION' ? 'warning' : 'success',
        titulo: a.regla?.nombre || 'Alerta',
        mensaje: (() => {
          try {
            return typeof a.datos === 'string' ? (JSON.parse(a.datos)?.descripcion || a.datos) : 'Sin detalles';
          } catch {
            return String(a.datos || 'Sin detalles');
          }
        })(),
        fecha: a.createdAt,
        leida: a.estado !== 'PENDIENTE' || resolvedIds.has(a.id),
        accion: 'Ver detalles',
      }));
  }, [apiAlertas, deletedIds, resolvedIds]);

  const [filtroTipo, setFiltroTipo] = useState<string>('todas');
  const [filtroLeidas, setFiltroLeidas] = useState<string>('todas');
  const [showClearModal, setShowClearModal] = useState(false);

  const alertasFiltradas = alertas.filter(alerta => {
    const matchTipo = filtroTipo === 'todas' || alerta.tipo === filtroTipo;
    const matchLeidas = filtroLeidas === 'todas' ||
      (filtroLeidas === 'leidas' && alerta.leida) ||
      (filtroLeidas === 'no-leidas' && !alerta.leida);
    return matchTipo && matchLeidas;
  });

  const noLeidasCount = alertas.filter(a => !a.leida).length;

  const marcarComoLeida = (id: string) => {
    resolverMutation.mutate(
      { id, notas: 'Marcada como leida' },
      {
        onSuccess: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.success('Alerta resuelta', 'La alerta fue marcada como leida');
        },
        onError: () => {
          setResolvedIds(prev => new Set(prev).add(id));
          toast.error('Error', 'No se pudo marcar la alerta como leida');
        },
      }
    );
  };

  const marcarTodasComoLeidas = () => {
    // For each unread alert, try to resolve via API
    const noLeidas = alertas.filter(a => !a.leida);
    let resolved = 0;
    noLeidas.forEach(a => {
      resolverMutation.mutate(
        { id: a.id, notas: 'Marcada como leida (batch)' },
        {
          onSuccess: () => {
            resolved++;
            setResolvedIds(prev => new Set(prev).add(a.id));
          },
          onError: () => {
            setResolvedIds(prev => new Set(prev).add(a.id));
          },
        }
      );
    });
    toast.success('Alertas marcadas', 'Todas las alertas fueron marcadas como leidas');
  };

  const eliminarAlerta = (id: string) => {
    alertaService.resolverAlerta(id, 'Eliminada por usuario').then(() => {
      setDeletedIds(prev => new Set(prev).add(id));
      toast.success('Alerta eliminada', 'La alerta fue eliminada correctamente');
    }).catch(() => {
      setDeletedIds(prev => new Set(prev).add(id));
      toast.error('Error', 'No se pudo eliminar la alerta en el servidor');
    });
  };

  const limpiarTodas = () => {
    const allIds = new Set(alertas.map(a => a.id));
    setDeletedIds(allIds);
    setShowClearModal(false);
    toast.success('Alertas limpiadas', 'Todas las alertas fueron eliminadas');
  };


  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bell size={28} className="text-neutral-700" />
            {noLeidasCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {noLeidasCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Alertas</h2>
            <p className="text-neutral-600">
              {isLoading ? (
                <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando alertas...</span>
              ) : (
                <>{noLeidasCount} alertas sin leer de {alertas.length} totales {isError ? '(error al cargar)' : ''}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            leftIcon={<Check size={18} />}
            onClick={marcarTodasComoLeidas}
            disabled={noLeidasCount === 0}
          >
            Marcar todas
          </Button>
          <Button
            variant="outline"
            leftIcon={<Trash2 size={18} />}
            onClick={() => setShowClearModal(true)}
            disabled={alertas.length === 0}
          >
            Limpiar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card padding="base">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-neutral-400" />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="todas">Todas las alertas</option>
              <option value="critical">Criticas</option>
              <option value="warning">Advertencias</option>
              <option value="info">Informacion</option>
              <option value="success">Exito</option>
            </select>
          </div>
          <select
            value={filtroLeidas}
            onChange={(e) => setFiltroLeidas(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="todas">Todas</option>
            <option value="no-leidas">No leidas</option>
            <option value="leidas">Leidas</option>
          </select>
        </div>
      </Card>

      {/* Lista de alertas */}
      <div className="space-y-3">
        {alertasFiltradas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell size={32} className="text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900 mb-2">No hay alertas</h3>
              <p className="text-neutral-600">No se encontraron alertas con los filtros seleccionados</p>
            </CardContent>
          </Card>
        ) : (
          alertasFiltradas.map((alerta) => {
            const config = tipoConfig[alerta.tipo as keyof typeof tipoConfig];
            const Icon = config?.icon || Info;

            return (
              <div
                key={alerta.id}
                className={`
                  relative p-4 rounded-xl border-l-4 transition-all
                  ${config?.bgColor || 'bg-neutral-50'} ${config?.borderColor || 'border-neutral-200'}
                  ${!alerta.leida ? 'shadow-sm' : 'opacity-75'}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg bg-white ${config?.textColor || 'text-neutral-800'}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-semibold ${config?.textColor || 'text-neutral-800'}`}>{alerta.titulo}</h4>
                          {!alerta.leida && (
                            <Badge variant="solid" color={config?.color as any || 'neutral'} size="sm">
                              Nueva
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${config?.textColor || 'text-neutral-800'} opacity-90`}>
                          {alerta.mensaje}
                        </p>
                      </div>
                      <span className="text-xs text-neutral-500 whitespace-nowrap flex items-center gap-1">
                        <Clock size={12} />
                        {formatRelativeTime(alerta.fecha)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => navigate('/manifiestos')}
                      >
                        {alerta.accion}
                      </Button>
                      {!alerta.leida && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8"
                          onClick={() => marcarComoLeida(alerta.id)}
                          disabled={resolverMutation.isPending}
                        >
                          <Check size={14} className="mr-1" />
                          Marcar leida
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-neutral-400 hover:text-error-500 ml-auto"
                        onClick={() => eliminarAlerta(alerta.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de confirmacion */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={limpiarTodas}
        title="Limpiar todas las alertas"
        description="Estas seguro de que deseas eliminar todas las alertas? Esta accion no se puede deshacer."
        confirmText="Si, limpiar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};

export default AlertasPage;
