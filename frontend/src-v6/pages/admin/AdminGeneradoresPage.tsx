/**
 * SITREP v6 - Admin Generadores Page
 * ==================================
 * Panel administrativo para generadores de residuos
 * Integra datos de la API + enriquecimiento JSON (certificado, rubro, actividad, categorias Y)
 *
 * Migrated to GenericCRUDPage — layout handled by the generic component,
 * page owns data hooks, enrichment, columns, and business logic.
 */

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { formatRelativeTime } from '../../utils/formatters';
import {
  useGeneradores,
  useDeleteGenerador,
} from '../../hooks/useActores';
import type { GeneradorEnriched } from '../../data/generadores-enrichment';
import { CORRIENTES_Y, parseCorrientes } from '../../data/corrientes-y';
import { useGeneradoresEnrichment } from '../../hooks/useEnrichment';
import { GenericCRUDPage } from '../../components/crud/GenericCRUDPage';
import type { CRUDFilter, CRUDStatCard, Column } from '../../components/crud/GenericCRUDPage.types';

const AdminGeneradoresPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { impersonateUser } = useImpersonation();
  const { data: enrichmentData } = useGeneradoresEnrichment();
  const GENERADORES_DATA = enrichmentData?.generadores || {};
  const TOP_RUBROS = enrichmentData?.topRubros || [];

  // ── State ──
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCompliance, setFiltroCompliance] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>('ultimaActividad');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);

  // ── API hooks ──
  const { data: apiData, isLoading, isError, error } = useGeneradores({ page: currentPage, limit: 20, search: busqueda || undefined, sortBy, sortOrder });
  const deleteMutation = useDeleteGenerador();

  const generadoresData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total || generadoresData.length;
  const totalPages = apiData?.totalPages || 1;

  // ── Map to display format + merge JSON enrichment + compute compliance ──
  const tableData = useMemo(() =>
    generadoresData.map((g: any) => {
      const enriched: GeneradorEnriched | null = GENERADORES_DATA[g.cuit] || null;

      const pagosRecent = g.pagos || [];
      const ddjjRecent = g.ddjj || [];
      const tefPaid = pagosRecent.some((p: any) => p.fechaPago != null);
      const habilitado = pagosRecent.some((p: any) => p.habilitado === true);
      const ddjjOk = ddjjRecent.some((d: any) => d.presentada);
      const compliance: 'verde' | 'amarillo' | 'rojo' | 'sin_datos' =
        pagosRecent.length === 0 && ddjjRecent.length === 0 ? 'sin_datos' :
        tefPaid && ddjjOk && habilitado ? 'verde' :
        !tefPaid && !ddjjOk ? 'rojo' : 'amarillo';

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
        compliance,
        certificado: enriched?.certificado || null,
        rubro: g.rubro || enriched?.rubro || null,
        actividad: g.actividad || enriched?.actividad || null,
        categoriasControl: g.corrientesControl ? parseCorrientes(g.corrientesControl) : (enriched?.categoriasControl || []),
        corrientesControlRaw: g.corrientesControl || (enriched?.categoriasControl?.join(', ') || ''),
        emailOriginal: enriched?.emailOriginal || null,
        emailGenerado: enriched?.emailGenerado || false,
      };
    }),
    [generadoresData]
  );

  // ── Client-side filters ──
  const filteredData = useMemo(() => {
    return tableData.filter((g) => {
      if (filtroRubro && g.rubro !== filtroRubro) return false;
      const matchesCategoria = !filtroCategoria || g.categoria.toLowerCase().includes(filtroCategoria.toLowerCase());
      const matchesEstado = filtroEstado === 'todos' ||
                            (filtroEstado === 'activo' && g.activo) ||
                            (filtroEstado === 'inactivo' && !g.activo);
      const matchesCompliance = filtroCompliance === 'todos' || g.compliance === filtroCompliance;
      return matchesCategoria && matchesEstado && matchesCompliance;
    });
  }, [tableData, filtroRubro, filtroCategoria, filtroEstado, filtroCompliance]);

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
  const statsData = {
    total,
    activos: generadoresData.filter((g: any) => g.activo !== false).length,
    alDia: tableData.filter(g => g.compliance === 'verde').length,
    conDeuda: tableData.filter(g => g.compliance === 'rojo').length,
  };

  const statCards: CRUDStatCard[] = [
    { label: 'Total Generadores', value: statsData.total, icon: <Factory size={20} className="text-purple-600" />, iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { label: 'Activos', value: statsData.activos, icon: <CheckCircle size={20} className="text-success-600" />, iconBg: 'bg-success-100', iconColor: 'text-success-600' },
    { label: 'Al dia', value: statsData.alDia, icon: <ShieldCheck size={20} className="text-emerald-600" />, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { label: 'Con deuda', value: statsData.conDeuda, icon: <ShieldX size={20} className="text-error-600" />, iconBg: 'bg-error-100', iconColor: 'text-error-600' },
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
        ...TOP_RUBROS.map((r: string) => ({
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
      key: 'compliance',
      value: filtroCompliance,
      onChange: (v) => { setFiltroCompliance(v); setCurrentPage(1); },
      placeholder: 'Compliance: Todos',
      options: [
        { value: 'todos', label: 'Compliance: Todos' },
        { value: 'verde', label: 'Al dia' },
        { value: 'amarillo', label: 'Parcial' },
        { value: 'rojo', label: 'Con deuda' },
        { value: 'sin_datos', label: 'Sin datos' },
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
      width: '22%',
      header: 'Generador',
      sortable: true,
      truncate: true,
      render: (row: Row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Factory size={20} className="text-purple-600" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900 text-sm leading-tight line-clamp-2">{row.razonSocial}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-neutral-500 font-mono">{row.cuit}</span>
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
      width: '9%',
      header: 'Categoria',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: Row) => {
        const cat = row.categoria !== '-' ? row.categoria : null;
        return cat ? (
          <Badge variant="soft" color={cat.includes('Grande') ? 'error' : cat.includes('Mediano') ? 'warning' : 'info'}>
            {cat.replace(' Generadores', '').replace('Generadores', 'Gen.')}
          </Badge>
        ) : (
          <span className="text-xs text-neutral-400">-</span>
        );
      },
    },
    {
      key: 'categoriasY',
      width: '10%',
      header: 'Corrientes Y',
      hiddenBelow: '2xl' as const,
      render: (row: Row) => row.categoriasControl.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.categoriasControl.slice(0, 3).map((code: string) => (
            <Badge key={code} variant="outline" color="warning" className="text-xs" title={CORRIENTES_Y[code] || code}>
              {code}
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
      width: '11%',
      header: 'Rubro / Actividad',
      hiddenBelow: '2xl' as const,
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
      width: '11%',
      header: 'Contacto',
      hiddenBelow: '2xl' as const,
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
      key: 'compliance',
      width: '8%',
      header: 'Compliance',
      hiddenBelow: 'xl' as const,
      render: (row: Row) => {
        const cfg = {
          verde: { icon: ShieldCheck, color: 'text-success-600', bg: 'bg-success-50', label: 'Al dia' },
          amarillo: { icon: ShieldAlert, color: 'text-warning-600', bg: 'bg-warning-50', label: 'Parcial' },
          rojo: { icon: ShieldX, color: 'text-error-600', bg: 'bg-error-50', label: 'Deuda' },
          sin_datos: { icon: ShieldAlert, color: 'text-neutral-400', bg: 'bg-neutral-50', label: 'S/D' },
        }[row.compliance];
        const Icon = cfg.icon;
        return (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${cfg.bg}`} title={
            { verde: 'Al dia - TEF pagado, DDJJ presentada, habilitado', amarillo: 'Parcial - Cumplimiento incompleto', rojo: 'Deuda - TEF impago y DDJJ no presentada', sin_datos: 'Sin datos de compliance' }[row.compliance]
          }>
            <Icon size={14} className={cfg.color} />
            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        );
      },
    },
    {
      key: 'ultimaActividad',
      width: '10%',
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
      width: '7%',
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
      width: '12%',
      header: '',
      align: 'right' as const,
      render: (row: Row) => (
        <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row._raw?.usuarioId && row.activo && (
            <button
              className="p-1 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
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
            className="p-1 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/generadores/${row.id}`); }}
            title="Ver"
          >
            <Eye size={14} />
          </button>
          <button
            className="p-1 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/generadores/${row.id}/editar`); }}
            title="Editar"
          >
            <Edit size={14} />
          </button>
          <button
            className="p-1 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/generadores/${row.id}/renovar`); }}
            title="Renovar"
          >
            <RefreshCw size={14} />
          </button>
          <button
            className="p-1 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, razonSocial: row.razonSocial }); }}
            title="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  // ── Render via GenericCRUDPage ──
  return (
    <GenericCRUDPage<Row>
      // Page metadata
      title="Admin Generadores"
      subtitle="Panel de gestion de generadores de residuos"
      icon={<Factory size={24} className="text-purple-600" />}
      iconBg="bg-purple-100"
      // Data
      data={filteredData}
      isLoading={isLoading}
      isError={isError}
      errorMessage={(error as Error)?.message}
      loadingMessage="Cargando generadores..."
      // Table
      columns={columns}
      getRowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/admin/actores/generadores/${row.id}`)}
      emptyMessage="No se encontraron generadores"
      // Search
      searchValue={busqueda}
      onSearchChange={(v) => { setBusqueda(v); setCurrentPage(1); }}
      searchPlaceholder="Buscar por razon social, CUIT o domicilio..."
      // Filters
      filters={filters}
      // Stats
      stats={statCards}
      // Sort
      sort={{ onSort: handleSort }}
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
      // CSV export
      csvExport={{
        mapRow: (g: Row) => ({
          'Razon Social': g.razonSocial,
          CUIT: g.cuit,
          Certificado: g.certificado || '',
          Categoria: g.categoria,
          Rubro: g.rubro || '',
          Actividad: g.actividad || '',
          'Categorias Y': g.categoriasControl.join(', '),
          'Email (original)': g.emailOriginal || '',
          Email: g.email,
          Telefono: g.telefono,
          Domicilio: g.domicilio,
          Inscripcion: g.numeroInscripcion,
          Estado: g.activo ? 'Activo' : 'Inactivo',
          Alta: g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '',
        }),
        filename: 'admin-generadores',
        metadata: {
          titulo: 'Admin Generadores',
          periodo: 'Todos los periodos',
          filtros: [filtroCategoria ? `Categoria: ${filtroCategoria}` : '', filtroRubro ? `Rubro: ${filtroRubro}` : '', filtroEstado !== 'todos' ? `Estado: ${filtroEstado}` : '', filtroCompliance !== 'todos' ? `Compliance: ${filtroCompliance}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
          total: filteredData.length,
        },
      }}
      // PDF export
      pdfExport={{
        titulo: 'Admin Generadores',
        subtitulo: `${filteredData.length} generadores${filtroCategoria ? ` — Categoria: ${filtroCategoria}` : ''}${filtroEstado !== 'todos' ? ` — ${filtroEstado}` : ''}`,
        periodo: new Date().toLocaleDateString('es-AR'),
        kpis: [
          { label: 'Total', value: statsData.total },
          { label: 'Activos', value: statsData.activos },
          { label: 'Al dia', value: statsData.alDia },
          { label: 'Con deuda', value: statsData.conDeuda },
        ],
        tabla: {
          headers: ['Razon Social', 'CUIT', 'Categoria', 'Rubro', 'Email', 'Inscripcion', 'Estado'],
          rows: filteredData.map(g => [g.razonSocial, g.cuit, g.categoria, g.rubro || '-', g.email, g.numeroInscripcion, g.activo ? 'Activo' : 'Inactivo']),
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
      renderMobileCard={(row) => (
        <Card className="p-3">
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
        </Card>
      )}
    />
  );
};

export default AdminGeneradoresPage;
