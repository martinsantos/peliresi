/**
 * SITREP v6 - Alertas Page
 * ========================
 * Gestión de alertas y notificaciones del sistema
 */

import React, { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Filter,
  Settings,
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

// Fallback mock data de alertas
const alertasData = [
  { 
    id: 1, 
    tipo: 'critical', 
    titulo: 'Manifiesto vencido', 
    mensaje: 'El manifiesto M-2025-045 ha superado el plazo de tratamiento',
    fecha: '2025-01-31T14:30:00',
    leida: false,
    accion: 'Revisar manifiesto'
  },
  { 
    id: 2, 
    tipo: 'warning', 
    titulo: 'Retraso en entrega', 
    mensaje: 'El transporte de M-2025-090 está retrasado 45 minutos',
    fecha: '2025-01-31T13:15:00',
    leida: false,
    accion: 'Ver tracking'
  },
  { 
    id: 3, 
    tipo: 'info', 
    titulo: 'Mantenimiento programado', 
    mensaje: 'El sistema estará en mantenimiento el 15/02 a las 02:00 AM',
    fecha: '2025-01-31T10:00:00',
    leida: true,
    accion: 'Ver detalles'
  },
  { 
    id: 4, 
    tipo: 'success', 
    titulo: 'Manifiesto completado', 
    mensaje: 'El manifiesto M-2025-088 fue tratado exitosamente',
    fecha: '2025-01-31T09:30:00',
    leida: true,
    accion: 'Ver certificado'
  },
  { 
    id: 5, 
    tipo: 'warning', 
    titulo: 'Firma pendiente', 
    mensaje: '3 manifiestos aguardan firma del transportista',
    fecha: '2025-01-31T08:45:00',
    leida: false,
    accion: 'Ver pendientes'
  },
  { 
    id: 6, 
    tipo: 'critical', 
    titulo: 'Incidencia reportada', 
    mensaje: 'El chofer de M-2025-091 reportó un incidente',
    fecha: '2025-01-30T16:20:00',
    leida: true,
    accion: 'Ver incidencia'
  },
];

const tipoConfig = {
  critical: { label: 'Crítica', icon: AlertCircle, color: 'error', bgColor: 'bg-error-50', borderColor: 'border-error-200', textColor: 'text-error-800' },
  warning: { label: 'Advertencia', icon: AlertTriangle, color: 'warning', bgColor: 'bg-warning-50', borderColor: 'border-warning-200', textColor: 'text-warning-800' },
  info: { label: 'Información', icon: Info, color: 'info', bgColor: 'bg-info-50', borderColor: 'border-info-200', textColor: 'text-info-800' },
  success: { label: 'Éxito', icon: CheckCircle, color: 'success', bgColor: 'bg-success-50', borderColor: 'border-success-200', textColor: 'text-success-800' },
};

export const AlertasPage: React.FC = () => {
  // Try real API
  const { data: apiAlertas } = useAlertas();
  const resolverMutation = useResolverAlerta();

  // Merge API data with local state for optimistic UI
  const [localAlertas, setLocalAlertas] = useState(alertasData);
  const alertas = useMemo(() => {
    if (apiAlertas?.items?.length) {
      return apiAlertas.items.map((a: any, i: number) => ({
        id: i + 1,
        tipo: a.estado === 'PENDIENTE' ? 'critical' : a.estado === 'EN_REVISION' ? 'warning' : 'success',
        titulo: a.regla?.nombre || 'Alerta',
        mensaje: typeof a.datos === 'string' ? (JSON.parse(a.datos)?.descripcion || a.datos) : 'Sin detalles',
        fecha: a.createdAt,
        leida: a.estado !== 'PENDIENTE',
        accion: 'Ver detalles',
      }));
    }
    return localAlertas;
  }, [apiAlertas, localAlertas]);
  const setAlertas = setLocalAlertas;
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

  const marcarComoLeida = (id: number) => {
    setAlertas(alertas.map(a => a.id === id ? { ...a, leida: true } : a));
  };

  const marcarTodasComoLeidas = () => {
    setAlertas(alertas.map(a => ({ ...a, leida: true })));
    toast.success('Alertas marcadas', 'Todas las alertas fueron marcadas como leídas');
  };

  const eliminarAlerta = (id: number) => {
    setAlertas(alertas.filter(a => a.id !== id));
    toast.success('Alerta eliminada', 'La alerta fue eliminada correctamente');
  };

  const limpiarTodas = () => {
    setAlertas([]);
    setShowClearModal(false);
    toast.success('Alertas limpiadas', 'Todas las alertas fueron eliminadas');
  };

  const formatFecha = (fecha: string) => {
    const date = new Date(fecha);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Hace minutos';
    if (hours < 24) return `Hace ${hours} hora${hours > 1 ? 's' : ''}`;
    return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
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
              {noLeidasCount} alertas sin leer de {alertas.length} totales
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
          <Button variant="ghost" leftIcon={<Settings size={18} />}>
            Configurar
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
              <option value="critical">Críticas</option>
              <option value="warning">Advertencias</option>
              <option value="info">Información</option>
              <option value="success">Éxito</option>
            </select>
          </div>
          <select
            value={filtroLeidas}
            onChange={(e) => setFiltroLeidas(e.target.value)}
            className="px-3 py-2 rounded-lg border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
          >
            <option value="todas">Todas</option>
            <option value="no-leidas">No leídas</option>
            <option value="leidas">Leídas</option>
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
            const Icon = config.icon;
            
            return (
              <div
                key={alerta.id}
                className={`
                  relative p-4 rounded-xl border-l-4 transition-all
                  ${config.bgColor} ${config.borderColor}
                  ${!alerta.leida ? 'shadow-sm' : 'opacity-75'}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg bg-white ${config.textColor}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`font-semibold ${config.textColor}`}>{alerta.titulo}</h4>
                          {!alerta.leida && (
                            <Badge variant="solid" color={config.color as any} size="sm">
                              Nueva
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm ${config.textColor} opacity-90`}>
                          {alerta.mensaje}
                        </p>
                      </div>
                      <span className="text-xs text-neutral-500 whitespace-nowrap flex items-center gap-1">
                        <Clock size={12} />
                        {formatFecha(alerta.fecha)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8"
                      >
                        {alerta.accion}
                      </Button>
                      {!alerta.leida && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8"
                          onClick={() => marcarComoLeida(alerta.id)}
                        >
                          <Check size={14} className="mr-1" />
                          Marcar leída
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

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={limpiarTodas}
        title="Limpiar todas las alertas"
        description="¿Estás seguro de que deseas eliminar todas las alertas? Esta acción no se puede deshacer."
        confirmText="Sí, limpiar"
        cancelText="Cancelar"
        variant="danger"
      />
    </div>
  );
};

export default AlertasPage;
