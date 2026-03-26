/**
 * SITREP v6 - Admin Renovaciones Page
 * Lista y gestiona renovaciones anuales de Generadores y Operadores
 */

import React, { useState } from 'react';
import {
  RefreshCw, CheckCircle, XCircle, Clock, Filter,
  Eye, ThumbsUp, ThumbsDown, Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { toast } from '../../components/ui/Toast';
import {
  useRenovaciones,
  useAprobarRenovacion,
  useRechazarRenovacion,
} from '../../hooks/useRenovaciones';
import type { Renovacion } from '../../types/api';

const ESTADO_CONFIG: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  PENDIENTE: { color: 'warning', icon: Clock, label: 'Pendiente' },
  APROBADA: { color: 'success', icon: CheckCircle, label: 'Aprobada' },
  RECHAZADA: { color: 'error', icon: XCircle, label: 'Rechazada' },
};

const AdminRenovacionesPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [anio, setAnio] = useState<number>(currentYear);
  const [tipoActor, setTipoActor] = useState<string>('');
  const [estado, setEstado] = useState<string>('');
  const [page, setPage] = useState(1);
  const [selectedRenov, setSelectedRenov] = useState<Renovacion | null>(null);
  const [rejectModal, setRejectModal] = useState<Renovacion | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const { data, isLoading } = useRenovaciones({
    anio: anio || undefined,
    tipoActor: tipoActor || undefined,
    estado: estado || undefined,
    page,
    limit: 20,
  });

  const aprobarMutation = useAprobarRenovacion();
  const rechazarMutation = useRechazarRenovacion();

  const renovaciones = data?.items || [];
  const totalPages = data?.totalPages || 1;

  const stats = {
    pendientesGen: renovaciones.filter(r => r.estado === 'PENDIENTE' && r.tipoActor === 'GENERADOR').length,
    pendientesOp: renovaciones.filter(r => r.estado === 'PENDIENTE' && r.tipoActor === 'OPERADOR').length,
    aprobadas: renovaciones.filter(r => r.estado === 'APROBADA').length,
    rechazadas: renovaciones.filter(r => r.estado === 'RECHAZADA').length,
  };

  const handleAprobar = async (renov: Renovacion) => {
    try {
      await aprobarMutation.mutateAsync({ id: renov.id });
      toast.success('Aprobada', `Renovacion ${renov.anio} aprobada`);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo aprobar');
    }
  };

  const handleRechazar = async () => {
    if (!rejectModal || !motivoRechazo.trim()) return;
    try {
      await rechazarMutation.mutateAsync({ id: rejectModal.id, motivoRechazo });
      toast.success('Rechazada', 'Renovacion rechazada');
      setRejectModal(null);
      setMotivoRechazo('');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo rechazar');
    }
  };

  const actorName = (r: Renovacion) => r.generador?.razonSocial || r.operador?.razonSocial || '-';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary-100 rounded-xl">
          <RefreshCw size={22} className="text-primary-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Renovaciones Anuales</h2>
          <p className="text-sm text-neutral-500">Gestion de renovaciones de habilitacion</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pendientesGen}</p>
          <p className="text-xs text-neutral-500">Pend. Generadores</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.pendientesOp}</p>
          <p className="text-xs text-neutral-500">Pend. Operadores</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.aprobadas}</p>
          <p className="text-xs text-neutral-500">Aprobadas</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.rechazadas}</p>
          <p className="text-xs text-neutral-500">Rechazadas</p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-neutral-400" />
        <select value={anio} onChange={e => { setAnio(Number(e.target.value)); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white">
          {[currentYear, currentYear - 1, currentYear - 2].map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select value={tipoActor} onChange={e => { setTipoActor(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white">
          <option value="">Todos los actores</option>
          <option value="GENERADOR">Generadores</option>
          <option value="OPERADOR">Operadores</option>
        </select>
        <select value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }}
          className="h-9 px-3 rounded-lg border border-neutral-200 text-sm bg-white">
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="APROBADA">Aprobadas</option>
          <option value="RECHAZADA">Rechazadas</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-500 mx-auto" />
        </div>
      ) : renovaciones.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <RefreshCw size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500">No hay renovaciones para los filtros seleccionados</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Actor</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Tipo</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Ano</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Modalidad</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Estado</th>
                  <th className="text-left py-3 px-4 font-medium text-neutral-600">Campos</th>
                  <th className="text-right py-3 px-4 font-medium text-neutral-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {renovaciones.map(r => {
                  const cfg = ESTADO_CONFIG[r.estado] || ESTADO_CONFIG.PENDIENTE;
                  const campos = r.camposModificados ? JSON.parse(r.camposModificados) : [];
                  return (
                    <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 px-4 font-medium">{actorName(r)}</td>
                      <td className="py-3 px-4">
                        <Badge variant="soft" color={r.tipoActor === 'GENERADOR' ? 'purple' : 'blue'}>
                          {r.tipoActor}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">{r.anio}</td>
                      <td className="py-3 px-4">
                        <Badge variant="soft" color={r.modalidad === 'SIN_CAMBIOS' ? 'success' : 'warning'}>
                          {r.modalidad === 'SIN_CAMBIOS' ? 'Sin Cambios' : `Con Cambios (${campos.length})`}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="soft" color={cfg.color}>{cfg.label}</Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-neutral-500">
                        {campos.length > 0 ? campos.slice(0, 3).join(', ') + (campos.length > 3 ? '...' : '') : '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setSelectedRenov(r)} className="p-1.5 rounded-lg hover:bg-neutral-100" title="Ver detalle">
                            <Eye size={14} className="text-neutral-500" />
                          </button>
                          {r.estado === 'PENDIENTE' && (
                            <>
                              <button onClick={() => handleAprobar(r)} className="p-1.5 rounded-lg hover:bg-green-50" title="Aprobar"
                                disabled={aprobarMutation.isPending}>
                                <ThumbsUp size={14} className="text-green-600" />
                              </button>
                              <button onClick={() => setRejectModal(r)} className="p-1.5 rounded-lg hover:bg-red-50" title="Rechazar">
                                <ThumbsDown size={14} className="text-red-600" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 border-t border-neutral-200">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50">Anterior</button>
              <span className="text-xs text-neutral-500">Pagina {page} de {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50">Siguiente</button>
            </div>
          )}
        </Card>
      )}

      {/* Detail Modal */}
      {selectedRenov && (
        <Modal isOpen onClose={() => setSelectedRenov(null)} title={`Renovacion ${selectedRenov.anio} — ${actorName(selectedRenov)}`} size="lg">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-neutral-500">Tipo Actor</p>
                <p className="font-medium">{selectedRenov.tipoActor}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Modalidad</p>
                <Badge variant="soft" color={selectedRenov.modalidad === 'SIN_CAMBIOS' ? 'success' : 'warning'}>
                  {selectedRenov.modalidad === 'SIN_CAMBIOS' ? 'Sin Cambios' : 'Con Cambios'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Estado</p>
                <Badge variant="soft" color={ESTADO_CONFIG[selectedRenov.estado]?.color || 'warning'}>
                  {ESTADO_CONFIG[selectedRenov.estado]?.label || selectedRenov.estado}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-neutral-500">Fecha</p>
                <p className="text-sm">{new Date(selectedRenov.createdAt).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
            {selectedRenov.tefAnterior !== undefined && selectedRenov.tefNuevo !== undefined && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-medium text-amber-700 mb-1">Impacto TEF</p>
                <p className="text-sm">Anterior: <span className="font-mono font-bold">${selectedRenov.tefAnterior?.toLocaleString()}</span> → Nuevo: <span className="font-mono font-bold">${selectedRenov.tefNuevo?.toLocaleString()}</span></p>
              </div>
            )}
            {selectedRenov.camposModificados && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">Campos modificados</p>
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(selectedRenov.camposModificados).map((c: string) => (
                    <Badge key={c} variant="soft" color="warning">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedRenov.observaciones && (
              <div>
                <p className="text-xs text-neutral-500 mb-1">Observaciones</p>
                <p className="text-sm">{selectedRenov.observaciones}</p>
              </div>
            )}
            {selectedRenov.motivoRechazo && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-medium text-red-700 mb-1">Motivo de rechazo</p>
                <p className="text-sm">{selectedRenov.motivoRechazo}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <Modal isOpen onClose={() => { setRejectModal(null); setMotivoRechazo(''); }} title="Rechazar Renovacion" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Rechazar renovacion de <strong>{actorName(rejectModal)}</strong> ({rejectModal.anio})</p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Motivo de rechazo *</label>
              <textarea value={motivoRechazo} onChange={e => setMotivoRechazo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
                rows={3} placeholder="Indique el motivo del rechazo..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setRejectModal(null); setMotivoRechazo(''); }}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleRechazar}
                disabled={!motivoRechazo.trim() || rechazarMutation.isPending}>
                {rechazarMutation.isPending ? 'Rechazando...' : 'Confirmar Rechazo'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminRenovacionesPage;
