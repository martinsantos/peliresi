/**
 * SITREP v6 - Admin Residuos Page
 * ================================
 * Catalogo de residuos con CRUD completo, enriquecimiento de corrientes Y,
 * operadores, conteo de generadores/manifiestos y modal de detalle.
 */

import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  AlertTriangle,
  Leaf,
  Beaker,
  Download,
  FileDown,
  Loader2,
  Flame,
  Plus,
  Edit,
  Trash2,
  Factory,
  FileText,
  ExternalLink,
  X,
  Building2,
  Users,
  Printer,
} from 'lucide-react';
import { Card, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import { Table, Pagination } from '../../components/ui/Table';
import { SearchInput } from '../../components/ui/SearchInput';
import { useTiposResiduoEnriched, useCatalogoGeneradores, useCreateTipoResiduo, useUpdateTipoResiduo, useDeleteTipoResiduo } from '../../hooks/useCatalogos';
import { toast } from '../../components/ui/Toast';
import { Select } from '../../components/ui/Select';
import { downloadCsv } from '../../utils/exportCsv';
import { exportReportePDF } from '../../utils/exportPdf';
import { CORRIENTES_Y, CORRIENTES_Y_CODES } from '../../data/corrientes-y';
import { useOperadoresEnrichment } from '../../hooks/useEnrichment';
import { useOperadores } from '../../hooks/useOperadores';
import { useManifiestos } from '../../hooks/useManifiestos';
import { useNavigate } from 'react-router-dom';

/** Parse corrientes Basel codes from various formats: "Y8-Y48", "Y8,Y48", "Y4/Y8/Y9" */
function parseCorrientes(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(s => s.trim()).filter(Boolean);
  return raw.split(/[,/]|(?<=\d)-(?=Y)/i).map(s => s.replace(/\s*e\s*$/, '').trim()).filter(Boolean);
}

interface ResiduoDisplay {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  caracteristicas: string;
  tipo: string;
  peligrosidad: string;
  activo: boolean;
  corrienteY: string | null;
  corrienteDesc: string | null;
  operadoresCount: number;
  operadoresDbCount: number;
  generadoresCount: number;
  manifestosCount: number;
  tecnologias: string[];
}

const INITIAL_FORM = {
  codigo: '',
  nombre: '',
  descripcion: '',
  categoria: '',
  caracteristicas: '',
  peligrosidad: 'ninguna',
};

export const AdminResiduosPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: enrichmentData } = useOperadoresEnrichment();
  const OPERADORES_DATA = enrichmentData?.operadores || {};
  const OPERADORES_POR_CORRIENTE = enrichmentData?.porCorriente || {};
  // DB operadores for CUIT→ID mapping (navigation)
  const { data: dbOperadores } = useOperadores({ limit: 200 });
  const operadorIdByCuit = useMemo(() => {
    const map: Record<string, string> = {};
    for (const op of dbOperadores?.items || []) {
      if (op.cuit) map[op.cuit] = op.id;
    }
    return map;
  }, [dbOperadores]);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [corrienteFilter, setCorrienteFilter] = useState('');
  const [peligrosidadFilter, setPeligrosidadFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // CRUD modal state
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [detalleResiduo, setDetalleResiduo] = useState<ResiduoDisplay | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; codigo: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: enrichedResponse, isLoading, isError, error } = useTiposResiduoEnriched();
  const tiposResiduo = enrichedResponse?.tiposResiduos || [];
  const manifiestosPorResiduo = enrichedResponse?.manifiestosPorResiduo || {};
  const operadoresPorResiduo = enrichedResponse?.operadoresPorResiduo || {};

  const { data: generadoresList } = useCatalogoGeneradores();
  const generadoresArr = generadoresList || [];

  const createMutation = useCreateTipoResiduo();
  const updateMutation = useUpdateTipoResiduo();
  const deleteMutation = useDeleteTipoResiduo();

  // Count generadores per corriente Y (client-side from generadores list)
  const generadoresPorCorriente = useMemo(() => {
    const map: Record<string, number> = {};
    for (const gen of generadoresArr) {
      const corrientes = parseCorrientes((gen as any).corrientesControl || (gen as any).categoriasControl || (gen as any).categoria);
      for (const c of corrientes) {
        const yMatch = c.match(/Y\d+/);
        if (yMatch) {
          map[yMatch[0]] = (map[yMatch[0]] || 0) + 1;
        }
      }
    }
    return map;
  }, [generadoresArr]);

  // Map API data + enrich with corrientes Y and operadores
  const residuosData: ResiduoDisplay[] = useMemo(() =>
    tiposResiduo.map(r => {
      // Extract corriente Y from the codigo field (e.g., "Y8", "Y48", "R9")
      const codigoMatch = (r.codigo || '').match(/^(Y\d+|R\d+)/i);
      const corrienteY = codigoMatch ? codigoMatch[0].toUpperCase() : null;
      const corrienteDesc = corrienteY ? CORRIENTES_Y[corrienteY] || null : null;

      const operadoresCuits = corrienteY ? (OPERADORES_POR_CORRIENTE[corrienteY] || []) : [];
      const operadoresCount = operadoresCuits.length;
      const operadoresDbCount = operadoresPorResiduo[r.id] || 0;

      const generadoresCount = corrienteY ? (generadoresPorCorriente[corrienteY] || 0) : 0;
      const manifestosCount = manifiestosPorResiduo[r.id] || 0;

      const tecnologias: string[] = [];
      const tecSet = new Set<string>();
      for (const cuit of operadoresCuits.slice(0, 10)) {
        const op = OPERADORES_DATA[cuit];
        if (op?.tecnologia) {
          const parts = op.tecnologia.split(/,\s*(?=[A-Z])/).map(t => t.trim());
          for (const p of parts) {
            const clean = p.replace(/:\s*Y\d+[^,]*/g, '').trim();
            if (clean.length > 5 && !tecSet.has(clean)) {
              tecSet.add(clean);
              tecnologias.push(clean);
            }
          }
        }
      }

      return {
        id: r.id,
        codigo: r.codigo,
        nombre: r.nombre,
        descripcion: r.descripcion || r.nombre,
        categoria: r.categoria || 'Sin categoria',
        caracteristicas: r.caracteristicas || '',
        tipo: (r.peligrosidad && r.peligrosidad.toLowerCase() !== 'ninguna' && r.peligrosidad.toLowerCase() !== 'no peligroso') ? 'Peligroso' : 'No Peligroso',
        peligrosidad: r.peligrosidad || 'ninguna',
        activo: r.activo,
        corrienteY,
        corrienteDesc,
        operadoresCount,
        operadoresDbCount,
        generadoresCount,
        manifestosCount,
        tecnologias: tecnologias.slice(0, 5),
      };
    }),
    [tiposResiduo, generadoresPorCorriente, manifiestosPorResiduo, operadoresPorResiduo]
  );

  // Stats
  const statsPeligrosos = residuosData.filter(r => r.tipo === 'Peligroso').length;
  const statsNoPeligrosos = residuosData.filter(r => r.tipo === 'No Peligroso').length;
  const statsTotal = residuosData.length;
  const corrientesActivas = useMemo(() => {
    const codes = new Set(residuosData.map(r => r.corrienteY).filter(Boolean));
    return codes.size;
  }, [residuosData]);
  const totalManifiestos = useMemo(() => {
    return Object.values(manifiestosPorResiduo).reduce((sum, n) => sum + n, 0);
  }, [manifiestosPorResiduo]);

  // Filter + sort
  const filteredData = useMemo(() => {
    let result = residuosData.filter(r => {
      if (corrienteFilter && r.corrienteY !== corrienteFilter) return false;
      if (peligrosidadFilter && r.peligrosidad !== peligrosidadFilter) return false;
      if (estadoFilter === 'activo' && !r.activo) return false;
      if (estadoFilter === 'inactivo' && r.activo) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.codigo.toLowerCase().includes(q) ||
        r.descripcion.toLowerCase().includes(q) ||
        r.categoria.toLowerCase().includes(q) ||
        (r.corrienteY || '').toLowerCase().includes(q)
      );
    });
    if (sortConfig) {
      const PELIGROSIDAD_ORDER: Record<string, number> = { 'Tóxico': 4, 'Inflamable': 3, 'Corrosivo': 3, 'Reactivo': 3, 'alta': 3, 'media': 2, 'baja': 1, 'ninguna': 0, 'No Peligroso': 0 };
      result = [...result].sort((a, b) => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        switch (sortConfig.key) {
          case 'residuo': return dir * a.codigo.localeCompare(b.codigo, 'es');
          case 'corrienteY': return dir * (a.corrienteY || '').localeCompare(b.corrienteY || '', 'es');
          case 'peligrosidad': return dir * ((PELIGROSIDAD_ORDER[a.peligrosidad] || 0) - (PELIGROSIDAD_ORDER[b.peligrosidad] || 0));
          case 'operadores': return dir * (a.operadoresCount - b.operadoresCount);
          case 'generadores': return dir * (a.generadoresCount - b.generadoresCount);
          case 'manifiestos': return dir * (a.manifestosCount - b.manifestosCount);
          case 'estado': return dir * (Number(b.activo) - Number(a.activo));
          default: return 0;
        }
      });
    }
    return result;
  }, [residuosData, corrienteFilter, peligrosidadFilter, estadoFilter, searchQuery, sortConfig]);

  // Pagination
  const itemsPerPage = 15;
  const totalFilteredPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Form helpers
  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCrear = async () => {
    if (!form.codigo || !form.nombre || !form.categoria || !form.peligrosidad) {
      toast.error('Campos requeridos', 'Codigo, nombre, categoria y peligrosidad son obligatorios');
      return;
    }
    try {
      await createMutation.mutateAsync({
        codigo: form.codigo,
        nombre: form.nombre,
        descripcion: form.descripcion || null,
        categoria: form.categoria,
        caracteristicas: form.caracteristicas || null,
        peligrosidad: form.peligrosidad,
      });
      toast.success('Creado', `Tipo de residuo ${form.codigo} creado`);
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo crear el tipo de residuo');
    }
  };

  const openEditar = (r: ResiduoDisplay) => {
    setEditId(r.id);
    setForm({
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      categoria: r.categoria,
      caracteristicas: r.caracteristicas || '',
      peligrosidad: r.peligrosidad,
    });
    setModalEditar(true);
  };

  const handleEditar = async () => {
    if (!editId) return;
    try {
      await updateMutation.mutateAsync({
        id: editId,
        data: {
          codigo: form.codigo,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          categoria: form.categoria,
          caracteristicas: form.caracteristicas || null,
          peligrosidad: form.peligrosidad,
        },
      });
      toast.success('Actualizado', `Tipo de residuo ${form.codigo} actualizado`);
      setModalEditar(false);
      setEditId(null);
      setForm(INITIAL_FORM);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo actualizar');
    }
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('Eliminado', `Tipo de residuo ${deleteTarget.codigo} eliminado`);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo eliminar');
    }
  };

  const openDetalle = (r: ResiduoDisplay) => {
    setDetalleResiduo(r);
    setModalDetalle(true);
  };

  const handleExport = () => {
    downloadCsv(
      filteredData.map(r => ({
        Codigo: r.codigo,
        Nombre: r.nombre,
        Descripcion: r.descripcion,
        Categoria: r.categoria,
        'Corriente Y': r.corrienteY || '',
        'Desc. Corriente': r.corrienteDesc || '',
        Tipo: r.tipo,
        Peligrosidad: r.peligrosidad,
        'Operadores Autorizados': r.operadoresCount,
        Generadores: r.generadoresCount,
        Manifiestos: r.manifestosCount,
        Tecnologias: r.tecnologias.join('; '),
        Estado: r.activo ? 'Activo' : 'Inactivo',
      })),
      'catalogo-residuos',
      {
        titulo: 'Catalogo de Residuos',
        periodo: 'Todos los periodos',
        filtros: [corrienteFilter ? `Corriente: ${corrienteFilter}` : '', peligrosidadFilter ? `Peligrosidad: ${peligrosidadFilter}` : '', estadoFilter ? `Estado: ${estadoFilter}` : ''].filter(Boolean).join(', ') || 'Sin filtros',
        total: filteredData.length,
      }
    );
    toast.success('Exportar', 'CSV descargado');
  };

  const handleExportPdf = () => {
    exportReportePDF({
      titulo: 'Catálogo de Residuos',
      subtitulo: 'Tipos de residuos, corrientes Y y operadores autorizados',
      periodo: `Total: ${statsTotal} tipos de residuos`,
      kpis: [
        { label: 'Total Tipos', value: statsTotal },
        { label: 'Peligrosos', value: statsPeligrosos },
        { label: 'No Peligrosos', value: statsNoPeligrosos },
        { label: 'Corrientes Y', value: corrientesActivas },
      ],
      tabla: {
        headers: ['Código', 'Nombre', 'Categoría', 'Corriente Y', 'Tipo', 'Peligrosidad', 'Operadores', 'Manifiestos', 'Estado'],
        rows: filteredData.map(r => [
          r.codigo,
          r.nombre,
          r.categoria,
          r.corrienteY || '',
          r.tipo,
          r.peligrosidad,
          r.operadoresCount,
          r.manifestosCount,
          r.activo ? 'Activo' : 'Inactivo',
        ]),
      },
    });
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Input label="Codigo *" value={form.codigo} onChange={(e) => updateField('codigo', e.target.value)} placeholder="Y1-001" />
        <Input label="Nombre *" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Desechos clinicos" />
      </div>
      <Input label="Descripcion" value={form.descripcion} onChange={(e) => updateField('descripcion', e.target.value)} placeholder="Descripcion del tipo de residuo" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Input label="Categoria *" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} placeholder="Y1 - Desechos clinicos" />
        <Select
          label="Peligrosidad *"
          value={form.peligrosidad}
          onChange={(val) => updateField('peligrosidad', val)}
          options={[
            { value: 'alta', label: 'Alta' },
            { value: 'media', label: 'Media' },
            { value: 'baja', label: 'Baja' },
            { value: 'ninguna', label: 'Ninguna' },
          ]}
        />
      </div>
      <Input label="Caracteristicas" value={form.caracteristicas} onChange={(e) => updateField('caracteristicas', e.target.value)} placeholder="Inflamable, toxico, corrosivo..." />
    </div>
  );

  // Build generador list filtered by corriente for the detail modal
  const getGeneradoresForCorriente = (corrienteY: string): { id: string; nombre: string; cuit: string }[] => {
    if (!corrienteY) return [];
    return generadoresArr
      .filter((gen: any) => {
        const corrientes = parseCorrientes((gen as any).corrientesControl || (gen as any).categoriasControl || (gen as any).categoria);
        return corrientes.includes(corrienteY);
      })
      .map((gen: any) => ({
        id: gen.id,
        nombre: gen.razonSocial || gen.nombre || gen.cuit || '—',
        cuit: gen.cuit || '',
      }));
  };

  // Build operador names for the detail modal from enrichment data + DB IDs
  const getOperadorNames = (r: ResiduoDisplay): { cuit: string; nombre: string; metodo: string; dbId?: string }[] => {
    if (!r.corrienteY) return [];
    const cuits = OPERADORES_POR_CORRIENTE[r.corrienteY] || [];
    return cuits.map(cuit => {
      const op = OPERADORES_DATA[cuit];
      return {
        cuit,
        nombre: op?.empresa || cuit,
        metodo: op?.tecnologia?.split(/,/)[0]?.trim() || 'No especificado',
        dbId: operadorIdByCuit[cuit],
      };
    });
  };

  const columns = [
    {
      key: 'residuo',
      width: '24%',
      header: 'Residuo',
      sortable: true,
      render: (row: ResiduoDisplay) => (
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            row.peligrosidad === 'alta' ? 'bg-error-100' :
            row.peligrosidad === 'media' ? 'bg-warning-100' :
            'bg-success-100'
          }`}>
            {row.peligrosidad === 'alta' ? (
              <AlertTriangle size={20} className="text-error-600" />
            ) : row.peligrosidad === 'media' ? (
              <Beaker size={20} className="text-warning-600" />
            ) : (
              <Leaf size={20} className="text-success-600" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-neutral-900">{row.codigo}</p>
            <p className="text-xs text-neutral-500 line-clamp-1 max-w-[220px]" title={row.descripcion}>{row.descripcion}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'corrienteY',
      width: '8%',
      header: 'Corriente Y',
      sortable: true,
      hiddenBelow: 'md' as const,
      render: (row: ResiduoDisplay) => row.corrienteY ? (
        <Badge variant="outline" color="warning" title={row.corrienteDesc || ''}>
          {row.corrienteY}
        </Badge>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'peligrosidad',
      width: '10%',
      header: 'Peligrosidad',
      sortable: true,
      render: (row: ResiduoDisplay) => {
        const colors: Record<string, string> = {
          alta: 'error',
          media: 'warning',
          baja: 'info',
          ninguna: 'success',
        };
        return (
          <Badge variant="soft" color={colors[row.peligrosidad]}>
            {row.peligrosidad.charAt(0).toUpperCase() + row.peligrosidad.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'generadores',
      width: '10%',
      header: 'Generadores',
      sortable: true,
      hiddenBelow: 'lg' as const,
      render: (row: ResiduoDisplay) => row.generadoresCount > 0 ? (
        <div className="flex items-center gap-1.5">
          <Factory size={14} className="text-purple-500" />
          <span className="text-sm font-medium text-neutral-700">{row.generadoresCount}</span>
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'operadores',
      width: '10%',
      header: 'Operadores',
      sortable: true,
      hiddenBelow: 'lg' as const,
      render: (row: ResiduoDisplay) => {
        const count = Math.max(row.operadoresCount, row.operadoresDbCount);
        return count > 0 ? (
          <div className="flex items-center gap-1.5">
            <FlaskConical size={14} className="text-blue-500" />
            <span className="text-sm font-medium text-neutral-700">{count}</span>
          </div>
        ) : (
          <span className="text-xs text-neutral-400">-</span>
        );
      },
    },
    {
      key: 'manifiestos',
      width: '10%',
      header: 'Manifiestos',
      sortable: true,
      hiddenBelow: 'xl' as const,
      render: (row: ResiduoDisplay) => row.manifestosCount > 0 ? (
        <div className="flex items-center gap-1.5">
          <FileText size={14} className="text-primary-500" />
          <span className="text-sm font-medium text-neutral-700">{row.manifestosCount}</span>
        </div>
      ) : (
        <span className="text-xs text-neutral-400">-</span>
      ),
    },
    {
      key: 'estado',
      width: '8%',
      header: 'Estado',
      sortable: true,
      render: (row: ResiduoDisplay) => (
        <Badge variant="soft" color={row.activo ? 'success' : 'neutral'}>
          {row.activo ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'acciones',
      width: '8%',
      header: 'Acciones',
      render: (row: ResiduoDisplay) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEditar(row)}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors"
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => { setDeleteTarget({ id: row.id, codigo: row.codigo }); setModalEliminar(true); }}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-error-600 transition-colors"
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
          <div className="p-3 bg-primary-100 rounded-xl">
            <FlaskConical size={24} className="text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Catalogo de Residuos</h2>
            <p className="text-neutral-600">Tipos de residuos, corrientes Y y operadores autorizados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors" title="Imprimir"><Printer size={14} />Imprimir</button>
          <Button variant="outline" leftIcon={<Download size={18} />} onClick={handleExport} className="hidden sm:inline-flex">
            CSV
          </Button>
          <button onClick={handleExportPdf} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-error-700 bg-error-50 hover:bg-error-100 rounded-lg border border-error-200 transition-colors" title="Exportar PDF"><FileDown size={14} />PDF</button>
          <Button leftIcon={<Plus size={18} />} onClick={() => { setForm(INITIAL_FORM); setModalCrear(true); }}>
            Nuevo Tipo
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info-100 rounded-lg">
                <FlaskConical size={20} className="text-info-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-neutral-900">{statsTotal}</p>
                <p className="text-sm text-neutral-600 truncate">Total Tipos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-error-100 rounded-lg">
                <AlertTriangle size={20} className="text-error-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-neutral-900">{statsPeligrosos}</p>
                <p className="text-sm text-neutral-600 truncate">Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success-100 rounded-lg">
                <Leaf size={20} className="text-success-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-neutral-900">{statsNoPeligrosos}</p>
                <p className="text-sm text-neutral-600 truncate">No Peligrosos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning-100 rounded-lg">
                <Flame size={20} className="text-warning-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-neutral-900">{corrientesActivas}</p>
                <p className="text-sm text-neutral-600 truncate">Corrientes Y</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <FileText size={20} className="text-primary-600" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-neutral-900">{totalManifiestos}</p>
                <p className="text-sm text-neutral-600 truncate">Manifiestos</p>
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
                value={searchQuery}
                onChange={(v) => { setSearchQuery(v); setCurrentPage(1); }}
                placeholder="Buscar por codigo, descripcion o corriente Y..."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                value={corrienteFilter}
                onChange={(val) => { setCorrienteFilter(val); setCurrentPage(1); }}
                placeholder="Todas las corrientes"
                options={[
                  { value: '', label: 'Todas las corrientes' },
                  ...CORRIENTES_Y_CODES.map(code => ({ value: code, label: `${code} -- ${CORRIENTES_Y[code].substring(0, 40)}` })),
                ]}
                size="sm"
                isFullWidth={false}
              />
              <Select
                value={peligrosidadFilter}
                onChange={(val) => { setPeligrosidadFilter(val); setCurrentPage(1); }}
                placeholder="Todas las peligrosidades"
                options={[
                  { value: '', label: 'Todas las peligrosidades' },
                  { value: 'alta', label: 'Alta' },
                  { value: 'media', label: 'Media' },
                  { value: 'baja', label: 'Baja' },
                  { value: 'ninguna', label: 'Ninguna' },
                ]}
                size="sm"
                isFullWidth={false}
              />
              <Select
                value={estadoFilter}
                onChange={(val) => { setEstadoFilter(val); setCurrentPage(1); }}
                placeholder="Todos los estados"
                options={[
                  { value: '', label: 'Todos los estados' },
                  { value: 'activo', label: 'Activo' },
                  { value: 'inactivo', label: 'Inactivo' },
                ]}
                size="sm"
                isFullWidth={false}
              />
            </div>
          </div>
          {(corrienteFilter || peligrosidadFilter || estadoFilter) && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-primary-50 rounded-lg">
              <span className="text-sm text-primary-700">Filtros:</span>
              {corrienteFilter && (
                <Badge variant="solid" color="primary">
                  {corrienteFilter}
                  <button className="ml-1.5" onClick={() => { setCorrienteFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              {peligrosidadFilter && (
                <Badge variant="solid" color="primary">
                  {peligrosidadFilter}
                  <button className="ml-1.5" onClick={() => { setPeligrosidadFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              {estadoFilter && (
                <Badge variant="solid" color="primary">
                  {estadoFilter}
                  <button className="ml-1.5" onClick={() => { setEstadoFilter(''); setCurrentPage(1); }}>&times;</button>
                </Badge>
              )}
              <button
                className="ml-auto text-sm text-primary-600 hover:text-primary-800 font-medium"
                onClick={() => { setCorrienteFilter(''); setPeligrosidadFilter(''); setEstadoFilter(''); setCurrentPage(1); }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <span className="ml-3 text-neutral-600">Cargando residuos...</span>
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-error-600">
            <span>Error al cargar datos: {(error as Error)?.message || 'Error desconocido'}</span>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-2 p-3">
              {paginatedData.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-neutral-100 p-3 cursor-pointer active:scale-[0.98] transition-transform" onClick={() => openDetalle(r)}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-semibold text-sm text-neutral-900">{r.codigo}</p>
                      <p className="text-xs text-neutral-600 truncate mt-0.5">{r.descripcion}</p>
                    </div>
                    {r.corrienteY && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 shrink-0 ml-2">{r.corrienteY}</span>}
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden md:block">
            <Table
              data={paginatedData}
              columns={columns}
              keyExtractor={(row) => row.id}
              sortable={true}
              onSort={(key, dir) => setSortConfig({ key, direction: dir })}
              onRowClick={openDetalle}
              stickyHeader
            />
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalFilteredPages}
              totalItems={filteredData.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>

      {/* Modal Crear */}
      <Modal
        isOpen={modalCrear}
        onClose={() => setModalCrear(false)}
        title="Nuevo Tipo de Residuo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalCrear(false)}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creando...' : 'Crear'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal Editar */}
      <Modal
        isOpen={modalEditar}
        onClose={() => { setModalEditar(false); setEditId(null); }}
        title="Editar Tipo de Residuo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalEditar(false); setEditId(null); }}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </>
        }
      >
        {renderForm()}
      </Modal>

      {/* Modal Eliminar */}
      <ConfirmModal
        isOpen={modalEliminar}
        onClose={() => { setModalEliminar(false); setDeleteTarget(null); }}
        onConfirm={handleEliminar}
        title="Eliminar Tipo de Residuo"
        description={`Estas seguro de eliminar el tipo de residuo "${deleteTarget?.codigo}"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* Modal Detalle */}
      <Modal
        isOpen={modalDetalle}
        onClose={() => { setModalDetalle(false); setDetalleResiduo(null); }}
        title=""
        size="lg"
      >
        {detalleResiduo && <ResiduoDetalleContent
          residuo={detalleResiduo}
          operadorNames={getOperadorNames(detalleResiduo)}
          generadoresList={getGeneradoresForCorriente(detalleResiduo.corrienteY || '')}
          onClose={() => { setModalDetalle(false); setDetalleResiduo(null); }}
          onNavigate={(path) => { setModalDetalle(false); setDetalleResiduo(null); navigate(path); }}
        />}
      </Modal>
    </div>
  );
};

