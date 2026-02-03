/**
 * SITREP v6 - Admin Generadores Page
 * ==================================
 * Panel administrativo especifico para generadores
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Factory,
  Plus,
  Search,
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Phone,
  Mail,
  Edit,
  Eye,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/BadgeV2';
import { Modal, ConfirmModal } from '../../components/ui/Modal';
import {
  useGeneradores,
  useCreateGenerador,
  useUpdateGenerador,
  useDeleteGenerador,
} from '../../hooks/useActores';


const INITIAL_FORM = {
  razonSocial: '',
  cuit: '',
  domicilio: '',
  telefono: '',
  email: '',
  password: '',
  nombre: '',
  numeroInscripcion: '',
  categoria: '',
};

const AdminGeneradoresPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const [busqueda, setBusqueda] = useState('');
  const [modalCrear, setModalCrear] = useState(false);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalEliminar, setModalEliminar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; razonSocial: string } | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  // API hooks
  const { data: apiData, isLoading, isError } = useGeneradores();
  const createMutation = useCreateGenerador();
  const updateMutation = useUpdateGenerador();
  const deleteMutation = useDeleteGenerador();

  const generadoresData = Array.isArray(apiData?.items) ? apiData.items : [];

  const generadoresFiltrados = generadoresData.filter((g: any) =>
    String(g.razonSocial || '').toLowerCase().includes(busqueda.toLowerCase()) ||
    String(g.cuit || '').includes(busqueda)
  );

  const stats = {
    total: apiData?.total ?? generadoresData.length,
    activos: generadoresData.filter((g: any) => g.activo !== false).length,
    alertas: generadoresData.filter((g: any) => g.activo === false).length,
  };

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
        numeroInscripcion: form.numeroInscripcion,
        categoria: form.categoria,
      });
      setModalCrear(false);
      setForm(INITIAL_FORM);
    } catch (err) {
      console.error('Error creando generador:', err);
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
          numeroInscripcion: form.numeroInscripcion,
          categoria: form.categoria,
        },
      });
      setModalEditar(false);
      setEditId(null);
      setForm(INITIAL_FORM);
    } catch (err) {
      console.error('Error actualizando generador:', err);
    }
  };

  const openEditar = (generador: any) => {
    setEditId(generador.id);
    setForm({
      razonSocial: generador.razonSocial || '',
      cuit: generador.cuit || '',
      domicilio: generador.domicilio || '',
      telefono: generador.telefono || '',
      email: generador.email || '',
      password: '',
      nombre: '',
      numeroInscripcion: generador.numeroInscripcion || '',
      categoria: generador.categoria || '',
    });
    setModalEditar(true);
  };

  const handleEliminar = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setModalEliminar(false);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error eliminando generador:', err);
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
      <Input label="Domicilio" value={form.domicilio} onChange={(e) => updateField('domicilio', e.target.value)} placeholder="Av. San Martin 1234, Mendoza" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="N. Inscripcion" value={form.numeroInscripcion} onChange={(e) => updateField('numeroInscripcion', e.target.value)} placeholder="DGFA-2024-XXXX" />
        <Input label="Categoria" value={form.categoria} onChange={(e) => updateField('categoria', e.target.value)} placeholder="Grandes Generadores" />
      </div>
      {!editId && (
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre Responsable" value={form.nombre} onChange={(e) => updateField('nombre', e.target.value)} placeholder="Juan Perez" />
          <Input label="Password inicial" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min. 8 caracteres" />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 rounded-xl">
            <Factory size={24} className="text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-neutral-900">Admin Generadores</h2>
            <p className="text-neutral-600">Panel de gestion de generadores de residuos</p>
          </div>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={() => { setForm(INITIAL_FORM); setModalCrear(true); }}>
          Nuevo Generador
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <p className="text-sm text-purple-700 mb-1">Total Generadores</p>
            <p className="text-3xl font-bold text-purple-900">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-success-50 border-success-200">
          <CardContent className="p-4">
            <p className="text-sm text-success-700 mb-1">Activos</p>
            <p className="text-3xl font-bold text-success-900">{stats.activos}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning-50 border-warning-200">
          <CardContent className="p-4">
            <p className="text-sm text-warning-700 mb-1">Con Alertas</p>
            <p className="text-3xl font-bold text-warning-900">{stats.alertas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-neutral-600 mb-1">Total Registros</p>
            <p className="text-3xl font-bold text-neutral-900">{generadoresFiltrados.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grafico de tendencia */}
      <Card>
        <CardHeader title="Generacion de Residuos por Mes" icon={<TrendingUp size={20} />} />
        <CardContent>
          <div className="h-48 flex items-end gap-4">
            {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'].map((mes, i) => (
              <div key={mes} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-purple-200 rounded-t-md relative group" style={{ height: `${40 + i * 15}px` }}>
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {80 + i * 30}tn
                  </div>
                </div>
                <span className="text-xs text-neutral-500">{mes}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card padding="base">
        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por razon social o CUIT..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              leftIcon={<Search size={18} />}
            />
          </div>
          <select className="px-4 py-2 rounded-xl border-2 border-neutral-200 bg-white text-sm focus:border-primary-500 focus:outline-none">
            <option value="">Todas las categorias</option>
            <option value="grandes">Grandes Generadores</option>
            <option value="medianos">Medianos Generadores</option>
            <option value="pequenos">Pequenos Generadores</option>
          </select>
        </div>
      </Card>

      {/* Loading */}
      {isLoading && (
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando generadores...</p>
          </div>
        </Card>
      )}

      {/* Lista de generadores */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {generadoresFiltrados.map((generador: any) => (
            <Card key={generador.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Factory size={24} className="text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900">{generador.razonSocial}</h4>
                      <p className="text-sm text-neutral-500 font-mono">{generador.cuit}</p>
                    </div>
                  </div>
                  <Badge
                    variant="soft"
                    color={generador.activo !== false ? 'success' : 'warning'}
                  >
                    {generador.activo !== false ? <CheckCircle size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                    {generador.activo !== false ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <MapPin size={14} />
                    <span>{generador.domicilio}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Mail size={14} />
                    <span>{generador.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <Phone size={14} />
                    <span>{generador.telefono}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-neutral-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-neutral-900">{generador.categoria || '-'}</p>
                    <p className="text-xs text-neutral-500">Categoria</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-2 text-center">
                    <p className="text-sm font-bold text-neutral-900">{generador.numeroInscripcion || '-'}</p>
                    <p className="text-xs text-neutral-500">Inscripcion</p>
                  </div>
                  <div className="bg-neutral-50 rounded-lg p-2 text-center">
                    <p className="text-xs font-medium text-neutral-900">{generador.createdAt ? new Date(generador.createdAt).toLocaleDateString() : '-'}</p>
                    <p className="text-xs text-neutral-500">Alta</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Eye size={14} />} onClick={() => navigate(isMobile ? `/mobile/admin/generadores/${generador.id}` : `/admin/generadores/${generador.id}`)}>
                    Ver
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" leftIcon={<Edit size={14} />} onClick={() => openEditar(generador)}>
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="p-2 text-error-500 hover:text-error-600"
                    onClick={() => { setDeleteTarget({ id: generador.id, razonSocial: generador.razonSocial }); setModalEliminar(true); }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && generadoresFiltrados.length === 0 && (
        <Card className="py-16">
          <div className="text-center">
            <Factory className="mx-auto text-neutral-300 mb-3" size={40} />
            <h3 className="text-lg font-medium text-neutral-900 mb-1">No se encontraron generadores</h3>
            <p className="text-neutral-500">Intenta con otros terminos de busqueda</p>
          </div>
        </Card>
      )}

      {/* Modal crear */}
      <Modal
        isOpen={modalCrear}
        onClose={() => { setModalCrear(false); setForm(INITIAL_FORM); }}
        title="Nuevo Generador"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setModalCrear(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleCrear} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Guardando...' : 'Crear Generador'}
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
        title="Editar Generador"
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
        title="Eliminar Generador"
        description={`Esta seguro que desea eliminar a "${deleteTarget?.razonSocial}"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default AdminGeneradoresPage;
