/**
 * SITREP v6 - Transportista Detail Page
 * ======================================
 * Vista detalle de un transportista con tabs: Info General + Flota y Conductores
 * CRUD: Agregar vehículos y conductores (ADMIN only)
 */

import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Users,
  Shield,
  Award,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import {
  useTransportista,
  useCreateVehiculo,
  useCreateChofer,
  useUpdateVehiculo,
  useDeleteVehiculo,
  useUpdateChofer,
  useDeleteChofer,
} from '../../hooks/useActores';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '../../components/ui/Toast';

const EMPTY_VEHICULO = { patente: '', marca: '', modelo: '', anio: new Date().getFullYear(), capacidad: 0, numeroHabilitacion: '', vencimiento: '' };
const EMPTY_CHOFER = { nombre: '', apellido: '', dni: '', licencia: '', vencimiento: '', telefono: '' };

const TransportistaDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  const { isAdmin } = useAuth();

  const { data: apiTransportista, isLoading } = useTransportista(id || '');
  const createVehiculo = useCreateVehiculo();
  const createChofer = useCreateChofer();
  const updateVehiculo = useUpdateVehiculo();
  const deleteVehiculo = useDeleteVehiculo();
  const updateChofer = useUpdateChofer();
  const deleteChofer = useDeleteChofer();

  const [showVehiculoModal, setShowVehiculoModal] = useState(false);
  const [showChoferModal, setShowChoferModal] = useState(false);
  const [vehiculoForm, setVehiculoForm] = useState(EMPTY_VEHICULO);
  const [choferForm, setChoferForm] = useState(EMPTY_CHOFER);
  const [editingVehiculo, setEditingVehiculo] = useState<any>(null);
  const [editingChofer, setEditingChofer] = useState<any>(null);
  const [deleteVehiculoItem, setDeleteVehiculoItem] = useState<any>(null);
  const [deleteChoferItem, setDeleteChoferItem] = useState<any>(null);

  const transportista = apiTransportista ? {
    ...apiTransportista,
    nombre: (apiTransportista as any).razonSocial || '-',
    direccion: (apiTransportista as any).domicilio || '-',
    estado: (apiTransportista as any).activo !== false ? 'ACTIVO' : 'SUSPENDIDO',
    habilitacion: (apiTransportista as any).numeroHabilitacion || '-',
    vencimientoHab: (apiTransportista as any).vencimientoHab || '-',
    flota: (apiTransportista as any).vehiculos || [],
    conductores: (apiTransportista as any).choferes || [],
  } : null;

  const backPath = isMobile
    ? '/mobile/actores/transportistas'
    : '/admin/actores/transportistas';

  const openCreateVehiculo = () => {
    setEditingVehiculo(null);
    setVehiculoForm(EMPTY_VEHICULO);
    setShowVehiculoModal(true);
  };

  const openEditVehiculo = (v: any) => {
    setEditingVehiculo(v);
    setVehiculoForm({
      patente: v.patente || '',
      marca: v.marca || '',
      modelo: v.modelo || '',
      anio: v.anio || new Date().getFullYear(),
      capacidad: v.capacidad || 0,
      numeroHabilitacion: v.numeroHabilitacion || '',
      vencimiento: v.vencimiento ? new Date(v.vencimiento).toISOString().split('T')[0] : '',
    });
    setShowVehiculoModal(true);
  };

  const openCreateChofer = () => {
    setEditingChofer(null);
    setChoferForm(EMPTY_CHOFER);
    setShowChoferModal(true);
  };

  const openEditChofer = (c: any) => {
    setEditingChofer(c);
    setChoferForm({
      nombre: c.nombre || '',
      apellido: c.apellido || '',
      dni: c.dni || '',
      licencia: c.licencia || '',
      vencimiento: c.vencimiento ? new Date(c.vencimiento).toISOString().split('T')[0] : '',
      telefono: c.telefono || '',
    });
    setShowChoferModal(true);
  };

  const handleSaveVehiculo = () => {
    if (!id || !vehiculoForm.patente || !vehiculoForm.marca || !vehiculoForm.modelo || !vehiculoForm.vencimiento) {
      toast.error('Campos requeridos', 'Completar patente, marca, modelo y vencimiento');
      return;
    }

    const data = { ...vehiculoForm, anio: Number(vehiculoForm.anio), capacidad: Number(vehiculoForm.capacidad) };

    if (editingVehiculo) {
      updateVehiculo.mutate(
        { transportistaId: id, vehiculoId: editingVehiculo.id, data },
        {
          onSuccess: () => {
            toast.success('Vehículo actualizado', `Patente ${vehiculoForm.patente} modificado`);
            setShowVehiculoModal(false);
            setVehiculoForm(EMPTY_VEHICULO);
            setEditingVehiculo(null);
          },
          onError: () => toast.error('Error', 'No se pudo actualizar el vehículo'),
        }
      );
    } else {
      createVehiculo.mutate(
        { transportistaId: id, data },
        {
          onSuccess: () => {
            toast.success('Vehículo creado', `Patente ${vehiculoForm.patente} registrado`);
            setShowVehiculoModal(false);
            setVehiculoForm(EMPTY_VEHICULO);
          },
          onError: () => toast.error('Error', 'No se pudo crear el vehículo'),
        }
      );
    }
  };

  const handleDeleteVehiculo = () => {
    if (!id || !deleteVehiculoItem) return;
    deleteVehiculo.mutate(
      { transportistaId: id, vehiculoId: deleteVehiculoItem.id },
      {
        onSuccess: () => {
          toast.success('Vehículo eliminado', `Patente ${deleteVehiculoItem.patente} eliminado`);
          setDeleteVehiculoItem(null);
        },
        onError: () => toast.error('Error', 'No se pudo eliminar el vehículo'),
      }
    );
  };

  const handleSaveChofer = () => {
    if (!id || !choferForm.nombre || !choferForm.dni || !choferForm.licencia || !choferForm.vencimiento) {
      toast.error('Campos requeridos', 'Completar nombre, DNI, licencia y vencimiento');
      return;
    }

    if (editingChofer) {
      updateChofer.mutate(
        { transportistaId: id, choferId: editingChofer.id, data: choferForm },
        {
          onSuccess: () => {
            toast.success('Conductor actualizado', `${choferForm.nombre} modificado`);
            setShowChoferModal(false);
            setChoferForm(EMPTY_CHOFER);
            setEditingChofer(null);
          },
          onError: () => toast.error('Error', 'No se pudo actualizar el conductor'),
        }
      );
    } else {
      createChofer.mutate(
        { transportistaId: id, data: choferForm },
        {
          onSuccess: () => {
            toast.success('Conductor creado', `${choferForm.nombre} registrado`);
            setShowChoferModal(false);
            setChoferForm(EMPTY_CHOFER);
          },
          onError: () => toast.error('Error', 'No se pudo crear el conductor'),
        }
      );
    }
  };

  const handleDeleteChofer = () => {
    if (!id || !deleteChoferItem) return;
    deleteChofer.mutate(
      { transportistaId: id, choferId: deleteChoferItem.id },
      {
        onSuccess: () => {
          toast.success('Conductor eliminado', `${deleteChoferItem.nombre} eliminado`);
          setDeleteChoferItem(null);
        },
        onError: () => toast.error('Error', 'No se pudo eliminar el conductor'),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
        </div>
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando transportista...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!transportista) return null;

  const habVencimiento = transportista.vencimientoHab !== '-' ? new Date(transportista.vencimientoHab) : null;
  const diasHastaVencimiento = habVencimiento ? Math.ceil((habVencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const habProximaVencer = diasHastaVencimiento !== null && diasHastaVencimiento <= 90 && diasHastaVencimiento > 0;

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>
            Volver
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-secondary-100 rounded-xl flex items-center justify-center">
              <Truck size={28} className="text-secondary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-900">{transportista.nombre}</h2>
                <Badge variant="soft" color={transportista.estado === 'ACTIVO' ? 'success' : 'error'}>
                  {transportista.estado === 'ACTIVO' ? <CheckCircle2 size={12} className="mr-1" /> : <AlertCircle size={12} className="mr-1" />}
                  {transportista.estado === 'ACTIVO' ? 'Activo' : 'Suspendido'}
                </Badge>
              </div>
              <span className="text-neutral-600 font-mono text-sm">CUIT: {transportista.cuit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Vehículos</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.flota.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-neutral-500">Conductores</p>
          <p className="text-3xl font-bold text-neutral-900">{transportista.conductores.length}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Truck size={16} />}>Información General</Tab>
          <Tab id="flota" icon={<Users size={16} />}>Flota y Conductores</Tab>
        </TabList>

        {/* Tab: Info General */}
        <TabPanel id="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Datos de la Empresa" icon={<Truck size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Dirección</p>
                      <p className="font-medium text-neutral-900">{transportista.direccion}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Teléfono</p>
                      <p className="font-medium text-neutral-900">{transportista.telefono}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">Email</p>
                      <p className="font-medium text-neutral-900">{transportista.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Shield size={16} className="text-neutral-400 shrink-0" />
                    <div>
                      <p className="text-neutral-500">N° Habilitación</p>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-neutral-900">{transportista.habilitacion}</p>
                        {habProximaVencer && (
                          <Badge variant="soft" color="warning">
                            <AlertTriangle size={12} className="mr-1" />
                            Vence en {diasHastaVencimiento} días
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {transportista.vencimientoHab !== '-' && (
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar size={16} className="text-neutral-400 shrink-0" />
                      <div>
                        <p className="text-neutral-500">Vencimiento habilitación</p>
                        <p className="font-medium text-neutral-900">{transportista.vencimientoHab}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader title="Certificaciones" icon={<Award size={20} />} />
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {((apiTransportista as any)?.certificaciones || []).map((cert: string) => (
                    <Badge key={cert} variant="soft" color="success">
                      <CheckCircle2 size={12} className="mr-1" />
                      {cert}
                    </Badge>
                  ))}
                  {!((apiTransportista as any)?.certificaciones?.length) && (
                    <span className="text-sm text-neutral-400">Sin certificaciones registradas</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* Tab: Flota y Conductores */}
        <TabPanel id="flota">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Vehículos"
                icon={<Truck size={20} />}
                action={isAdmin ? <Button size="sm" leftIcon={<Plus size={14} />} onClick={openCreateVehiculo}>Agregar</Button> : undefined}
              />
              <CardContent>
                {transportista.flota.length > 0 ? (
                  <table className="w-full table-fixed">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Patente</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Marca / Modelo</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '12%' }}>Capacidad</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '10%' }}>Estado</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '13%' }}>Habilitación</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '12%' }}>Vencimiento</th>
                        {isAdmin && <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase" style={{ width: '18%' }}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {transportista.flota.map((v: any) => (
                        <tr key={v.patente || v.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-mono font-semibold text-neutral-900">{v.patente}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{v.marca} {v.modelo}</td>
                          <td className="px-3 py-2.5 text-neutral-700 hidden md:table-cell">{typeof v.capacidad === 'number' ? `${v.capacidad.toLocaleString()} kg` : v.capacidad || '-'}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="soft" color={v.activo !== false ? 'success' : 'warning'}>
                              {v.activo !== false ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{v.numeroHabilitacion || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{v.vencimiento ? new Date(v.vencimiento).toLocaleDateString('es-AR') : '-'}</td>
                          {isAdmin && (
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  leftIcon={<Pencil size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditVehiculo(v);
                                  }}
                                >
                                  Editar
                                </Button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteVehiculoItem(v);
                                  }}
                                  className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-6">Sin vehículos registrados</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Conductores"
                icon={<Users size={20} />}
                action={isAdmin ? <Button size="sm" leftIcon={<Plus size={14} />} onClick={openCreateChofer}>Agregar</Button> : undefined}
              />
              <CardContent>
                {transportista.conductores.length > 0 ? (
                  <table className="w-full table-fixed">
                    <thead className="bg-neutral-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '22%' }}>Nombre</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>DNI</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '15%' }}>Licencia</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '14%' }}>Teléfono</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '16%' }}>Vto. Licencia</th>
                        {isAdmin && <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase" style={{ width: '18%' }}>Acciones</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {transportista.conductores.map((c: any) => (
                        <tr key={c.dni || c.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-neutral-900">{c.nombre} {c.apellido || ''}</td>
                          <td className="px-3 py-2.5 font-mono text-neutral-700">{c.dni || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{c.licencia || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-700 hidden md:table-cell">{c.telefono || '-'}</td>
                          <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{c.vencimiento ? new Date(c.vencimiento).toLocaleDateString('es-AR') : '-'}</td>
                          {isAdmin && (
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  leftIcon={<Pencil size={14} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditChofer(c);
                                  }}
                                >
                                  Editar
                                </Button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteChoferItem(c);
                                  }}
                                  className="p-2 rounded-lg hover:bg-red-50 text-neutral-400 hover:text-red-600 transition-colors"
                                  title="Eliminar"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-6">Sin conductores registrados</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>

      {/* Modal: Nuevo/Editar Vehículo */}
      <Modal
        isOpen={showVehiculoModal}
        onClose={() => {
          setShowVehiculoModal(false);
          setEditingVehiculo(null);
          setVehiculoForm(EMPTY_VEHICULO);
        }}
        title={editingVehiculo ? 'Editar Vehículo' : 'Nuevo Vehículo'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowVehiculoModal(false);
                setEditingVehiculo(null);
                setVehiculoForm(EMPTY_VEHICULO);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveVehiculo}
              disabled={createVehiculo.isPending || updateVehiculo.isPending}
            >
              {createVehiculo.isPending || updateVehiculo.isPending
                ? editingVehiculo
                  ? 'Actualizando...'
                  : 'Registrando...'
                : editingVehiculo
                ? 'Actualizar Vehículo'
                : 'Registrar Vehículo'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Patente *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="ABC123"
                value={vehiculoForm.patente} onChange={e => setVehiculoForm(p => ({ ...p, patente: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Marca *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="Mercedes-Benz"
                value={vehiculoForm.marca} onChange={e => setVehiculoForm(p => ({ ...p, marca: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Modelo *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="Actros 2545"
                value={vehiculoForm.modelo} onChange={e => setVehiculoForm(p => ({ ...p, modelo: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Año</label>
              <input type="number" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="2024"
                value={vehiculoForm.anio} onChange={e => setVehiculoForm(p => ({ ...p, anio: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Capacidad (kg)</label>
              <input type="number" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="15000"
                value={vehiculoForm.capacidad || ''} onChange={e => setVehiculoForm(p => ({ ...p, capacidad: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">N° Habilitación</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="HAB-001"
                value={vehiculoForm.numeroHabilitacion} onChange={e => setVehiculoForm(p => ({ ...p, numeroHabilitacion: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Vencimiento habilitación *</label>
            <input type="date" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
              value={vehiculoForm.vencimiento} onChange={e => setVehiculoForm(p => ({ ...p, vencimiento: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Modal: Nuevo/Editar Conductor */}
      <Modal
        isOpen={showChoferModal}
        onClose={() => {
          setShowChoferModal(false);
          setEditingChofer(null);
          setChoferForm(EMPTY_CHOFER);
        }}
        title={editingChofer ? 'Editar Conductor' : 'Nuevo Conductor'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowChoferModal(false);
                setEditingChofer(null);
                setChoferForm(EMPTY_CHOFER);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveChofer}
              disabled={createChofer.isPending || updateChofer.isPending}
            >
              {createChofer.isPending || updateChofer.isPending
                ? editingChofer
                  ? 'Actualizando...'
                  : 'Registrando...'
                : editingChofer
                ? 'Actualizar Conductor'
                : 'Registrar Conductor'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Nombre *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="Juan"
                value={choferForm.nombre} onChange={e => setChoferForm(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Apellido</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="Pérez"
                value={choferForm.apellido} onChange={e => setChoferForm(p => ({ ...p, apellido: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">DNI *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="12345678"
                value={choferForm.dni} onChange={e => setChoferForm(p => ({ ...p, dni: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Teléfono</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="261-4001234"
                value={choferForm.telefono} onChange={e => setChoferForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">N° Licencia *</label>
              <input type="text" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none" placeholder="LIC-001"
                value={choferForm.licencia} onChange={e => setChoferForm(p => ({ ...p, licencia: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Vencimiento licencia *</label>
              <input type="date" className="w-full px-4 h-10 rounded-xl border border-neutral-200 focus:border-primary-500 focus:outline-none"
                value={choferForm.vencimiento} onChange={e => setChoferForm(p => ({ ...p, vencimiento: e.target.value }))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar Eliminar Vehículo */}
      <Modal
        isOpen={!!deleteVehiculoItem}
        onClose={() => setDeleteVehiculoItem(null)}
        title="Confirmar Eliminación"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteVehiculoItem(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteVehiculo}
              disabled={deleteVehiculo.isPending}
            >
              {deleteVehiculo.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
            <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 mb-1">¿Está seguro?</p>
              <p className="text-sm text-red-700">
                Esta acción eliminará el vehículo <strong className="font-mono">{deleteVehiculoItem?.patente}</strong> de forma permanente.
              </p>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar Eliminar Conductor */}
      <Modal
        isOpen={!!deleteChoferItem}
        onClose={() => setDeleteChoferItem(null)}
        title="Confirmar Eliminación"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteChoferItem(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteChofer}
              disabled={deleteChofer.isPending}
            >
              {deleteChofer.isPending ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
            <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900 mb-1">¿Está seguro?</p>
              <p className="text-sm text-red-700">
                Esta acción eliminará al conductor <strong>{deleteChoferItem?.nombre} {deleteChoferItem?.apellido}</strong> de forma permanente.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TransportistaDetallePage;
