/**
 * SITREP v6 - Admin Operadores Page
 * ==================================
 * Panel administrativo para operadores de tratamiento
 * Integra datos de la API + enriquecimiento CSV (certificado, tipo, tecnología, corrientes)
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
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
  RefreshCw,
  FileDown,
  Printer,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { formatRelativeTime } from '../../utils/formatters';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import {
  useOperadores,
  useCreateOperador,
  useDeleteOperador,
} from '../../hooks/useActores';
import type { OperadorEnriched } from '../../data/operadores-enrichment';
import { CORRIENTES_Y, CORRIENTES_Y_CODES, parseCorrientes } from '../../data/corrientes-y';
import { useOperadoresEnrichment } from '../../hooks/useEnrichment';

const INITIAL_FORM = {
  razonSocial: '',
  cuit: '',
  domicilio: '',
  telefono: '',
  email: '',
  password: '',
  nombre: '',
  numeroHabilitacion: '',
  categoria: '',
  tipoOperador: '',
  tecnologia: '',
  corrientesY: '',
};

const AdminOperadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAdmin, impersonateUser } = useAuth();
  const { data: enrichmentData } = useOperadoresEnrichment();
  const OPERADORES_DATA = enrichmentData?.operadores || {};
  const [busqueda, setBusqueda] = useState(searchParams.get('q') || '');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCorriente, setFiltroCorriente] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<string | undefined>('ultimaActividad');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: apiData, isLoading, isError, error } = useOperadores({ page: currentPage, limit: 20, search: busqueda || undefined, sortBy, sortOrder });
  const createMutation = useCreateOperador();
  const deleteMutation = useDeleteOperador();

  const operadoresData = Array.isArray(apiData?.items) ? apiData.items : [];
  const total = apiData?.total || operadoresData.length;
  const totalPages = apiData?.totalPages || 1;

  // Map to display format + merge CSV enrichment
  const tableData = useMemo(() =>
    operadoresData.map((o: any) => {
      const enriched: OperadorEnriched | null = OPERADORES_DATA[o.cuit] || null;

      // API residuos
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
        // DB fields with CSV enrichment fallback
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

  // Client-side filters (tipo, corriente, estado); sort is server-side
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

  const stats = {
    total,
    activos: operadoresData.filter((o: any) => o.activo !== false).length,
    inactivos: operadoresData.filter((o: any) => o.activo === false).length,
    filtrados: filteredData.length,
  };

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCrear = async () => {
    if (!form.razonSocial || !form.cuit || !form.email) {
      toast.error('Campos requeridos', 'Razón social, CUIT y email son obligatorios');
      return;
    }
    try {
      await createMutation.mutateAsync({
        email: form.email,
        password: form.password || 'TempPass123!',
        nombre: form.nombre || form.razonSocial,
        razonSocial: form.razonSocial,
        cuit: form.cuit,
        domicilio: form.domicilio,
        telefono: form.telefono,
        numeroHabilitacion: form.numeroHabilitacion,
        categoria: form.categoria,
        tipoOperador: form.tipoOperador,
        tecnologia: form.tecnologia,
        corrientesY: form.corrientesY,
      });
      toast.success('Creado', `Operador ${form.razonSocial} creado`);
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo crear el operador');
    }
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Operador ${deleteTarget.razonSocial} eliminado`);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  const handleExport = () => {
    downloadCsv(
      filteredData.map(o => ({
        'Razón Social': o.razonSocial,
        CUIT: o.cuit,
        Certificado: o.certificado || '',
        Tipo: o.tipoOperador || o.categoria,
        Habilitación: o.numeroHabilitacion,
        Expediente: o.expediente || '',
        Corrientes: o.corrientes.join(', '),
        Tecnología: o.tecnologia || '',
        'Email (CSV)': o.mailCSV || '',
        'Email (API)': o.email,
        'Teléfono (CSV)': o.telefonoCSV || '',
        'Teléfono (API)': o.telefono,
        'Direccion Real': o.domicilioReal ? `${o.domicilioReal.calle}, ${o.domicilioReal.localidad}, ${o.domicilioReal.departamento}` : '',
        'Direccion Fiscal': o.domicilioLegal ? `${o.domicilioLegal.calle}, ${o.domicilioLegal.localidad}, ${o.domicilioLegal.departamento}` : '',
        Tratamientos: o.tratamientosCount,
        Manifiestos: o.manifiestosProcesados,
        Estado: o.activo ? 'Activo' : 'Inactivo',
      })),
      'admin-operadores',
      {
        titulo: 'Admin Operadores',
        periodo: 'Todos los periodos',
        filtros: [filtroTipo ? `Tipo: ${filtroTipo}` : '', filtroCorriente ? `Corriente: ${filtroCorriente}` : '', filtroEstado !== 'todos' ? `Estado: ${filtroEstado}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
        total: filteredData.length,
      }
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const handleExportPdf = () => {
    exportReportePDF({
      titulo: 'Admin Operadores',
      subtitulo: `${filteredData.length} operadores${filtroTipo ? ` — Tipo: ${filtroTipo}` : ''}${filtroEstado !== 'todos' ? ` — ${filtroEstado}` : ''}`,
      periodo: new Date().toLocaleDateString('es-AR'),
      kpis: [
        { label: 'Total', value: stats.total },
        { label: 'Activos', value: stats.activos },
        { label: 'Inactivos', value: stats.inactivos },
        { label: 'Filtrados', value: stats.filtrados },
      ],
      tabla: {
        headers: ['Razon Social', 'CUIT', 'Tipo', 'Habilitacion', 'Corrientes', 'Tratamientos', 'Estado'],
        rows: filteredData.map(o => [o.razonSocial, o.cuit, o.tipoOperador || o.categoria, o.numeroHabilitacion, o.corrientes.join(', '), o.tratamientosCount, o.activo ? 'Activo' : 'Inactivo']),
      },
    });
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Razon Social" value={form.razonSocial} onChange={(e) => updateField('razonSocial', e.target.value)} placeholder="Empresa S.A." />
        <Input label="CUIT" value={form.cuit} onChange={(e) => updateField('cuit', e.target.value)} placeholder="30-12345678-9" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="contacto@empresa.com" />
        <Input label="Telefono" value={form.telefono} onChange={(e) => updateField('telefono', e.target.value)} placeholder="+54 261 ..." />
      </div>
      <Input label="Domicilio" value={form.domicilio} onChange={(e) => updateField('domicilio', e.target.value)} placeholder="Ruta 40 Km 1234, Guaymallen" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="N. Habilitacion" value={form.numeroHabilitacion} onChange={(e) => updateField('numeroHabilitacion', e.target.value)} placeholder="O-000XXX" />
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Categoria</label>
          <select
            value={form.categoria}
            onChange={(e) => updateField('categoria', e.target.value)}
            className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="FIJO">FIJO</option>
            <option value="IN SITU">IN SITU</option>
            <option value="FIJO / IN SITU">FIJO / IN SITU</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo Operador</label>
          <select
            value={form.tipoOperador}
            onChange={(e) => updateField('tipoOperador', e.target.value)}
            className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
          >
            <option value="">Seleccionar...</option>
            <option value="FIJO">FIJO</option>
            <option value="IN SITU">IN SITU</option>
            <option value="FIJO / IN SITU">FIJO / IN SITU</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Corrientes Y (separadas por coma)</label>
          <input
            value={form.corrientesY}
            onChange={(e) => updateField('corrientesY', e.target.value)}
            placeholder="Ej: Y8, Y9, Y12, Y48"
            className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Tecnología</label>
        <textarea
          value={form.tecnologia}
          onChange={(e) => updateField('tecnologia', e.target.value)}
          placeholder="Descripción de las tecnologías de tratamiento autorizadas..."
          rows={3}
          className="w-full px-4 py-2 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none text-sm resize-none"
        />
      </div>
      {form.corrientesY && (
        <div className="flex flex-wrap gap-1">
          {parseCorrientes(form.corrientesY).map(code => (
            <span key={code} className="text-[11px] px-1.5 py-0.5 bg-warning-50 text-warning-700 border border-warning-200 rounded" title={CORRIENTES_Y[code] || code}>
              {code}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <Input label="Nombre Responsable" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Juan Perez" />
        <Input label="Password inicial" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min. 8 caracteres" />
      </div>
    </div>
  );

  const columns = [
    {
      key: 'operador',
      width: '22%',
      header: 'Operador',
      sortable: true,
      render: (row: typeof tableData[0]) => (
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
      render: (row: typeof tableData[0]) => {
        const tipo = (row.tipoOperador || row.categoria) as string;
        if (!tipo || tipo === '-') return <span className="text-xs text-neutral-400">-</span>;

        // Parse modalidades: "FIJO / IN SITU" → ["FIJO", "IN SITU"]
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
      render: (row: typeof tableData[0]) => row.corrientes.length > 0 ? (
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
      width: '18%',
      header: 'Tecnología',
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => row.tecnologia ? (
        <p className="text-xs text-neutral-600 line-clamp-2" title={row.tecnologia}>
          {row.tecnologia}
        </p>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'contacto',
      width: '16%',
      header: 'Contacto',
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => {
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
      width: '10%',
      header: 'Actividad',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: typeof tableData[0]) => row.ultimaActividad ? (
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
      render: (row: typeof tableData[0]) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'warning'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '14%',
      header: '',
      align: 'right' as const,
      render: (row: typeof tableData[0]) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && row._raw?.usuarioId && row.activo && (
            <button
              className="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
              title="Acceso Comodín — ver como este operador"
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
          <div className="p-3 bg-emerald-100 rounded-xl">
            <FlaskConical size={24} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Admin Operadores</h2>
            <p className="text-neutral-600">Panel de gestión de operadores de tratamiento</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir"><Printer size={14} />Imprimir</button>
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport} className="hidden sm:inline-flex">
            CSV
          </Button>
          <Button variant="outline" leftIcon={<FileDown size={18} />} onClick={handleExportPdf} className="hidden sm:inline-flex text-error-700 border-error-200 hover:bg-error-50">
            PDF
          </Button>
          <Button leftIcon={<Plus size={18} />} onClick={() => navigate('/admin/actores/operadores/nuevo')}>
            Nuevo Operador
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <FlaskConical size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.total}</p>
                <p className="text-sm text-neutral-600">Total Operadores</p>
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
              <div className="p-2 bg-warning-100 rounded-lg">
                <AlertTriangle size={20} className="text-warning-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.inactivos}</p>
                <p className="text-sm text-neutral-600">Inactivos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <Search size={20} className="text-info-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stats.filtrados}</p>
                <p className="text-sm text-neutral-600">Filtrados</p>
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
                placeholder="Buscar por razón social, CUIT o habilitación..."
                size="md"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={filtroTipo}
                onChange={(e) => { setFiltroTipo(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todos los tipos</option>
                <option value="FIJO">FIJO</option>
                <option value="IN SITU">IN SITU</option>
              </select>
              <select
                value={filtroCorriente}
                onChange={(e) => { setFiltroCorriente(e.target.value); setCurrentPage(1); }}
                className="px-4 h-10 rounded-xl border border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
              >
                <option value="">Todas las corrientes</option>
                {CORRIENTES_Y_CODES.map(code => (
                  <option key={code} value={code}>{code}</option>
                ))}
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando operadores...</span>
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
              onRowClick={(row) => navigate(`/admin/actores/operadores/${row.id}`)}
              emptyMessage="No se encontraron operadores"
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

      {/* Modal crear */}
      <Modal
        isOpen={modalCrear}
        onClose={() => { setModalCrear(false); setForm(INITIAL_FORM); }}
        title="Nuevo Operador"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalCrear(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Crear Operador'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal eliminar */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setDeleteTarget(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Operador"
        description={`¿Está seguro que desea eliminar a "${deleteTarget?.razonSocial}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminOperadoresPage;
