/**
 * SITREP v6 - Admin Generadores Page
 * ==================================
 * Panel administrativo para generadores de residuos
 * Integra datos de la API + enriquecimiento JSON (certificado, rubro, actividad, categorías Y)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Factory,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
  Download,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { toast } from '../../components/ui/Toast';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuth } from '../../contexts/AuthContext';
import {
  useGeneradores,
  useDeleteGenerador,
} from '../../hooks/useActores';
import { GENERADORES_DATA, TOP_RUBROS, type GeneradorEnriched } from '../../data/generadores-enrichment';
import { CORRIENTES_Y, parseCorrientes } from '../../data/corrientes-y';

const AdminGeneradoresPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const { isAdmin, impersonateUser } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroRubro, setFiltroRubro] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroCompliance, setFiltroCompliance] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalEliminar, setModalEliminar] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);

  // API hooks
  const { data: apiData, isLoading, isError, error } = useGeneradores({ page: currentPage, limit: 20, search: busqueda || undefined, sortBy, sortOrder });
  const deleteMutation = useDeleteGenerador();

  const generadoresData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total || generadoresData.length;
  const totalPages = apiData?.totalPages || 1;

  // Map to display format + merge JSON enrichment + compute compliance
  const tableData = useMemo(() =>
    generadoresData.map((g: any) => {
      const enriched: GeneradorEnriched | null = GENERADORES_DATA[g.cuit] || null;

      // Compliance: green = TEF paid + DDJJ presented + habilitado; yellow = partial; red = 2+ years unpaid
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
        _raw: g,
        compliance,
        // DB fields with JSON enrichment fallback
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

  // Client-side filters (rubro, categoria, estado, compliance); sort is server-side
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

  const GEN_COL_MAP: Record<string, string> = {
    generador: 'razonSocial',
    categoria: 'categoria',
    estado: 'activo',
  };

  const handleSort = (key: string, direction: 'asc' | 'desc') => {
    setSortBy(GEN_COL_MAP[key] ?? key);
    setSortOrder(direction);
    setCurrentPage(1);
  };

  const stats = {
    total,
    activos: generadoresData.filter((g: any) => g.activo !== false).length,
    alDia: tableData.filter(g => g.compliance === 'verde').length,
    conDeuda: tableData.filter(g => g.compliance === 'rojo').length,
  };

  const openEditar = (row: typeof tableData[0]) => {
    navigate(isMobile ? `/mobile/admin/actores/generadores/${row.id}/editar` : `/admin/actores/generadores/${row.id}/editar`);
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Generador ${deleteTarget.razonSocial} eliminado`);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  const handleExport = () => {
    downloadCsv(
      filteredData.map(g => ({
        'Razón Social': g.razonSocial,
        CUIT: g.cuit,
        Certificado: g.certificado || '',
        Categoría: g.categoria,
        Rubro: g.rubro || '',
        Actividad: g.actividad || '',
        'Categorías Y': g.categoriasControl.join(', '),
        'Email (original)': g.emailOriginal || '',
        Email: g.email,
        Teléfono: g.telefono,
        Domicilio: g.domicilio,
        Inscripción: g.numeroInscripcion,
        Estado: g.activo ? 'Activo' : 'Inactivo',
        Alta: g.createdAt ? new Date(g.createdAt).toLocaleDateString() : '',
      })),
      'admin-generadores'
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const columns = [
    {
      key: 'generador',
      width: '22%',
      header: 'Generador',
      sortable: true,
      render: (row: typeof tableData[0]) => (
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
      width: '10%',
      header: 'Categoría',
      sortable: true,
      hiddenBelow: 'md' as const,
      render: (row: typeof tableData[0]) => {
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
      width: '12%',
      header: 'Corrientes Y',
      hiddenBelow: 'lg' as const,
      render: (row: typeof tableData[0]) => row.categoriasControl.length > 0 ? (
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
      width: '16%',
      header: 'Rubro / Actividad',
      hiddenBelow: 'lg' as const,
      render: (row: typeof tableData[0]) => {
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
      width: '16%',
      header: 'Contacto',
      hiddenBelow: 'lg' as const,
      render: (row: typeof tableData[0]) => {
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
      width: '7%',
      header: 'Compliance',
      hiddenBelow: 'md' as const,
      render: (row: typeof tableData[0]) => {
        const cfg = {
          verde: { icon: ShieldCheck, color: 'text-success-600', bg: 'bg-success-50', label: 'Al dia' },
          amarillo: { icon: ShieldAlert, color: 'text-warning-600', bg: 'bg-warning-50', label: 'Parcial' },
          rojo: { icon: ShieldX, color: 'text-error-600', bg: 'bg-error-50', label: 'Deuda' },
          sin_datos: { icon: ShieldAlert, color: 'text-neutral-400', bg: 'bg-neutral-50', label: 'S/D' },
        }[row.compliance];
        const Icon = cfg.icon;
        return (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${cfg.bg}`} title={cfg.label}>
            <Icon size={14} className={cfg.color} />
            <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          </div>
        );
      },
    },
    {
      key: 'estado',
      width: '7%',
      header: 'Estado',
      sortable: true,
      render: (row: typeof tableData[0]) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'warning'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '10%',
      header: '',
      align: 'right' as const,
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row._raw?.usuarioId && row.activo && (
            <button
              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
              title="Acceso Comodín — ver como este generador"
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
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/admin/actores/generadores/${row.id}` : `/admin/actores/generadores/${row.id}`); }}
            title="Ver"
          >
            <Eye size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-info-600 hover:bg-info-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); openEditar(row); }}
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/admin/actores/generadores/${row.id}/renovar` : `/admin/actores/generadores/${row.id}/renovar`); }}
            title="Renovar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="p-1.5 text-neutral-400 hover:text-error-600 hover:bg-error-50 rounded-lg transition-colors"
            onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: row.id, razonSocial: row.razonSocial }); setModalEliminar(true); }}
            title="Eliminar"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Factory size={24} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Admin Generadores</h2>
            <p className="text-neutral-600">Panel de gestión de generadores de residuos</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport}>
            Exportar
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => navigate(isMobile ? '/mobile/admin/actores/generadores/nuevo' : '/admin/actores/generadores/nuevo')}>
            Nuevo Generador
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Factory size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-600">Total Generadores</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <CheckCircle size={20} className="text-success-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.activos}</p>
                <p className="text-sm text-neutral-600">Activos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <ShieldCheck size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.alDia}</p>
                <p className="text-sm text-neutral-600">Al dia</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <ShieldX size={20} className="text-error-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.conDeuda}</p>
                <p className="text-sm text-neutral-600">Con deuda</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={busqueda}
                onChange={(v) => { setBusqueda(v); setCurrentPage(1); }}
                placeholder="Buscar por razón social, CUIT o domicilio..."
                size="md"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroRubro}
                onChange={(e) => { setFiltroRubro(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todos los rubros</option>
                {TOP_RUBROS.map(r => (
                  <option key={r} value={r}>{r.length > 35 ? r.substring(0, 33) + '...' : r}</option>
                ))}
              </select>
              <select
                value={filtroCategoria}
                onChange={(e) => { setFiltroCategoria(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las categorías</option>
                <option value="Grandes">Grandes Generadores</option>
                <option value="Medianos">Medianos Generadores</option>
                <option value="Pequeños">Pequeños Generadores</option>
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => { setFiltroEstado(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
              <select
                value={filtroCompliance}
                onChange={(e) => { setFiltroCompliance(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="todos">Compliance: Todos</option>
                <option value="verde">Al dia</option>
                <option value="amarillo">Parcial</option>
                <option value="rojo">Con deuda</option>
                <option value="sin_datos">Sin datos</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando generadores...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-error-600">
            <span>Error al cargar datos: {(error as Error)?.message || 'Error desconocido'}</span>
          </div>
        ) : (
          <>
            <Table
              data={filteredData}
              columns={columns}
              keyExtractor={(row) => row.id}
              sortable={true}
              onSort={handleSort}
              onRowClick={(row) => navigate(isMobile ? `/mobile/admin/actores/generadores/${row.id}` : `/admin/actores/generadores/${row.id}`)}
              emptyMessage="No se encontraron generadores"
              stickyHeader
              fixedLayout
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={20}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Modal eliminar */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setDeleteTarget(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Generador"
        description={`¿Está seguro que desea eliminar a "${deleteTarget?.razonSocial}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminGeneradoresPage;
