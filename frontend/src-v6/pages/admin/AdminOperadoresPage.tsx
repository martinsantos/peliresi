/**
 * SITREP v6 - Admin Operadores Page
 * ==================================
 * Panel administrativo para operadores de tratamiento
 * Integra datos de la API + enriquecimiento CSV (certificado, tipo, tecnologia, corrientes)
 *
 * Migrated to GenericCRUDPage — layout handled by the generic component,
 * page owns data hooks, enrichment, columns, and business logic.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
  Search,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { formatRelativeTime } from '../../utils/formatters';
import {
  useOperadores,
  useDeleteOperador,
} from '../../hooks/useActores';
import type { OperadorEnriched } from '../../data/operadores-enrichment';
import { CORRIENTES_Y, CORRIENTES_Y_CODES, parseCorrientes } from '../../data/corrientes-y';
import { useOperadoresEnrichment } from '../../hooks/useEnrichment';
import { GenericCRUDPage } from '../../components/crud/GenericCRUDPage';
import type { CRUDFilter, CRUDStatCard, Column } from '../../components/crud/GenericCRUDPage.types';

const AdminOperadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const { impersonateUser } = useImpersonation();
  const { data: enrichmentData } = useOperadoresEnrichment();
  const OPERADORES_DATA = enrichmentData?.operadores || {};

  // ── State ──
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCorriente, setFiltroCorriente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>('ultimaActividad');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);

  // ── API hooks ──
  const { data: apiData, isLoading, isError, error } = useOperadores({ page: currentPage, limit: 20, search: busqueda || undefined, sortBy, sortOrder });
  const deleteMutation = useDeleteOperador();

  const operadoresData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total || operadoresData.length;
  const totalPages = apiData?.totalPages || 1;

  // ── Map to display format + merge CSV enrichment ──
  const tableData = useMemo(() =>
    operadoresData.map((o: any) => {
      const enriched: OperadorEnriched | null = OPERADORES_DATA[o.cuit] || null;

      const residuosCodigos = o.tratamientos?.map((t: any) => t.tipoResiduo?.codigo).filter(Boolean) || [];
      const residuosUnicos = [...new Set(residuosCodigos)] as string[];
      const metodosUnicos = [...new Set(o.tratamientos?.map((t: any) => t.metodo).filter(Boolean) || [])] as string[];

      return {
        id: o.id,
        razonSocial: o.razonSocial || '',
        cuit: o.cuit || '',
        categoria: o.categoria || enriched?.tipoOperador || '-',
        domicilio: o.domicilio || '',
        telefono: o.telefono || '',
        email: o.email || o.usuario?.email || '',
        numeroHabilitacion: o.numeroHabilitacion || '-',
        tratamientosCount: o.tratamientos?.length || 0,
        residuosAceptados: residuosUnicos,
        metodosAutorizados: metodosUnicos,
        manifiestosProcesados: o._count?.manifiestos || 0,
        activo: o.activo !== false,
        createdAt: o.createdAt,
        ultimaActividad: o.ultimaActividad || null,
        _raw: o,
        certificado: enriched?.certificado || null,
        tipoOperador: o.tipoOperador || enriched?.tipoOperador || null,
        tecnologia: o.tecnologia || enriched?.tecnologia || null,
        corrientes: o.corrientesY ? parseCorrientes(o.corrientesY) : (enriched?.corrientes || []),
        corrientesYRaw: o.corrientesY || (enriched?.corrientes?.join(', ') || ''),
        mailCSV: enriched?.mail || null,
        telefonoCSV: enriched?.telefono || null,
        domicilioReal: enriched?.domicilioReal || null,
        domicilioLegal: enriched?.domicilioLegal || null,
        expediente: enriched?.expediente || null,
      };
    }),
    [operadoresData]
  );

  // ── Client-side filters ──
  const filteredData = useMemo(() => {
    return tableData.filter((o) => {
      if (filtroTipo && o.tipoOperador !== filtroTipo) return false;
      if (filtroCorriente && !o.corrientes.includes(filtroCorriente)) return false;
      const matchesEstado = filtroEstado === 'todos' ||
                            (filtroEstado === 'activo' && o.activo) ||
                            (filtroEstado === 'inactivo' && !o.activo);
      return matchesEstado;
    });
  }, [tableData, filtroTipo, filtroCorriente, filtroEstado]);

  // ── Sort mapping ──
  const OPER_COL_MAP: Record<string, string> = {
    operador: 'razonSocial',
    tipo: 'categoria',
    ultimaActividad: 'ultimaActividad',
    estado: 'activo',
  };

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortBy(OPER_COL_MAP[key] ?? key);
    setSortOrder(direction);
    setCurrentPage(1);
  };

  // ── Stats ──
  const statsData = {
    total,
    activos: operadoresData.filter((o: any) => o.activo !== false).length,
    inactivos: operadoresData.filter((o: any) => o.activo === false).length,
    filtrados: filteredData.length,
  };

  const statCards: CRUDStatCard[] = [
    { label: 'Total Operadores', value: statsData.total, icon: <FlaskConical size={20} className="text-emerald-600" />, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
    { label: 'Activos', value: statsData.activos, icon: <CheckCircle size={20} className="text-success-600" />, iconBg: 'bg-success-100', iconColor: 'text-success-600' },
    { label: 'Inactivos', value: statsData.inactivos, icon: <AlertTriangle size={20} className="text-warning-600" />, iconBg: 'bg-warning-100', iconColor: 'text-warning-600' },
    { label: 'Filtrados', value: statsData.filtrados, icon: <Search size={20} className="text-info-600" />, iconBg: 'bg-info-100', iconColor: 'text-info-600' },
  ];

  // ── Filters ──
  const filters: CRUDFilter[] = [
    {
      key: 'tipo',
      value: filtroTipo,
      onChange: (v) => { setFiltroTipo(v); setCurrentPage(1); },
      placeholder: 'Todos los tipos',
      options: [
        { value: '', label: 'Todos los tipos' },
        { value: 'FIJO', label: 'FIJO' },
        { value: 'IN SITU', label: 'IN SITU' },
      ],
    },
    {
      key: 'corriente',
      value: filtroCorriente,
      onChange: (v) => { setFiltroCorriente(v); setCurrentPage(1); },
      placeholder: 'Todas las corrientes',
      options: [
        { value: '', label: 'Todas las corrientes' },
        ...CORRIENTES_Y_CODES.map((code: string) => ({ value: code, label: code })),
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
  ];

  // ── Delete handler ──
  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Operador ${deleteTarget.razonSocial} eliminado`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  // ── Columns ──
  type Row = typeof tableData[0];

  const columns: Column<Row>[] = [
    {
      key: 'operador',
      width: '20%',
      header: 'Operador',
      sortable: true,
      render: (row: Row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <FlaskConical size={20} className="text-emerald-600" />
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
      key: 'tipo',
      width: '10%',
      header: 'Tipo',
      sortable: true,
      hiddenBelow: 'lg' as const,
      render: (row: Row) => {
        const tipo = (row.tipoOperador || row.categoria) as string;
        if (!tipo || tipo === '-') return <span className="text-xs text-neutral-400">-</span>;

        const modalidades = tipo.split('/').map((s: string) => s.trim()).filter(Boolean);
        return (
          <div className="flex flex-wrap gap-1">
            {modalidades.map((mod: string) => (
              <Badge key={mod} variant="soft" color={mod.includes('FIJO') ? 'primary' : 'success'}>
                {mod}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: 'corrientes',
      width: '12%',
      header: 'Corrientes',
      hiddenBelow: 'xl' as const,
      render: (row: Row) => row.corrientes.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.corrientes.slice(0, 3).map((code: string) => (
            <Badge key={code} variant="outline" color="warning" className="text-xs" title={CORRIENTES_Y[code] || code}>
              {code}
            </Badge>
          ))}
          {row.corrientes.length > 3 && (
            <Badge variant="soft" color="neutral" className="text-xs" title={row.corrientes.join(', ')}>
              +{row.corrientes.length - 3}
            </Badge>
          )}
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'tecnologia',
      width: '16%',
      header: 'Tecnologia',
      hiddenBelow: '2xl' as const,
      render: (row: Row) => row.tecnologia ? (
        <p className="text-xs text-neutral-600 line-clamp-2" title={row.tecnologia}>
          {row.tecnologia}
        </p>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'contacto',
      width: '14%',
      header: 'Contacto',
      hiddenBelow: '2xl' as const,
      render: (row: Row) => {
        const mail = row.mailCSV || row.email;
        const tel = row.telefonoCSV || row.telefono;
        return (
          <div className="text-xs min-w-0">
            {mail && (
              <p className="text-neutral-600 truncate flex items-center gap-1">
                <Mail size={11} className="flex-shrink-0" />
                <span className="truncate">{mail.split(';')[0].trim()}</span>
              </p>
            )}
            {tel && (
              <p className="text-neutral-500 flex items-center gap-1 mt-0.5">
                <Phone size={11} className="flex-shrink-0" />
                <span className="truncate">{tel}</span>
              </p>
            )}
            {!mail && !tel && <span className="text-neutral-400">-</span>}
          </div>
        );
      },
    },
    {
      key: 'ultimaActividad',
      width: '9%',
      header: 'Actividad',
      sortable: true,
      hiddenBelow: '2xl' as const,
      render: (row: Row) => row.ultimaActividad ? (
        <span className="text-xs text-neutral-600">{formatRelativeTime(row.ultimaActividad)}</span>
      ) : (
        <span className="text-xs text-neutral-400">Sin actividad</span>
      ),
    },
    {
      key: 'estado',
      width: '8%',
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
      width: '11%',
      header: '',
      align: 'right' as const,
      render: (row: Row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row._raw?.usuarioId && row.activo && (
            <button
              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
              title="Acceso Comodin — ver como este operador"
              onClick={async (e) => {
                e.stopPropagation();
                try { await impersonateUser(row._raw.usuarioId); }
                catch (err: any) { toast.error(err?.response?.data?.message || 'No se pudo acceder como este usuario'); }
              }}
            >
              <Eye size={16} />
            </button>
          )}
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/operadores/${row.id}`); }}
            title="Ver"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/operadores/${row.id}/editar`); }}
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(`/admin/actores/operadores/${row.id}/renovar`); }}
            title="Renovar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, razonSocial: row.razonSocial }); }}
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  // ── Render via GenericCRUDPage ──
  return (
    <GenericCRUDPage<Row>
      // Page metadata
      title="Admin Operadores"
      subtitle="Panel de gestion de operadores de tratamiento"
      icon={<FlaskConical size={24} className="text-emerald-600" />}
      iconBg="bg-emerald-100"
      // Data
      data={filteredData}
      isLoading={isLoading}
      isError={isError}
      errorMessage={(error as Error)?.message}
      loadingMessage="Cargando operadores..."
      // Table
      columns={columns}
      getRowKey={(row) => row.id}
      onRowClick={(row) => navigate(`/admin/actores/operadores/${row.id}`)}
      emptyMessage="No se encontraron operadores"
      // Search
      searchValue={busqueda}
      onSearchChange={(v) => { setBusqueda(v); setCurrentPage(1); }}
      searchPlaceholder="Buscar por razon social, CUIT o habilitacion..."
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
      onNew={() => navigate('/admin/actores/operadores/nuevo')}
      newLabel="Nuevo Operador"
      // CSV export
      csvExport={{
        mapRow: (o: Row) => ({
          'Razon Social': o.razonSocial,
          CUIT: o.cuit,
          Certificado: o.certificado || '',
          Tipo: o.tipoOperador || o.categoria,
          Habilitacion: o.numeroHabilitacion,
          Expediente: o.expediente || '',
          Corrientes: o.corrientes.join(', '),
          Tecnologia: o.tecnologia || '',
          'Email (CSV)': o.mailCSV || '',
          'Email (API)': o.email,
          'Telefono (CSV)': o.telefonoCSV || '',
          'Telefono (API)': o.telefono,
          'Direccion Real': o.domicilioReal ? `${o.domicilioReal.calle}, ${o.domicilioReal.localidad}, ${o.domicilioReal.departamento}` : '',
          'Direccion Fiscal': o.domicilioLegal ? `${o.domicilioLegal.calle}, ${o.domicilioLegal.localidad}, ${o.domicilioLegal.departamento}` : '',
          Tratamientos: o.tratamientosCount,
          Manifiestos: o.manifiestosProcesados,
          Estado: o.activo ? 'Activo' : 'Inactivo',
        }),
        filename: 'admin-operadores',
        metadata: {
          titulo: 'Admin Operadores',
          periodo: 'Todos los periodos',
          filtros: [filtroTipo ? `Tipo: ${filtroTipo}` : '', filtroCorriente ? `Corriente: ${filtroCorriente}` : '', filtroEstado !== 'todos' ? `Estado: ${filtroEstado}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
          total: filteredData.length,
        },
      }}
      // PDF export
      pdfExport={{
        titulo: 'Admin Operadores',
        subtitulo: `${filteredData.length} operadores${filtroTipo ? ` — Tipo: ${filtroTipo}` : ''}${filtroEstado !== 'todos' ? ` — ${filtroEstado}` : ''}`,
        periodo: new Date().toLocaleDateString('es-AR'),
        kpis: [
          { label: 'Total', value: statsData.total },
          { label: 'Activos', value: statsData.activos },
          { label: 'Inactivos', value: statsData.inactivos },
          { label: 'Filtrados', value: statsData.filtrados },
        ],
        tabla: {
          headers: ['Razon Social', 'CUIT', 'Tipo', 'Habilitacion', 'Corrientes', 'Tratamientos', 'Estado'],
          rows: filteredData.map(o => [o.razonSocial, o.cuit, o.tipoOperador || o.categoria, o.numeroHabilitacion, o.corrientes.join(', '), o.tratamientosCount, o.activo ? 'Activo' : 'Inactivo']),
        },
      }}
      // Delete
      deleteConfig={{
        target: deleteTarget ? { id: deleteTarget.id, label: deleteTarget.razonSocial } : null,
        onDelete: handleEliminar,
        onClose: () => setDeleteTarget(null),
        isLoading: deleteMutation.isPending,
        title: 'Eliminar Operador',
      }}
      // Mobile card view
      renderMobileCard={(row) => (
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <FlaskConical size={16} className="text-emerald-600" />
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
          <div className="flex items-center gap-3 mt-2 text-xs text-neutral-500">
            {row.tipoOperador && <span className="bg-neutral-100 px-2 py-0.5 rounded">{row.tipoOperador}</span>}
            {row.corrientes.length > 0 && <span>{row.corrientes.slice(0, 3).join(', ')}</span>}
          </div>
        </Card>
      )}
    />
  );
};

export default AdminOperadoresPage;
