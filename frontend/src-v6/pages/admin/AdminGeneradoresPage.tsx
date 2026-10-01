/**
 * SITREP v6 - Admin Generadores Page
 * ==================================
 * Panel administrativo para generadores de residuos
 * Integra datos de la API + enriquecimiento JSON (certificado, rubro, actividad, categorias Y)
 *
 * Migrated to GenericCRUDPage — layout handled by the generic component,
 * page owns data hooks, enrichment, columns, and business logic.
 */

import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Factory,
  CheckCircle,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  BellRing,
  CheckSquare,
  ListChecks,
} from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { formatRelativeTime } from '../../utils/formatters';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import {
  useGeneradores,
  useDeleteGenerador,
} from '../../hooks/useActores';
import type { GeneradorEnriched } from '../../data/generadores-enrichment';
import { CORRIENTES_Y, parseCorrientes } from '../../data/corrientes-y';
import { useGeneradoresEnrichment } from '../../hooks/useEnrichment';
import { GenericCRUDPage } from '../../components/crud/GenericCRUDPage';
import type { CRUDFilter, CRUDStatCard, Column } from '../../components/crud/GenericCRUDPage.types';
import { actoresService } from '../../services/actores.service';
import type { ActorFilters } from '../../types/api';
import type { Generador, SituacionFiscalGenerador } from '../../types/models';

type FiscalStatusFilter = NonNullable<ActorFilters['fiscalStatus']>;

const CURRENT_YEAR = new Date().getFullYear();
const FISCAL_YEARS = Array.from({ length: 4 }, (_, index) => CURRENT_YEAR - index);
const FISCAL_STATUS_LABELS: Record<'todos' | FiscalStatusFilter, string> = {
  todos: 'Toda situacion fiscal',
  AL_DIA: 'Al dia',
  TEF_SIN_PAGO: 'TEF sin pago',
  TEF_SIN_REGISTRO: 'TEF sin registro',
  DDJJ_PENDIENTE: 'DDJJ pendiente',
  DDJJ_SIN_REGISTRO: 'DDJJ sin registro',
  NO_HABILITADO: 'No habilitado',
  SIN_DATOS: 'Sin datos del ejercicio',
};

function fallbackFiscalSituation(generador: Generador, fiscalYear: number): SituacionFiscalGenerador {
  const pago = generador.pagos?.find((item) => item.anio === fiscalYear);
  const ddjj = generador.ddjj?.find((item) => item.anio === fiscalYear);
  const tef = !pago ? 'SIN_REGISTRO' : pago.fechaPago ? 'PAGADO' : 'SIN_PAGO';
  const ddjjEstado = !ddjj ? 'SIN_REGISTRO' : ddjj.presentada ? 'PRESENTADA' : 'PENDIENTE';
  const habilitacion = pago?.habilitado === true ? 'HABILITADO' : pago?.habilitado === false ? 'NO_HABILITADO' : 'SIN_DATO';
  const pendientes = [
    tef === 'SIN_PAGO' ? 'TEF sin pago' : tef === 'SIN_REGISTRO' ? 'TEF sin registro' : '',
    ddjjEstado === 'PENDIENTE' ? 'DDJJ pendiente' : ddjjEstado === 'SIN_REGISTRO' ? 'DDJJ sin registro' : '',
    habilitacion === 'NO_HABILITADO' ? 'No habilitado' : '',
  ].filter(Boolean);

  return {
    anio: fiscalYear,
    tef,
    ddjj: ddjjEstado,
    habilitacion,
    resumen: tef === 'PAGADO' && ddjjEstado === 'PRESENTADA' && habilitacion === 'HABILITADO'
      ? 'AL_DIA'
      : !pago && !ddjj
        ? 'SIN_DATOS'
        : 'REQUIERE_REVISION',
    pendientes,
  };
}

const AdminGeneradoresPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isAdminGenerador } = useAuth();
  const { impersonateUser } = useImpersonation();
  const { data: enrichmentData } = useGeneradoresEnrichment();
  const generadoresEnrichment = useMemo(() => enrichmentData?.generadores || {}, [enrichmentData]);
  const topRubros = useMemo(() => enrichmentData?.topRubros || [], [enrichmentData]);

  // ── State ──
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroFiscal, setFiltroFiscal] = useState<'todos' | FiscalStatusFilter>('todos');
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>('razonSocial');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectingSegment, setSelectingSegment] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [sendingReminders, setSendingReminders] = useState(false);

  // ── API hooks ──
  const queryFilters = useMemo<ActorFilters>(() => ({
    page: currentPage,
    limit: 20,
    search: busqueda || undefined,
    categoria: filtroCategoria || undefined,
    rubro: filtroRubro || undefined,
    activo: filtroEstado === 'todos' ? undefined : filtroEstado === 'activo',
    fiscalStatus: filtroFiscal === 'todos' ? undefined : filtroFiscal,
    fiscalYear,
    sortBy,
    sortOrder,
  }), [busqueda, currentPage, filtroCategoria, filtroEstado, filtroFiscal, filtroRubro, fiscalYear, sortBy, sortOrder]);
  const { data: apiData, isLoading, isError, error } = useGeneradores(queryFilters);
  const deleteMutation = useDeleteGenerador();

  const generadoresData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total ?? generadoresData.length;
  const totalPages = apiData?.totalPages ?? 1;

  // ── Map API data to the shared desktop/mobile presentation model ──
  const mapGeneradores = useCallback((items: Generador[]) =>
    items.map((g) => {
      const enriched: GeneradorEnriched | null = generadoresEnrichment[g.cuit] || null;
      return {
        id: g.id,
        razonSocial: g.razonSocial || '',
        cuit: g.cuit || '',
        categoria: g.categoria || '-',
        domicilio: g.domicilio || '',
        telefono: g.telefono || '',
        email: g.email || g.usuario?.email || '',
        numeroInscripcion: g.numeroInscripcion || '-',
        activo: g.activo !== false,
        createdAt: g.createdAt,
        ultimaActividad: g.ultimaActividad || null,
        _raw: g,
        situacionFiscal: g.situacionFiscal || fallbackFiscalSituation(g, fiscalYear),
        certificado: enriched?.certificado || null,
        rubro: g.rubro || enriched?.rubro || null,
        actividad: g.actividad || enriched?.actividad || null,
        categoriasControl: g.corrientesControl ? parseCorrientes(g.corrientesControl) : (enriched?.categoriasControl || []),
        corrientesControlRaw: g.corrientesControl || (enriched?.categoriasControl?.join(', ') || ''),
        emailOriginal: enriched?.emailOriginal || null,
        emailGenerado: enriched?.emailGenerado || false,
      };
    }), [fiscalYear, generadoresEnrichment]);

  const tableData = useMemo(() => mapGeneradores(generadoresData), [generadoresData, mapGeneradores]);

  useEffect(() => {
    setSelectedIds([]);
  }, [busqueda, filtroCategoria, filtroEstado, filtroFiscal, filtroRubro, fiscalYear]);

  // ── Sort mapping ──
  const GEN_COL_MAP: Record<string, string> = {
    generador: 'razonSocial',
    categoria: 'categoria',
    ultimaActividad: 'ultimaActividad',
    estado: 'activo',
  };

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortBy(GEN_COL_MAP[key] ?? key);
    setSortOrder(direction);
    setCurrentPage(1);
  };

  // ── Stats ──
  const statsData = apiData?.stats || {
    total,
    activos: tableData.filter((g) => g.activo).length,
    alDia: tableData.filter((g) => g.situacionFiscal.resumen === 'AL_DIA').length,
    requierenRevision: tableData.filter((g) => g.situacionFiscal.resumen === 'REQUIERE_REVISION').length,
    tefSinPago: tableData.filter((g) => g.situacionFiscal.tef === 'SIN_PAGO').length,
    ddjjPendiente: tableData.filter((g) => g.situacionFiscal.ddjj === 'PENDIENTE').length,
    sinDatos: tableData.filter((g) => g.situacionFiscal.resumen === 'SIN_DATOS').length,
  };

  const statCards: CRUDStatCard[] = [
    { label: 'Resultados', value: statsData.total, icon: <Factory size={20} className="text-purple-600" />, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Activos', value: statsData.activos, icon: <CheckCircle size={20} className="text-success-600" />, iconBg: 'bg-success-100', iconColor: 'text-success-600' },
    { label: `TEF sin pago ${fiscalYear}`, value: statsData.tefSinPago, icon: <ShieldX size={20} className="text-error-600" />, iconBg: 'bg-error-100', iconColor: 'text-error-600' },
    { label: `DDJJ pendiente ${fiscalYear}`, value: statsData.ddjjPendiente, icon: <ShieldAlert size={20} className="text-warning-600" />, iconBg: 'bg-warning-100', iconColor: 'text-warning-600' },
  ];

  // ── Filters ──
  const filters: CRUDFilter[] = [
    {
      key: 'rubro',
      value: filtroRubro,
      onChange: (v) => { setFiltroRubro(v); setCurrentPage(1); },
      placeholder: 'Todos los rubros',
      options: [
        { value: '', label: 'Todos los rubros' },
        ...topRubros.map((r: string) => ({
          value: r,
          label: r.length > 35 ? r.substring(0, 33) + '...' : r,
        })),
      ],
    },
    {
      key: 'categoria',
      value: filtroCategoria,
      onChange: (v) => { setFiltroCategoria(v); setCurrentPage(1); },
      placeholder: 'Todas las categorias',
      options: [
        { value: '', label: 'Todas las categorias' },
        { value: 'Grandes', label: 'Grandes Generadores' },
        { value: 'Medianos', label: 'Medianos Generadores' },
        { value: 'Pequenos', label: 'Pequenos Generadores' },
      ],
    },
    {
      key: 'estado',
      value: filtroEstado,
      onChange: (v) => { setFiltroEstado(v); setCurrentPage(1); },
      placeholder: 'Todos los estados',
      options: [
        { value: 'todos', label: 'Todos los estados' },
        { value: 'activo', label: 'Activo' },
        { value: 'inactivo', label: 'Inactivo' },
      ],
    },
    {
      key: 'fiscalYear',
      value: String(fiscalYear),
      onChange: (v) => { setFiscalYear(Number(v)); setCurrentPage(1); },
      placeholder: 'Ejercicio fiscal',
      options: [
        ...FISCAL_YEARS.map((year) => ({ value: String(year), label: `Ejercicio ${year}` })),
      ],
    },
    {
      key: 'fiscalStatus',
      value: filtroFiscal,
      onChange: (v) => { setFiltroFiscal(v as 'todos' | FiscalStatusFilter); setCurrentPage(1); },
      placeholder: 'Situacion fiscal',
      options: [
        { value: 'todos', label: 'Toda situacion fiscal' },
        { value: 'AL_DIA', label: 'Al dia' },
        { value: 'TEF_SIN_PAGO', label: 'TEF: sin pago' },
        { value: 'TEF_SIN_REGISTRO', label: 'TEF: sin registro' },
        { value: 'DDJJ_PENDIENTE', label: 'DDJJ: pendiente' },
        { value: 'DDJJ_SIN_REGISTRO', label: 'DDJJ: sin registro' },
        { value: 'NO_HABILITADO', label: 'No habilitado' },
        { value: 'SIN_DATOS', label: 'Sin datos del ejercicio' },
      ],
    },
    {
      key: 'orden',
      value: `${sortBy}:${sortOrder}`,
      onChange: (value) => {
        const [field, direction] = value.split(':');
        setSortBy(field);
        setSortOrder(direction === 'desc' ? 'desc' : 'asc');
        setCurrentPage(1);
      },
      placeholder: 'Ordenar',
      options: [
        { value: 'razonSocial:asc', label: 'Nombre A-Z' },
        { value: 'razonSocial:desc', label: 'Nombre Z-A' },
        { value: 'ultimaActividad:desc', label: 'Actividad reciente' },
        { value: 'ultimaActividad:asc', label: 'Menor actividad' },
      ],
    },
  ];

  // ── Delete handler ──
  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Generador ${deleteTarget.razonSocial} eliminado`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  // ── Columns ──
  type Row = typeof tableData[0];

  const columns: Column<Row>[] = [
    {
      key: 'generador',
      // The identity column takes the remaining width when optional columns hide.
      // A percentage here makes the fixed-layout selection column absorb that space.
      header: 'Generador',
      sortable: true,
      render: (row: Row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Factory size={20} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 text-sm leading-tight line-clamp-2 break-words" title={row.razonSocial}>{row.razonSocial}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
              <span className="whitespace-nowrap text-xs text-neutral-600 font-mono">{row.cuit}</span>
              {row.certificado && (
                <span className="text-[10px] font-mono text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">{row.certificado}</span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'categoria',
      width: '8rem',
      header: 'Categoria',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: Row) => {
        const cat = row.categoria !== '-' ? row.categoria : null;
        return cat ? (
          <Badge variant="soft" className="max-w-full" color={cat.includes('Grande') ? 'error' : cat.includes('Mediano') ? 'warning' : 'info'}>
            <span className="truncate" title={cat}>{cat.replace(' Generadores', '').replace('Generadores', 'Gen.')}</span>
          </Badge>
        ) : (
          <span className="text-xs text-neutral-400">-</span>
        );
      },
    },
    {
      key: 'categoriasY',
      width: '7rem',
      header: 'Corrientes Y',
      hiddenBelow: '2xl' as const,
      render: (row: Row) => row.categoriasControl.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.categoriasControl.slice(0, 3).map((code: string) => (
            <Badge key={code} variant="outline" color="warning" className="max-w-full text-xs" title={CORRIENTES_Y[code] || code}>
              <span className="truncate">{code}</span>
            </Badge>
          ))}
          {row.categoriasControl.length > 3 && (
            <Badge variant="soft" color="neutral" className="text-xs" title={row.categoriasControl.join(', ')}>
              +{row.categoriasControl.length - 3}
            </Badge>
          )}
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'rubro',
      width: '9rem',
      header: 'Rubro / Actividad',
      hiddenBelow: '3xl' as const,
      render: (row: Row) => {
        const text = row.rubro || row.actividad;
        return text ? (
          <p className="text-xs text-neutral-600 leading-tight line-clamp-2" title={`${row.rubro || ''}${row.actividad ? ' — ' + row.actividad : ''}`}>
            {text}
          </p>
        ) : (
          <span className="text-xs text-neutral-400">-</span>
        );
      },
    },
    {
      key: 'contacto',
      width: '11rem',
      header: 'Contacto',
      hiddenBelow: '3xl' as const,
      render: (row: Row) => {
        const mail = row.emailOriginal || row.email;
        return (
          <div className="text-xs min-w-0">
            {mail && (
              <p className="text-neutral-600 truncate flex items-center gap-1">
                <Mail size={11} className="flex-shrink-0" />
                <span className="truncate">{mail.split(',')[0].trim()}</span>
              </p>
            )}
            {row.telefono && (
              <p className="text-neutral-500 flex items-center gap-1 mt-0.5">
                <Phone size={11} className="flex-shrink-0" />
                <span className="truncate">{row.telefono}</span>
              </p>
            )}
            {!mail && !row.telefono && <span className="text-neutral-400">-</span>}
          </div>
        );
      },
    },
    {
      key: 'situacionFiscal',
      width: '9rem',
      header: `Fiscal ${fiscalYear}`,
      hiddenBelow: 'lg' as const,
      render: (row: Row) => {
        const cfg = {
          AL_DIA: { icon: ShieldCheck, color: 'text-success-700', bg: 'bg-success-50', label: 'Al dia' },
          REQUIERE_REVISION: { icon: ShieldAlert, color: 'text-warning-700', bg: 'bg-warning-50', label: 'Revisar' },
          SIN_DATOS: { icon: ShieldAlert, color: 'text-neutral-600', bg: 'bg-neutral-100', label: 'Sin datos' },
        }[row.situacionFiscal.resumen];
        const Icon = cfg.icon;
        return (
          <div className={`rounded-lg px-2 py-1.5 ${cfg.bg}`} title={row.situacionFiscal.pendientes.join(', ') || 'TEF pagado, DDJJ presentada y habilitado'}>
            <div className="flex items-center gap-1">
              <Icon size={14} className={cfg.color} />
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-neutral-600">
              {row.situacionFiscal.pendientes.join(' · ') || 'TEF · DDJJ · habilitado'}
            </p>
          </div>
        );
      },
    },
    {
      key: 'ultimaActividad',
      width: '7rem',
      header: 'Actividad',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: Row) => row.ultimaActividad ? (
        <span className="text-xs text-neutral-600">{formatRelativeTime(row.ultimaActividad)}</span>
      ) : (
        <span className="text-xs text-neutral-400">Sin actividad</span>
      ),
    },
    {
      key: 'estado',
      width: '6rem',
      header: 'Estado',
      sortable: true,
      render: (row: Row) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'warning'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '12rem',
      header: '',
      align: 'right' as const,
      render: (row: Row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row._raw?.usuarioId && row.activo && (
            <button
              className="flex h-8 w-8 shrink-0 items-center justify-center text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
              title="Acceso Comodin — ver como este generador"
              onClick={async (e) => {
                e.stopPropagation();
                try { await impersonateUser(row._raw.usuarioId); }
                catch (err: any) { toast.error(err?.response?.data?.message || 'No se pudo acceder como este usuario'); }
              }}
            >
              <Eye size={14} />
            </button>
          )}
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/generadores/${row.id}`); }}
            title="Ver"
          >
            <Eye size={14} />
          </button>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-600 hover:text-info-700 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/generadores/${row.id}/editar`); }}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/generadores/${row.id}/renovar`); }}
            title="Renovar"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center text-neutral-600 hover:text-error-700 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, razonSocial: row.razonSocial }); }}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const filtersDescription = useMemo(() => [
    `Ejercicio: ${fiscalYear}`,
    filtroCategoria ? `Categoria: ${filtroCategoria}` : '',
    filtroRubro ? `Rubro: ${filtroRubro}` : '',
    filtroEstado !== 'todos' ? `Estado: ${filtroEstado}` : '',
    filtroFiscal !== 'todos' ? `Situacion: ${FISCAL_STATUS_LABELS[filtroFiscal]}` : '',
    busqueda ? `Busqueda: ${busqueda}` : '',
  ].filter(Boolean).join(', '), [busqueda, filtroCategoria, filtroEstado, filtroFiscal, filtroRubro, fiscalYear]);

  const loadExportRows = useCallback(async () => {
    const result = await actoresService.listGeneradores({
      ...queryFilters,
      page: 1,
      limit: 5000,
    });
    if (result.total > result.items.length) {
      throw new Error(`El segmento contiene ${result.total} registros y supera el limite seguro de exportacion.`);
    }
    return mapGeneradores(result.items);
  }, [mapGeneradores, queryFilters]);

  const selectCompleteSegment = useCallback(async () => {
    setSelectingSegment(true);
    try {
      const result = await actoresService.listGeneradores({ ...queryFilters, page: 1, limit: 5000 });
      if (result.total > result.items.length) {
        throw new Error(`El segmento tiene ${result.total} registros y supera el limite seguro de 5000.`);
      }
      setSelectedIds(result.items.map((item) => item.id));
      toast.success('Segmento seleccionado', `${result.items.length} generadores listos para revisar.`);
    } catch (selectionError) {
      toast.error('Seleccionar segmento', selectionError instanceof Error ? selectionError.message : 'No se pudo seleccionar el segmento.');
    } finally {
      setSelectingSegment(false);
    }
  }, [queryFilters]);

  const openReminderReview = useCallback(() => {
    const situation = filtroFiscal === 'todos' ? 'la situacion fiscal registrada' : FISCAL_STATUS_LABELS[filtroFiscal].toLowerCase();
    setReminderText(`Recordatorio SITREP: la situacion fiscal del ejercicio ${fiscalYear} requiere atencion (${situation}). Ingrese al sistema para revisar sus datos y regularizar la documentacion correspondiente.`);
    setReminderOpen(true);
  }, [filtroFiscal, fiscalYear]);

  const sendReminders = useCallback(async () => {
    if (selectedIds.length === 0 || reminderText.trim().length < 10) return;
    setSendingReminders(true);
    try {
      const result = await actoresService.createGeneradorReminders({ ids: selectedIds, fiscalYear, motivo: reminderText.trim() });
      toast.success('Recordatorios creados', `${result.delivered} avisos entregados${result.skipped ? `; ${result.skipped} omitidos por cuenta inactiva o inexistente` : ''}.`);
      setReminderOpen(false);
      setSelectedIds([]);
    } catch (reminderError: any) {
      toast.error('Recordatorios', reminderError?.response?.data?.message || 'No se pudieron crear los recordatorios.');
    } finally {
      setSendingReminders(false);
    }
  }, [fiscalYear, reminderText, selectedIds]);

  const handleCsvExport = useCallback(async () => {
    const rows = await loadExportRows();
    downloadCsv(rows.map((g) => ({
      'Razon Social': g.razonSocial,
      CUIT: g.cuit,
      Certificado: g.certificado || '',
      Categoria: g.categoria,
      Rubro: g.rubro || '',
      Actividad: g.actividad || '',
      'Corrientes Y': g.categoriasControl.join(', '),
      Email: g.emailOriginal || g.email,
      Telefono: g.telefono,
      Domicilio: g.domicilio,
      Inscripcion: g.numeroInscripcion,
      Ejercicio: g.situacionFiscal.anio,
      TEF: g.situacionFiscal.tef,
      DDJJ: g.situacionFiscal.ddjj,
      Habilitacion: g.situacionFiscal.habilitacion,
      Pendientes: g.situacionFiscal.pendientes.join('; '),
      Estado: g.activo ? 'Activo' : 'Inactivo',
      'Ultima actividad': g.ultimaActividad ? new Date(g.ultimaActividad).toLocaleDateString('es-AR') : '',
    })), `generadores-fiscal-${fiscalYear}`, {
      titulo: 'Generadores - Situacion fiscal',
      periodo: `Ejercicio ${fiscalYear}`,
      filtros: filtersDescription,
      total: rows.length,
    });
  }, [filtersDescription, fiscalYear, loadExportRows]);

  const handlePdfExport = useCallback(async () => {
    const rows = await loadExportRows();
    await exportReportePDF({
      titulo: 'Generadores - Situacion fiscal',
      subtitulo: `${rows.length} resultados con filtros globales`,
      periodo: `Ejercicio ${fiscalYear} · ${filtersDescription}`,
      kpis: [
        { label: 'Resultados', value: rows.length },
        { label: 'TEF sin pago', value: rows.filter((g) => g.situacionFiscal.tef === 'SIN_PAGO').length },
        { label: 'DDJJ pendiente', value: rows.filter((g) => g.situacionFiscal.ddjj === 'PENDIENTE').length },
        { label: 'Sin datos', value: rows.filter((g) => g.situacionFiscal.resumen === 'SIN_DATOS').length },
      ],
      tabla: {
        headers: ['Razon Social', 'CUIT', 'TEF', 'DDJJ', 'Habilitacion', 'Pendientes', 'Estado'],
        rows: rows.map((g) => [
          g.razonSocial,
          g.cuit,
          g.situacionFiscal.tef,
          g.situacionFiscal.ddjj,
          g.situacionFiscal.habilitacion,
          g.situacionFiscal.pendientes.join('; ') || 'Al dia',
          g.activo ? 'Activo' : 'Inactivo',
        ]),
      },
    });
  }, [filtersDescription, fiscalYear, loadExportRows]);

  // ── Render via GenericCRUDPage ──
  return (
    <>
    <GenericCRUDPage<Row>
      // Page metadata
      title="Admin Generadores"
      subtitle="Panel de gestion de generadores de residuos"
      icon={<Factory size={24} className="text-purple-600" />}
      iconBg="bg-purple-100"
      // Data
      data={tableData}
      isLoading={isLoading}
      isError={isError}
      errorMessage={(error as Error)?.message}
      loadingMessage="Cargando generadores..."
      // Table
      columns={columns}
      tableClassName="[&_table]:min-w-[40rem]"
      getRowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/admin/actores/generadores/${row.id}`)}
      emptyMessage="No se encontraron generadores"
      // Search
      searchValue={busqueda}
      onSearchChange={(v) => { setBusqueda(v); setCurrentPage(1); }}
      searchPlaceholder="Buscar por razon social, CUIT o domicilio..."
      searchDebounce={300}
      // Filters
      filters={filters}
      // Stats
      stats={statCards}
      // Sort
      sort={{ onSort: handleSort }}
      selection={{ selectedKeys: selectedIds, onSelectionChange: setSelectedIds, ariaLabel: 'Seleccionar generador' }}
      // Pagination
      pagination={{
        currentPage,
        totalPages,
        totalItems: total,
        itemsPerPage: 20,
        onPageChange: setCurrentPage,
      }}
      // Actions
      onNew={() => navigate('/admin/actores/generadores/nuevo')}
      newLabel="Nuevo Generador"
      mobileNewLabel="Nuevo"
      // CSV export
      csvExport={{
        onExport: handleCsvExport,
        filename: `generadores-fiscal-${fiscalYear}`,
        metadata: {
          titulo: 'Generadores - Situacion fiscal',
          periodo: `Ejercicio ${fiscalYear}`,
          filtros: filtersDescription,
          total,
        },
      }}
      // PDF export
      pdfExport={{
        onExport: handlePdfExport,
        titulo: 'Generadores - Situacion fiscal',
        subtitulo: `${total} resultados`,
        periodo: `Ejercicio ${fiscalYear}`,
        kpis: [],
        tabla: {
          headers: [],
          rows: [],
        },
      }}
      // Delete
      deleteConfig={{
        target: deleteTarget ? { id: deleteTarget.id, label: deleteTarget.razonSocial } : null,
        onDelete: handleEliminar,
        onClose: () => setDeleteTarget(null),
        isLoading: deleteMutation.isPending,
        title: 'Eliminar Generador',
      }}
      renderAfterFilters={() => (
        <div className="rounded-2xl border border-primary-200 bg-primary-50/60 p-4" aria-live="polite">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white p-2 text-primary-700 shadow-sm"><ListChecks size={20} /></div>
              <div>
                <p className="text-sm font-bold text-neutral-900">Gestionar el segmento visible</p>
                <p className="mt-0.5 text-xs leading-relaxed text-neutral-600">{selectedIds.length > 0 ? `${selectedIds.length} generadores seleccionados. La audiencia exacta se revisa antes de crear avisos.` : 'Seleccione filas, la pagina actual o todos los resultados de los filtros vigentes.'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" leftIcon={<CheckSquare size={15} />} onClick={() => {
                const pageIds = tableData.map((row) => row.id);
                const everyPageRowSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
                setSelectedIds(everyPageRowSelected ? selectedIds.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...selectedIds, ...pageIds])));
              }} disabled={tableData.length === 0}>{tableData.every((row) => selectedIds.includes(row.id)) && tableData.length > 0 ? 'Quitar pagina' : 'Seleccionar pagina'}</Button>
              <Button variant="outline" size="sm" leftIcon={<ListChecks size={15} />} onClick={() => void selectCompleteSegment()} isLoading={selectingSegment} disabled={total === 0}>Todo el segmento ({total})</Button>
              {selectedIds.length > 0 && <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Limpiar</Button>}
              <Button size="sm" leftIcon={<BellRing size={15} />} onClick={openReminderReview} disabled={selectedIds.length === 0 || (!isAdmin && !isAdminGenerador)}>Preparar recordatorio</Button>
            </div>
          </div>
        </div>
      )}
      renderMobileCard={(row) => (
        <Card className="p-4 pr-14">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center shrink-0">
                <Factory size={16} className="text-purple-600" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm text-neutral-900 truncate">{row.razonSocial}</p>
                <p className="text-xs text-neutral-500 font-mono">{row.cuit}</p>
              </div>
            </div>
            <Badge variant="soft" color={row.activo ? 'success' : 'warning'} className="shrink-0 ml-2">
              {row.activo ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          {(row.categoria || row.rubro) && (
            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-500">
              {row.categoria && <span className="bg-neutral-100 px-2 py-0.5 rounded">{row.categoria}</span>}
              {row.rubro && <span className="truncate">{row.rubro}</span>}
            </div>
          )}
          <div className="mt-3 border-t border-neutral-100 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-neutral-700">Situacion fiscal {row.situacionFiscal.anio}</span>
              <Badge
                variant="soft"
                color={row.situacionFiscal.resumen === 'AL_DIA' ? 'success' : row.situacionFiscal.resumen === 'SIN_DATOS' ? 'neutral' : 'warning'}
              >
                {row.situacionFiscal.resumen === 'AL_DIA' ? 'Al dia' : row.situacionFiscal.resumen === 'SIN_DATOS' ? 'Sin datos' : 'Revisar'}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              {row.situacionFiscal.pendientes.join(' · ') || 'TEF pagado · DDJJ presentada · habilitado'}
            </p>
          </div>
        </Card>
      )}
    />
    <Modal
      isOpen={reminderOpen}
      onClose={() => !sendingReminders && setReminderOpen(false)}
      title="Revisar recordatorio fiscal"
      description="Este paso crea avisos dentro de SITREP. No envia correos ni mensajes externos."
      closeOnOverlayClick={!sendingReminders}
      footer={<>
        <Button variant="ghost" onClick={() => setReminderOpen(false)} disabled={sendingReminders}>Cancelar</Button>
        <Button leftIcon={<BellRing size={16} />} onClick={() => void sendReminders()} isLoading={sendingReminders} disabled={reminderText.trim().length < 10}>Crear {selectedIds.length} avisos</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs font-medium text-neutral-500">Destinatarios</p><p className="mt-1 text-xl font-bold text-neutral-900">{selectedIds.length}</p></div>
          <div className="rounded-xl bg-neutral-50 p-3"><p className="text-xs font-medium text-neutral-500">Ejercicio</p><p className="mt-1 text-xl font-bold text-neutral-900">{fiscalYear}</p></div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Solo reciben el aviso las cuentas activas asociadas a la seleccion confirmada. Si una cuenta fue desactivada desde la seleccion, se omitira y quedara informada en el resultado.</div>
        <label className="block text-sm font-semibold text-neutral-800">Mensaje del recordatorio
          <textarea value={reminderText} maxLength={500} onChange={(event) => setReminderText(event.target.value)} rows={5} className="mt-2 w-full resize-y rounded-xl border border-neutral-300 px-3 py-2.5 font-normal leading-relaxed outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100" />
        </label>
        <p className="text-right text-xs text-neutral-500">{reminderText.length}/500</p>
      </div>
    </Modal>
    </>
  );
};

export default AdminGeneradoresPage;
