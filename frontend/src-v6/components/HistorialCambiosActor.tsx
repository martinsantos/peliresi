/**
 * SITREP v6 - HistorialCambiosActor
 * Timeline interactiva de cambios CRUD para cualquier actor
 */

import React, { useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw, ChevronDown, ChevronUp,
  Clock, Filter, Calendar,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from './ui/CardV2';
import { Badge } from './ui/BadgeV2';
import { useHistorialActor } from '../hooks/useActores';

interface Props {
  tipoActor: 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA';
  actorId: string;
}

const ACCION_CONFIG: Record<string, { icon: typeof Plus; color: string; bg: string; label: string }> = {
  CREATE: { icon: Plus, color: 'text-green-600', bg: 'bg-green-100', label: 'Creado' },
  UPDATE: { icon: Pencil, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Modificado' },
  DELETE: { icon: Trash2, color: 'text-red-600', bg: 'bg-red-100', label: 'Eliminado' },
};

const MODULO_COLORS: Record<string, string> = {
  GENERADOR: 'bg-purple-100 text-purple-700',
  OPERADOR: 'bg-blue-100 text-blue-700',
  TRANSPORTISTA: 'bg-orange-100 text-orange-700',
  VEHICULO: 'bg-teal-100 text-teal-700',
  CHOFER: 'bg-cyan-100 text-cyan-700',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Hace un momento';
  if (diffMins < 60) return `Hace ${diffMins} min`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Hace ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function DiffTable({ antes, despues, accion }: { antes?: string; despues?: string; accion: string }) {
  const parsed = useMemo(() => {
    const a = antes ? JSON.parse(antes) : null;
    const d = despues ? JSON.parse(despues) : null;
    if (!a && !d) return [];

    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(d || {})]);
    const SKIP = ['id', 'usuarioId', 'createdAt', 'updatedAt', 'password'];
    const diffs: { field: string; before: any; after: any }[] = [];

    for (const key of allKeys) {
      if (SKIP.includes(key)) continue;
      const bv = a?.[key];
      const av = d?.[key];
      if (accion === 'CREATE') {
        if (av !== null && av !== undefined && av !== '') diffs.push({ field: key, before: null, after: av });
      } else if (accion === 'DELETE') {
        if (bv !== null && bv !== undefined && bv !== '') diffs.push({ field: key, before: bv, after: null });
      } else {
        if (JSON.stringify(bv) !== JSON.stringify(av)) diffs.push({ field: key, before: bv, after: av });
      }
    }
    return diffs;
  }, [antes, despues, accion]);

  if (parsed.length === 0) return <p className="text-xs text-neutral-400 italic">Sin diferencias detectadas</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="text-left py-1.5 px-2 font-medium text-neutral-500 w-1/3">Campo</th>
            {accion !== 'CREATE' && <th className="text-left py-1.5 px-2 font-medium text-neutral-500 w-1/3">Antes</th>}
            {accion !== 'DELETE' && <th className="text-left py-1.5 px-2 font-medium text-neutral-500 w-1/3">Despues</th>}
          </tr>
        </thead>
        <tbody>
          {parsed.map(d => (
            <tr key={d.field} className="border-b border-neutral-100">
              <td className="py-1.5 px-2 font-mono text-neutral-600">{d.field}</td>
              {accion !== 'CREATE' && (
                <td className="py-1.5 px-2">
                  <span className="text-red-600 line-through">{d.before !== null ? String(d.before) : '-'}</span>
                </td>
              )}
              {accion !== 'DELETE' && (
                <td className="py-1.5 px-2">
                  <span className="text-green-600 font-medium">{d.after !== null ? String(d.after) : '-'}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HistorialCambiosActor: React.FC<Props> = ({ tipoActor, actorId }) => {
  const currentYear = new Date().getFullYear();
  const [anio, setAnio] = useState<number | undefined>(undefined);
  const [modulo, setModulo] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading } = useHistorialActor(tipoActor, actorId, { anio, modulo, page, limit: 20 });
  const historial = data?.items || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const toggle = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= 2024; y--) arr.push(y);
    return arr;
  }, [currentYear]);

  const showModuloFilter = tipoActor === 'TRANSPORTISTA';

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-2xl font-bold text-neutral-900">{total}</p>
          <p className="text-xs text-neutral-500">Total cambios</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-2xl font-bold text-neutral-900">
            {historial.length > 0 ? formatDate(historial[0].createdAt) : '-'}
          </p>
          <p className="text-xs text-neutral-500">Ultimo cambio</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">
            {historial.filter(h => h.accion === 'UPDATE').length}
          </p>
          <p className="text-xs text-neutral-500">Modificaciones</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {historial.filter(h => h.accion === 'CREATE').length}
          </p>
          <p className="text-xs text-neutral-500">Creaciones</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-neutral-400" />
          <select
            value={anio || ''}
            onChange={e => { setAnio(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
            className="h-8 px-3 rounded-lg border border-neutral-200 text-sm bg-white"
          >
            <option value="">Todos los anos</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {showModuloFilter && (
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-neutral-400" />
            <select
              value={modulo || ''}
              onChange={e => { setModulo(e.target.value || undefined); setPage(1); }}
              className="h-8 px-3 rounded-lg border border-neutral-200 text-sm bg-white"
            >
              <option value="">Todos</option>
              <option value="TRANSPORTISTA">Actor</option>
              <option value="VEHICULO">Vehiculos</option>
              <option value="CHOFER">Choferes</option>
            </select>
          </div>
        )}
      </div>

      {/* Timeline */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-neutral-500 mt-3">Cargando historial...</p>
        </div>
      ) : historial.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Clock size={40} className="text-neutral-300 mx-auto mb-3" />
            <p className="text-neutral-500 font-medium">Sin cambios registrados</p>
            <p className="text-xs text-neutral-400 mt-1">Las operaciones CRUD quedaran reflejadas aqui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-neutral-200" />

          <div className="space-y-3">
            {historial.map(entry => {
              const cfg = ACCION_CONFIG[entry.accion] || ACCION_CONFIG.UPDATE;
              const Icon = cfg.icon;
              const isOpen = expanded.has(entry.id);
              const moduloColor = MODULO_COLORS[entry.modulo] || 'bg-neutral-100 text-neutral-600';

              return (
                <div key={entry.id} className="relative pl-12">
                  {/* Node */}
                  <div className={`absolute left-2.5 top-3 w-5 h-5 rounded-full flex items-center justify-center ${cfg.bg} ring-2 ring-white`}>
                    <Icon size={11} className={cfg.color} />
                  </div>

                  {/* Card */}
                  <button
                    onClick={() => toggle(entry.id)}
                    className="w-full text-left bg-white rounded-xl border border-neutral-200 p-3 hover:border-neutral-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <Badge variant="soft" className={`text-[10px] px-1.5 py-0.5 ${cfg.bg} ${cfg.color}`}>{cfg.label}</Badge>
                        <Badge variant="soft" className={`text-[10px] px-1.5 py-0.5 ${moduloColor}`}>{entry.modulo}</Badge>
                        {entry.usuario && (
                          <span className="text-xs text-neutral-500 truncate">{entry.usuario.nombre}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-neutral-400">{formatDate(entry.createdAt)}</span>
                        {isOpen ? <ChevronUp size={14} className="text-neutral-400" /> : <ChevronDown size={14} className="text-neutral-400" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-neutral-100" onClick={e => e.stopPropagation()}>
                        <DiffTable antes={entry.datosAntes} despues={entry.datosDespues} accion={entry.accion} />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-xs text-neutral-500">Pagina {page} de {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default HistorialCambiosActor;