// ========================================
// DETAIL MODAL CONTENT — Tabs design
// ========================================
const ResiduoDetalleContent: React.FC<{
  residuo: ResiduoDisplay;
  operadorNames: { cuit: string; nombre: string; metodo: string; dbId?: string }[];
  generadoresList: { id: string; nombre: string; cuit: string }[];
  onClose: () => void;
  onNavigate: (path: string) => void;
}> = ({ residuo, operadorNames, generadoresList, onClose, onNavigate }) => {
  const [tab, setTab] = useState<'info' | 'operadores' | 'generadores' | 'manifiestos'>('info');
  const { data: manifData, isLoading: manifLoading } = useManifiestos(
    { tipoResiduoId: residuo.id, limit: 50 },
    { enabled: tab === 'manifiestos' }, // lazy: only fetch when tab is active
  );

  const peligrosidadColors: Record<string, string> = {
    'Tóxico': 'error', 'Inflamable': 'error', 'Corrosivo': 'warning', 'Reactivo': 'warning',
    'alta': 'error', 'media': 'warning', 'baja': 'info', 'ninguna': 'success',
  };

  const tabs = [
    { id: 'info' as const, label: 'Info' },
    { id: 'operadores' as const, label: `Operadores (${Math.max(operadorNames.length, residuo.operadoresDbCount)})` },
    { id: 'generadores' as const, label: `Generadores (${generadoresList.length || residuo.generadoresCount})` },
    { id: 'manifiestos' as const, label: `Manifiestos (${residuo.manifestosCount})` },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${residuo.tipo === 'Peligroso' ? 'bg-error-100' : 'bg-success-100'}`}>
          {residuo.tipo === 'Peligroso' ? <AlertTriangle size={24} className="text-error-600" /> : <Leaf size={24} className="text-success-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-neutral-900">{residuo.codigo}</h3>
            <Badge variant="soft" color={peligrosidadColors[residuo.peligrosidad]}>{residuo.peligrosidad}</Badge>
            {residuo.corrienteY && <Badge variant="outline" color="warning">{residuo.corrienteY}</Badge>}
          </div>
          <p className="text-sm text-neutral-600 mt-0.5">{residuo.nombre}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-primary-500 text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — fixed height so modal doesn't jump */}
      <div className="min-h-[300px] max-h-[50vh] overflow-y-auto">
        {/* ── Info tab ── */}
        {tab === 'info' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Descripcion</p>
                <p className="text-sm text-neutral-900">{residuo.descripcion}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-0.5">Categoria</p>
                <p className="text-sm text-neutral-900">{residuo.categoria}</p>
              </div>
              {residuo.corrienteDesc && (
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Corriente Y</p>
                  <p className="text-sm text-neutral-900">{residuo.corrienteY} - {residuo.corrienteDesc}</p>
                </div>
              )}
              {residuo.caracteristicas && (
                <div>
                  <p className="text-xs text-neutral-500 mb-0.5">Caracteristicas</p>
                  <p className="text-sm text-neutral-900">{residuo.caracteristicas}</p>
                </div>
              )}
            </div>
            {residuo.tecnologias.length > 0 && (
              <div className="pt-3 border-t border-neutral-100">
                <p className="text-xs text-neutral-500 mb-2">Tecnologias de tratamiento</p>
                <div className="flex flex-wrap gap-1.5">
                  {residuo.tecnologias.map((t, i) => <Badge key={i} variant="outline" color="neutral">{t}</Badge>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Operadores tab ── */}
        {tab === 'operadores' && (
          <div className="space-y-1.5">
            {operadorNames.length > 0 ? operadorNames.map((op, i) => (
              <button
                key={i}
                onClick={() => op.dbId ? onNavigate(`/actores/operadores/${op.dbId}`) : undefined}
                className={`w-full text-left px-3 py-2.5 bg-neutral-50 rounded-lg transition-colors ${op.dbId ? 'hover:bg-blue-50 cursor-pointer' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-900 truncate">{op.nombre}</p>
                  {op.dbId && <ExternalLink size={12} className="text-blue-400 shrink-0" />}
                </div>
                <p className="text-xs text-neutral-500 truncate mt-0.5">{op.metodo}</p>
                <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{op.cuit}</p>
              </button>
            )) : (
              <p className="text-sm text-neutral-400 text-center py-8">Sin operadores autorizados</p>
            )}
          </div>
        )}

        {/* ── Generadores tab ── */}
        {tab === 'generadores' && (
          <div className="space-y-1.5">
            {generadoresList.length > 0 ? generadoresList.map((gen) => (
              <button
                key={gen.id}
                onClick={() => onNavigate(`/admin/actores/generadores/${gen.id}`)}
                className="w-full text-left px-3 py-2.5 bg-neutral-50 rounded-lg hover:bg-purple-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-neutral-900 truncate">{gen.nombre}</p>
                  <ExternalLink size={12} className="text-purple-400 shrink-0" />
                </div>
                {gen.cuit && <p className="text-[10px] text-neutral-400 font-mono mt-0.5">{gen.cuit}</p>}
              </button>
            )) : (
              <p className="text-sm text-neutral-400 text-center py-8">Sin generadores inscriptos para corriente {residuo.corrienteY}</p>
            )}
          </div>
        )}

        {/* ── Manifiestos tab ── */}
        {tab === 'manifiestos' && (
          <div className="space-y-1.5">
            {manifLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
            ) : (manifData?.items || []).length > 0 ? (manifData!.items.map((m: any) => (
              <button
                key={m.id}
                onClick={() => onNavigate(`/manifiestos/${m.id}`)}
                className="w-full text-left px-3 py-2.5 bg-neutral-50 rounded-lg hover:bg-primary-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-neutral-900">{m.numero}</span>
                  <Badge variant="soft" color={
                    m.estado === 'TRATADO' ? 'success' : m.estado === 'EN_TRANSITO' ? 'warning' :
                    m.estado === 'CANCELADO' || m.estado === 'RECHAZADO' ? 'error' : 'neutral'
                  } className="text-[10px]">{m.estado?.replace(/_/g, ' ')}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500">
                  {m.generador?.razonSocial && <span>Gen: {m.generador.razonSocial}</span>}
                  {m.operador?.razonSocial && <span>Op: {m.operador.razonSocial}</span>}
                </div>
              </button>
            ))) : (
              <p className="text-sm text-neutral-400 text-center py-8">Sin manifiestos vinculados</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminResiduosPage;
