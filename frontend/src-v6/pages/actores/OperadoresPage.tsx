/**
 * SITREP v6 - Operadores Page
 * ============================
 * Gestion de operadores de tratamiento
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Search,
  Plus,
  Filter,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Factory
} from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Input } from '../../components/ui/Input';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import {
  useOperadores,
  useCreateOperador,
  useUpdateOperador,
  useDeleteOperador,
} from '../../hooks/useActores';

const estadoConfig: Record<string, { label: string; color: any; icon: React.ReactNode }> = {
  ACTIVO: { label: 'En linea', color: 'success', icon: <CheckCircle2 size={14} /> },
  MANTENIMIENTO: { label: 'Mantenimiento', color: 'warning', icon: <AlertCircle size={14} /> },
  INACTIVO: { label: 'Fuera de servicio', color: 'error', icon: <AlertCircle size={14} /> },
};

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
};

const OperadoresPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [vista, setVista] = useState<'grid' | 'lista'>('lista');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: apiData, isLoading } = useOperadores({ search: searchTerm || undefined });
  const createMutation = useCreateOperador();
  const updateMutation = useUpdateOperador();
  const deleteMutation = useDeleteOperador();

  const operadoresData = Array.isArray(apiData?.items) ? apiData.items : [];

  // Server handles search; client filters estado
  const operadoresFiltrados = operadoresData.filter((op: any) => {
    const matchesEstado = filtroEstado === '' ||
      (filtroEstado === 'ACTIVO' && op.activo !== false) ||
      (filtroEstado === 'INACTIVO' && op.activo === false);
    return matchesEstado;
  });

  const isMobile = typeof window !== 'undefined' && window.location.pathname.includes('/mobile');

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCrear = async () => {
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
      });
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch {
      // Error handled by React Query
    }
  };

  const handleEditar = async () => {
    if (!editId) return;
    try {
      await updateMutation.mutateAsync({
        id: editId,
        data: {
          razonSocial: form.razonSocial,
          cuit: form.cuit,
          domicilio: form.domicilio,
          telefono: form.telefono,
          email: form.email,
          numeroHabilitacion: form.numeroHabilitacion,
          categoria: form.categoria,
        },
      });
      setModalEditar(false);
      setEditId(null);
      setForm(INITIAL_FORM);
    } catch {
      // Error handled by React Query
    }
  };

  const openEditar = (op: any) => {
    setEditId(op.id);
    setForm({
      razonSocial: op.razonSocial || '',
      cuit: op.cuit || '',
      domicilio: op.domicilio || '',
      telefono: op.telefono || '',
      email: op.email || '',
      password: '',
      nombre: '',
      numeroHabilitacion: op.numeroHabilitacion || '',
      categoria: op.categoria || '',
    });
    setModalEditar(true);
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch {
      // Error handled by React Query
    }
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
        <Input label="N. Habilitacion" value={form.numeroHabilitacion} onChange={(e) => updateField('numeroHabilitacion', e.target.value)} placeholder="HAB-OP-2024-XXXX" />
        <Input label="Categoria" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} placeholder="Incineracion" />
      </div>
      {!editId && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre Responsable" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Juan Perez" />
          <Input label="Password inicial" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min. 8 caracteres" />
        </div>
      )}
    </div>
  );

  const activosCount = operadoresData.filter((op: any) => op.activo !== false).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-neutral-600" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-neutral-900">Operadores</h2>
              <Badge variant="soft" color="primary">{apiData?.total ?? operadoresFiltrados.length}</Badge>
            </div>
            <p className="text-neutral-600 mt-1">
              Gestion de plantas de tratamiento
            </p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => { setForm(INITIAL_FORM); setModalCrear(true); }}>
          Nuevo Operador
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-success-50 rounded-lg flex items-center justify-center">
              <FlaskConical className="text-success-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{activosCount}</p>
              <p className="text-xs text-neutral-500">Activos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-warning-50 rounded-lg flex items-center justify-center">
              <AlertCircle className="text-warning-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{operadoresData.filter((op: any) => op.activo === false).length}</p>
              <p className="text-xs text-neutral-500">Inactivos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-primary-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{apiData?.total ?? operadoresData.length}</p>
              <p className="text-xs text-neutral-500">Total registrados</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-info-50 rounded-lg flex items-center justify-center">
              <Factory className="text-info-600" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">-</p>
              <p className="text-xs text-neutral-500">Tn capacidad total</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card padding="base">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nombre, razon social o CUIT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none"
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
            </select>
            <div className="flex bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setVista('lista')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  vista === 'lista' ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-600'
                }`}
              >
                Lista
              </button>
              <button
                onClick={() => setVista('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  vista === 'grid' ? 'bg-white text-primary-600 shadow-sm' : 'text-neutral-600'
                }`}
              >
                Grid
              </button>
            </div>
            <Button variant="outline" leftIcon={<Filter size={18} />}>
              Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando operadores...</p>
          </div>
        </Card>
      )}

      {/* Lista */}
      {!isLoading && vista === 'lista' ? (
        <Card padding="none" className="max-h-[70vh] overflow-auto">
          <table className="w-full table-fixed">
              <thead className="bg-neutral-50 border-b border-neutral-200 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: '30%' }}>Operador</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: '15%' }}>Estado</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell" style={{ width: '15%' }}>Categoria</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell" style={{ width: '22%' }}>Contacto</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase tracking-wider" style={{ width: '18%' }}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {operadoresFiltrados.map((op: any) => {
                  const isActivo = op.activo !== false;
                  const estado = isActivo ? estadoConfig.ACTIVO : estadoConfig.INACTIVO;
                  return (
                    <tr
                      key={op.id}
                      className="hover:bg-neutral-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(isMobile ? `/mobile/actores/operadores/${op.id}` : `/actores/operadores/${op.id}`)}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FlaskConical className="text-primary-600" size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors truncate">{op.razonSocial}</p>
                            <p className="text-xs text-neutral-500">{op.cuit}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="soft" color={estado.color}>
                          <span className="flex items-center gap-1">
                            {estado.icon}
                            {estado.label}
                          </span>
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <span className="text-sm text-neutral-700">{op.categoria || '-'}</span>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <div className="text-sm text-neutral-600">
                          <p className="flex items-center gap-1"><Phone size={12} /> {op.telefono}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/actores/operadores/${op.id}` : `/actores/operadores/${op.id}`); }}>
                            <Eye size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-2" onClick={(e) => { e.stopPropagation(); openEditar(op); }}>
                            <Edit size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" className="p-2 text-error-500 hover:text-error-600" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: op.id, razonSocial: op.razonSocial }); setModalEliminar(true); }}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        </Card>
      ) : !isLoading ? (
        /* Vista Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {operadoresFiltrados.map((op: any) => {
            const isActivo = op.activo !== false;
            const estado = isActivo ? estadoConfig.ACTIVO : estadoConfig.INACTIVO;
            return (
              <Card
                key={op.id}
                className="p-5 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(isMobile ? `/mobile/actores/operadores/${op.id}` : `/actores/operadores/${op.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                      <FlaskConical className="text-primary-600" size={24} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 group-hover:text-primary-600 transition-colors">{op.razonSocial}</h3>
                      <p className="text-xs text-neutral-500">{op.cuit}</p>
                    </div>
                  </div>
                  <Badge variant="soft" color={estado.color}>{estado.label}</Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <MapPin size={14} />
                    <span className="truncate">{op.domicilio}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Mail size={14} />
                    <span>{op.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Phone size={14} />
                    <span>{op.telefono}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Habilitacion</p>
                    <p className="font-mono font-medium text-neutral-900">{op.numeroHabilitacion || '-'}</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-3">
                    <p className="text-xs text-neutral-500 mb-1">Categoria</p>
                    <p className="font-medium text-neutral-900">{op.categoria || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-neutral-100">
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Eye size={14} />} onClick={(e) => { e.stopPropagation(); navigate(isMobile ? `/mobile/actores/operadores/${op.id}` : `/actores/operadores/${op.id}`); }}>
                    Ver
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Edit size={14} />} onClick={(e) => { e.stopPropagation(); openEditar(op); }}>
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="p-2 text-error-500" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: op.id, razonSocial: op.razonSocial }); setModalEliminar(true); }}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Empty state */}
      {!isLoading && operadoresFiltrados.length === 0 && (
        <Card className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FlaskConical className="text-neutral-400" size={24} />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">No se encontraron operadores</h3>
            <p className="text-neutral-500">Intenta con otros terminos de busqueda</p>
          </div>
        </Card>
      )}

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

      {/* Modal editar */}
      <Modal
        isOpen={modalEditar}
        onClose={() => { setModalEditar(false); setEditId(null); setForm(INITIAL_FORM); }}
        title="Editar Operador"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalEditar(false); setEditId(null); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleEditar} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
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
        description={`Esta seguro que desea eliminar a "${deleteTarget?.razonSocial}"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default OperadoresPage;
