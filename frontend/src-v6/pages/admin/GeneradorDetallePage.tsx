/**
 * SITREP v6 - Generador Detail Page (5 tabs)
 * ============================================
 * Info General | Residuos | Situacion Fiscal | DDJJ y Documentos | Historial
 */

import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Factory, MapPin, Phone, Mail, Calendar, Download,
  CheckCircle, AlertTriangle, Biohazard, Shield, FileText,
  DollarSign, ClipboardList, Plus, Pencil, Trash2, X,
  Building2, Award, BookOpen,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/ui/CardV2';
import { Button } from '../../components/ui/ButtonV2';
import { Badge } from '../../components/ui/BadgeV2';
import { Tabs, TabList, Tab, TabPanel } from '../../components/ui/Tabs';
import { Input } from '../../components/ui/Input';
import { toast } from '../../components/ui/Toast';
import { useGenerador } from '../../hooks/useActores';
import { useManifiestos } from '../../hooks/useManifiestos';
import { usePagosTEF, useCreatePago, useUpdatePago, useDeletePago, useDDJJ, useCreateDDJJ, useUpdateDDJJ, useDeleteDDJJ, useDocumentos, useUploadDocumento, useRevisarDocumento, useDeleteDocumento } from '../../hooks/useGeneradorFiscal';
import { downloadCsv } from '../../utils/exportCsv';
import { GENERADORES_DATA } from '../../data/generadores-enrichment';
import { CORRIENTES_Y, parseCorrientes } from '../../data/corrientes-y';
import DocumentUpload from '../../components/DocumentUpload';
import CalculadoraTEF from '../../components/CalculadoraTEF';
import type { PagoTEF, DeclaracionJurada } from '../../services/generador-fiscal.service';
import api from '../../services/api';

// ===== Inline CRUD Modal =====
function CrudModal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-100">
          <h3 className="text-lg font-bold text-neutral-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ===== Pago TEF Form =====
function PagoForm({ initial, onSave, onCancel, isPending }: {
  initial?: Partial<PagoTEF>; onSave: (data: any) => void; onCancel: () => void; isPending: boolean;
}) {
  const [f, setF] = useState({
    anio: initial?.anio || new Date().getFullYear(),
    montoTEF: initial?.montoTEF ?? '',
    resolucion: initial?.resolucion || '',
    notificado: initial?.notificado || false,
    fechaNotificado: initial?.fechaNotificado ? String(initial.fechaNotificado).split('T')[0] : '',
    fechaPago: initial?.fechaPago ? String(initial.fechaPago).split('T')[0] : '',
    pagoFueraTermino: initial?.pagoFueraTermino || false,
    habilitado: initial?.habilitado ?? false,
    gedoNotificacion: initial?.gedoNotificacion || '',
    gedoResolucion: initial?.gedoResolucion || '',
  });
  const up = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Ano *" type="number" value={String(f.anio)} onChange={e => up('anio', Number(e.target.value))} />
        <Input label="Monto TEF ($)" type="number" value={String(f.montoTEF)} onChange={e => up('montoTEF', e.target.value)} />
      </div>
      <Input label="Resolucion" value={f.resolucion} onChange={e => up('resolucion', e.target.value)} placeholder="412/2019" />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Fecha notificado" type="date" value={f.fechaNotificado} onChange={e => up('fechaNotificado', e.target.value)} />
        <Input label="Fecha pago" type="date" value={f.fechaPago} onChange={e => up('fechaPago', e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.notificado} onChange={e => up('notificado', e.target.checked)} className="rounded" /> Notificado</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.pagoFueraTermino} onChange={e => up('pagoFueraTermino', e.target.checked)} className="rounded" /> Fuera de termino</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.habilitado} onChange={e => up('habilitado', e.target.checked)} className="rounded" /> Habilitado</label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="GEDO Notificacion" value={f.gedoNotificacion} onChange={e => up('gedoNotificacion', e.target.value)} />
        <Input label="GEDO Resolucion" value={f.gedoResolucion} onChange={e => up('gedoResolucion', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave({ ...f, montoTEF: f.montoTEF !== '' ? Number(f.montoTEF) : undefined })} disabled={isPending}>
          {isPending ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </div>
  );
}

// ===== DDJJ Form =====
function DDJJForm({ initial, onSave, onCancel, isPending }: {
  initial?: Partial<DeclaracionJurada>; onSave: (data: any) => void; onCancel: () => void; isPending: boolean;
}) {
  const [f, setF] = useState({
    anio: initial?.anio || new Date().getFullYear(),
    numeroGDE: initial?.numeroGDE || '',
    presentada: initial?.presentada || false,
    fechaPresentacion: initial?.fechaPresentacion ? String(initial.fechaPresentacion).split('T')[0] : '',
    observaciones: initial?.observaciones || '',
  });
  const up = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Ano *" type="number" value={String(f.anio)} onChange={e => up('anio', Number(e.target.value))} />
        <Input label="Numero GDE" value={f.numeroGDE} onChange={e => up('numeroGDE', e.target.value)} placeholder="1122009" />
      </div>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={f.presentada} onChange={e => up('presentada', e.target.checked)} className="rounded" /> Presentada</label>
      </div>
      <Input label="Fecha presentacion" type="date" value={f.fechaPresentacion} onChange={e => up('fechaPresentacion', e.target.value)} />
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Observaciones</label>
        <textarea
          value={f.observaciones}
          onChange={e => up('observaciones', e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:border-primary-500 focus:outline-none resize-none"
          rows={2}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(f)} disabled={isPending}>{isPending ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </div>
  );
}

// ===== Main Component =====
const GeneradorDetallePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');

  const [historialPage, setHistorialPage] = useState(1);
  const [pagoModal, setPagoModal] = useState<{ open: boolean; editing?: PagoTEF }>({ open: false });
  const [ddjjModal, setDdjjModal] = useState<{ open: boolean; editing?: DeclaracionJurada }>({ open: false });

  const { data: apiGenerador, isLoading } = useGenerador(id || '');
  const { data: manifiestoData } = useManifiestos({ generadorId: id, limit: 20, page: historialPage }, { enabled: !!id });
  const { data: pagos = [] } = usePagosTEF(id || '');
  const { data: ddjjList = [] } = useDDJJ(id || '');
  const { data: documentos = [] } = useDocumentos(id || '');

  const createPago = useCreatePago();
  const updatePago = useUpdatePago();
  const deletePago = useDeletePago();
  const createDDJJ = useCreateDDJJ();
  const updateDDJJ = useUpdateDDJJ();
  const deleteDDJJ = useDeleteDDJJ();
  const uploadDoc = useUploadDocumento();
  const revisarDoc = useRevisarDocumento();
  const deleteDoc = useDeleteDocumento();

  const generador = apiGenerador ? {
    ...apiGenerador,
    estado: (apiGenerador as any).activo !== false ? 'activo' : 'inactivo',
    inscripcionDGFA: (apiGenerador as any).numeroInscripcion || '-',
    fechaAlta: (apiGenerador as any).createdAt ? new Date((apiGenerador as any).createdAt).toISOString().split('T')[0] : '-',
  } : null;

  const backPath = isMobile ? '/mobile/admin/actores/generadores' : '/admin/actores/generadores';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
        </div>
        <Card className="py-12">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full mx-auto mb-4" />
            <p className="text-neutral-500">Cargando generador...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!generador) return null;

  const g = generador as any;
  const enriched = generador.cuit ? (GENERADORES_DATA[generador.cuit] || GENERADORES_DATA[generador.cuit.replace(/^(\d{2})(\d{8})(\d)$/, '$1-$2-$3')]) : null;
  const categorias = g.corrientesControl
    ? parseCorrientes(g.corrientesControl)
    : (enriched?.categoriasControl || []);

  // Compliance computation
  const currentYear = new Date().getFullYear();
  const lastPago = pagos.find(p => p.anio === currentYear - 1) || pagos.find(p => p.anio === currentYear);
  const tefAlDia = lastPago?.fechaPago != null;
  const ddjjRecent = ddjjList.filter(d => d.anio >= currentYear - 1 && d.presentada);
  const habilitado = lastPago?.habilitado ?? false;

  // Pago handlers
  const handleSavePago = async (data: any) => {
    try {
      if (pagoModal.editing) {
        await updatePago.mutateAsync({ generadorId: id!, pagoId: pagoModal.editing.id, data });
        toast.success('Pago actualizado');
      } else {
        await createPago.mutateAsync({ generadorId: id!, data });
        toast.success('Pago registrado');
      }
      setPagoModal({ open: false });
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo guardar');
    }
  };

  const handleDeletePago = async (pagoId: string) => {
    if (!confirm('Eliminar este pago?')) return;
    try {
      await deletePago.mutateAsync({ generadorId: id!, pagoId });
      toast.success('Pago eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  // DDJJ handlers
  const handleSaveDDJJ = async (data: any) => {
    try {
      if (ddjjModal.editing) {
        await updateDDJJ.mutateAsync({ generadorId: id!, ddjjId: ddjjModal.editing.id, data });
        toast.success('DDJJ actualizada');
      } else {
        await createDDJJ.mutateAsync({ generadorId: id!, data });
        toast.success('DDJJ registrada');
      }
      setDdjjModal({ open: false });
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo guardar');
    }
  };

  const handleDeleteDDJJ = async (ddjjId: string) => {
    if (!confirm('Eliminar esta DDJJ?')) return;
    try {
      await deleteDDJJ.mutateAsync({ generadorId: id!, ddjjId });
      toast.success('DDJJ eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  // Doc handlers
  const handleUploadDoc = async (file: File, tipo: string, anio?: number) => {
    try {
      await uploadDoc.mutateAsync({ generadorId: id!, file, tipo, anio });
      toast.success('Documento subido');
    } catch (err: any) {
      toast.error('Error', err?.response?.data?.message || 'No se pudo subir');
    }
  };

  const handleDownloadDoc = (doc: any) => {
    window.open(`${api.defaults.baseURL}/actores/documentos/${doc.id}/download`, '_blank');
  };

  const handleRevisarDoc = async (docId: string, estado: 'APROBADO' | 'RECHAZADO') => {
    try {
      await revisarDoc.mutateAsync({ docId, estado, generadorId: id! });
      toast.success(estado === 'APROBADO' ? 'Documento aprobado' : 'Documento rechazado');
    } catch { toast.error('Error al revisar'); }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Eliminar documento?')) return;
    try {
      await deleteDoc.mutateAsync({ docId, generadorId: id! });
      toast.success('Documento eliminado');
    } catch { toast.error('Error al eliminar'); }
  };

  const fmtMoney = (v: number | null) => v != null ? `$ ${v.toLocaleString('es-AR', { minimumFractionDigits: 0 })}` : '-';
  const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString('es-AR') : '-';

  return (
    <div className="space-y-6 animate-fade-in xl:max-w-7xl xl:mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate(backPath)}>Volver</Button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
              <Factory size={28} className="text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-bold text-neutral-900">{generador.razonSocial}</h2>
                <Badge variant="soft" color={generador.estado === 'activo' ? 'success' : 'warning'}>
                  {generador.estado === 'activo' ? <CheckCircle size={12} className="mr-1" /> : <AlertTriangle size={12} className="mr-1" />}
                  {generador.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </Badge>
                <Badge variant="outline" color="neutral">{generador.categoria}</Badge>
              </div>
              <p className="text-neutral-600 mt-1 font-mono text-sm">CUIT: {generador.cuit}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={16} />} onClick={() => {
            if (generador) downloadCsv([{
              RazonSocial: generador.razonSocial, CUIT: generador.cuit,
              Domicilio: generador.domicilio, Telefono: generador.telefono,
              Email: generador.email, Inscripcion: generador.inscripcionDGFA,
              Estado: generador.estado
            }], 'generador-' + (generador.cuit || id));
          }}>Exportar</Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Categoria</p>
          <p className="text-lg font-bold text-neutral-900 mt-1">{generador.categoria || '-'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Corrientes Y</p>
          <p className="text-2xl font-bold text-neutral-900 mt-1">{categorias.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">TEF</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2.5 h-2.5 rounded-full ${tefAlDia ? 'bg-success-500' : 'bg-error-500'}`} />
            <p className="text-lg font-bold text-neutral-900">{tefAlDia ? 'Al dia' : 'Pendiente'}</p>
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wider">Habilitacion</p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2.5 h-2.5 rounded-full ${habilitado ? 'bg-success-500' : 'bg-warning-500'}`} />
            <p className="text-lg font-bold text-neutral-900">{habilitado ? 'Si' : 'No'}</p>
          </div>
        </Card>
      </div>

      {/* 5 Tabs */}
      <Tabs defaultTab="info" variant="default">
        <TabList>
          <Tab id="info" icon={<Factory size={16} />}>Info General</Tab>
          <Tab id="residuos" icon={<Biohazard size={16} />}>Residuos</Tab>
          <Tab id="fiscal" icon={<DollarSign size={16} />}>Situacion Fiscal</Tab>
          <Tab id="ddjj" icon={<ClipboardList size={16} />}>DDJJ y Documentos</Tab>
          <Tab id="historial" icon={<FileText size={16} />}>Historial</Tab>
        </TabList>

        {/* ===== Tab 1: Info General (expanded) ===== */}
        <TabPanel id="info">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Datos empresa */}
            <Card>
              <CardHeader title="Datos de la Empresa" icon={<Factory size={20} />} />
              <CardContent>
                <div className="space-y-4">
                  <InfoRow icon={<Shield size={16} />} label="Inscripcion DGFA" value={generador.inscripcionDGFA} />
                  <InfoRow icon={<Calendar size={16} />} label="Fecha de alta" value={generador.fechaAlta} />
                  <InfoRow icon={<Phone size={16} />} label="Telefono" value={generador.telefono} />
                  <InfoRow icon={<Mail size={16} />} label="Email" value={generador.email} />
                  {g.actividad && <InfoRow icon={<FileText size={16} />} label="Actividad" value={g.actividad} />}
                  {g.rubro && <InfoRow icon={<FileText size={16} />} label="Rubro" value={g.rubro} />}
                  {g.expedienteInscripcion && <InfoRow icon={<FileText size={16} />} label="Expediente" value={g.expedienteInscripcion} />}
                  {g.resolucionInscripcion && <InfoRow icon={<Award size={16} />} label="Resolucion" value={g.resolucionInscripcion} />}
                  {g.certificacionISO && (
                    <InfoRow icon={<Award size={16} />} label="Certificacion ISO" value={
                      <Badge variant="soft" color={new Date(g.certificacionISO) > new Date() ? 'success' : 'error'}>
                        {new Date(g.certificacionISO).toLocaleDateString('es-AR')}
                      </Badge>
                    } />
                  )}
                  {g.factorR != null && <InfoRow icon={<DollarSign size={16} />} label="Factor R" value={String(g.factorR)} />}
                  {g.montoMxR != null && <InfoRow icon={<DollarSign size={16} />} label="Monto MxR" value={fmtMoney(g.montoMxR)} />}
                  {g.categoriaIndividual && <InfoRow icon={<ClipboardList size={16} />} label="Categoria Individual" value={g.categoriaIndividual} />}
                  {g.libroOperatoria != null && (
                    <InfoRow icon={<BookOpen size={16} />} label="Libro Operatoria" value={
                      <Badge variant="soft" color={g.libroOperatoria ? 'success' : 'error'}>{g.libroOperatoria ? 'SI' : 'NO'}</Badge>
                    } />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right: Domicilios */}
            <div className="space-y-6">
              <Card>
                <CardHeader title="Direccion Fiscal" icon={<Building2 size={20} />} />
                <CardContent>
                  {g.domicilioLegalCalle ? (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-neutral-900">{g.domicilioLegalCalle}</p>
                      <p className="text-neutral-600">{[g.domicilioLegalLocalidad, g.domicilioLegalDepto].filter(Boolean).join(', ')}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-400">{generador.domicilio || 'Sin datos'}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader title="Direccion Real" icon={<MapPin size={20} />} />
                <CardContent>
                  {g.domicilioRealCalle ? (
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-neutral-900">{g.domicilioRealCalle}</p>
                      <p className="text-neutral-600">{[g.domicilioRealLocalidad, g.domicilioRealDepto].filter(Boolean).join(', ')}</p>
                    </div>
                  ) : g.domicilioLegalCalle ? (
                    <p className="text-sm text-neutral-400 italic">Igual a la direccion fiscal</p>
                  ) : (
                    <p className="text-sm text-neutral-400">Sin datos</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabPanel>

        {/* ===== Tab 2: Residuos ===== */}
        <TabPanel id="residuos">
          {categorias.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-500">
                  {categorias.length} corriente{categorias.length !== 1 ? 's' : ''} de residuos peligrosos inscripta{categorias.length !== 1 ? 's' : ''} (Convenio de Basilea)
                </p>
                <Badge variant="soft" color="warning">{categorias.length} categorias</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categorias.map((code: string) => (
                  <div key={code} className="flex items-start gap-3 p-4 bg-white border border-neutral-200 rounded-xl hover:border-purple-300 hover:bg-purple-50/30 transition-colors">
                    <div className="shrink-0 w-14 h-8 bg-amber-100 border border-amber-300 rounded-md flex items-center justify-center">
                      <span className="text-xs font-bold text-amber-800">{code}</span>
                    </div>
                    <p className="text-sm text-neutral-700 leading-relaxed">
                      {CORRIENTES_Y[code] || 'Descripcion no disponible'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Card className="py-12">
              <div className="text-center">
                <Biohazard size={32} className="text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500">No se encontraron categorias de residuos inscriptas</p>
              </div>
            </Card>
          )}
        </TabPanel>

        {/* ===== Tab 3: Situacion Fiscal (Pagos TEF) ===== */}
        <TabPanel id="fiscal">
          <div className="space-y-6">
            {/* KPI mini-cards */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <p className="text-xs text-neutral-500">Ultimo TEF</p>
                <p className="text-lg font-bold text-neutral-900 mt-1">
                  {pagos.length > 0 ? fmtMoney(pagos[0].montoTEF) : '-'}
                </p>
                {pagos.length > 0 && <p className="text-xs text-neutral-400">{pagos[0].anio}</p>}
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-neutral-500">Anos al dia</p>
                <p className="text-2xl font-bold text-success-600 mt-1">{pagos.filter(p => p.fechaPago).length}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-xs text-neutral-500">Pendientes</p>
                <p className="text-2xl font-bold text-error-600 mt-1">{pagos.filter(p => !p.fechaPago).length}</p>
              </Card>
            </div>

            {/* CRUD Table */}
            <Card>
              <CardHeader title="Registro de Pagos TEF" icon={<DollarSign size={20} />}>
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setPagoModal({ open: true })}>
                  Registrar Pago
                </Button>
              </CardHeader>
              <CardContent>
                {pagos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">Ano</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">TEF</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 hidden md:table-cell">Resolucion</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-neutral-600">Notif.</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 hidden md:table-cell">F. Pago</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-neutral-600">Hab.</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {pagos.map(p => (
                          <tr key={p.id} className="hover:bg-neutral-50">
                            <td className="px-3 py-2.5 font-bold text-neutral-900">{p.anio}</td>
                            <td className="px-3 py-2.5 font-mono">{fmtMoney(p.montoTEF)}</td>
                            <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{p.resolucion || '-'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <div className={`w-2.5 h-2.5 rounded-full mx-auto ${p.notificado ? 'bg-success-500' : 'bg-neutral-200'}`} />
                            </td>
                            <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{fmtDate(p.fechaPago)}</td>
                            <td className="px-3 py-2.5 text-center">
                              {p.habilitado != null && (
                                <Badge variant="soft" color={p.habilitado ? 'success' : 'error'} className="text-[10px] px-1.5">
                                  {p.habilitado ? 'SI' : 'NO'}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button onClick={() => setPagoModal({ open: true, editing: p })} className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-primary-600"><Pencil size={14} /></button>
                              <button onClick={() => handleDeletePago(p.id)} className="p-1 rounded hover:bg-error-50 text-neutral-400 hover:text-error-600 ml-1"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-6">Sin pagos registrados</p>
                )}
              </CardContent>
            </Card>

            {/* Calculadora TEF */}
            <CalculadoraTEF
              corrientesY={categorias}
              tieneISO={!!(g.certificacionISO)}
            />

            {/* Habilitaciones timeline */}
            {pagos.length > 0 && (
              <Card>
                <CardHeader title="Timeline Habilitaciones" icon={<Shield size={20} />} />
                <CardContent>
                  <div className="flex gap-2 flex-wrap">
                    {pagos.slice().reverse().map(p => (
                      <div key={p.id} className="flex flex-col items-center gap-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          p.habilitado ? 'bg-success-500' : p.fechaPago ? 'bg-warning-500' : 'bg-neutral-300'
                        }`}>
                          {String(p.anio).slice(-2)}
                        </div>
                        <span className="text-[10px] text-neutral-400">{p.anio}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabPanel>

        {/* ===== Tab 4: DDJJ y Documentos ===== */}
        <TabPanel id="ddjj">
          <div className="space-y-8">
            {/* DDJJ Table */}
            <Card>
              <CardHeader title="Declaraciones Juradas" icon={<ClipboardList size={20} />}>
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setDdjjModal({ open: true })}>
                  Registrar DDJJ
                </Button>
              </CardHeader>
              <CardContent>
                {ddjjList.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-50">
                        <tr>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">Ano</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600">N GDE</th>
                          <th className="px-3 py-2.5 text-center text-xs font-semibold text-neutral-600">Presentada</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 hidden md:table-cell">Fecha</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 hidden md:table-cell">Obs.</th>
                          <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {ddjjList.map(d => (
                          <tr key={d.id} className="hover:bg-neutral-50">
                            <td className="px-3 py-2.5 font-bold text-neutral-900">{d.anio}</td>
                            <td className="px-3 py-2.5 font-mono text-neutral-600">{d.numeroGDE || '-'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <Badge variant="soft" color={d.presentada ? 'success' : 'error'} className="text-[10px] px-1.5">
                                {d.presentada ? 'SI' : 'NO'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-neutral-600 hidden md:table-cell">{fmtDate(d.fechaPresentacion)}</td>
                            <td className="px-3 py-2.5 text-neutral-500 text-xs hidden md:table-cell truncate max-w-[150px]" title={d.observaciones || '-'}>{d.observaciones || '-'}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button onClick={() => setDdjjModal({ open: true, editing: d })} className="p-1 rounded hover:bg-neutral-100 text-neutral-400 hover:text-primary-600"><Pencil size={14} /></button>
                              <button onClick={() => handleDeleteDDJJ(d.id)} className="p-1 rounded hover:bg-error-50 text-neutral-400 hover:text-error-600 ml-1"><Trash2 size={14} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400 text-center py-6">Sin DDJJ registradas</p>
                )}
              </CardContent>
            </Card>

            {/* Documentos */}
            <Card>
              <CardHeader title="Documentos" icon={<FileText size={20} />} />
              <CardContent>
                <DocumentUpload
                  documentos={documentos}
                  onUpload={handleUploadDoc}
                  onDownload={handleDownloadDoc}
                  onRevisar={handleRevisarDoc}
                  onDelete={handleDeleteDoc}
                  isAdmin={true}
                  isPending={uploadDoc.isPending}
                />
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        {/* ===== Tab 5: Historial ===== */}
        <TabPanel id="historial">
          <Card>
            <CardHeader title="Historial de Manifiestos" icon={<FileText size={20} />} />
            <CardContent>
              {(manifiestoData?.items?.length ?? 0) > 0 ? (
                <table className="w-full table-fixed">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Numero</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Estado</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '22%' }}>Transportista</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-neutral-600 uppercase hidden md:table-cell" style={{ width: '18%' }}>Fecha</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-neutral-600 uppercase" style={{ width: '20%' }}>Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {manifiestoData!.items.map((m: any) => (
                      <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-3 py-2.5 font-mono text-sm font-semibold text-neutral-900">{m.numero}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="soft" color={
                            m.estado === 'TRATADO' ? 'success' :
                            m.estado === 'EN_TRANSITO' ? 'warning' :
                            m.estado === 'CANCELADO' || m.estado === 'RECHAZADO' ? 'error' : 'neutral'
                          }>
                            {m.estado}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-neutral-700 hidden md:table-cell">{m.transportista?.razonSocial || '-'}</td>
                        <td className="px-3 py-2.5 text-sm text-neutral-600 hidden md:table-cell">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('es-AR') : '-'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Button variant="ghost" size="sm" onClick={() => navigate(isMobile ? `/mobile/manifiestos/${m.id}` : `/manifiestos/${m.id}`)}>Ver</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-neutral-400 text-center py-6">Sin manifiestos registrados</p>
              )}
              {(manifiestoData?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 mt-2">
                  <p className="text-sm text-neutral-500">Pagina {manifiestoData!.page} de {manifiestoData!.totalPages} · {manifiestoData!.total} total</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={historialPage === 1} onClick={() => setHistorialPage(p => p - 1)}>Anterior</Button>
                    <Button variant="outline" size="sm" disabled={historialPage === manifiestoData!.totalPages} onClick={() => setHistorialPage(p => p + 1)}>Siguiente</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabPanel>
      </Tabs>

      {/* Pago Modal */}
      {pagoModal.open && (
        <CrudModal title={pagoModal.editing ? 'Editar Pago TEF' : 'Registrar Pago TEF'} onClose={() => setPagoModal({ open: false })}>
          <PagoForm initial={pagoModal.editing} onSave={handleSavePago} onCancel={() => setPagoModal({ open: false })} isPending={createPago.isPending || updatePago.isPending} />
        </CrudModal>
      )}

      {/* DDJJ Modal */}
      {ddjjModal.open && (
        <CrudModal title={ddjjModal.editing ? 'Editar DDJJ' : 'Registrar DDJJ'} onClose={() => setDdjjModal({ open: false })}>
          <DDJJForm initial={ddjjModal.editing} onSave={handleSaveDDJJ} onCancel={() => setDdjjModal({ open: false })} isPending={createDDJJ.isPending || updateDDJJ.isPending} />
        </CrudModal>
      )}
    </div>
  );
};

// Helper component
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-neutral-400 shrink-0">{icon}</span>
      <div>
        <p className="text-neutral-500">{label}</p>
        <div className="font-medium text-neutral-900">{typeof value === 'string' ? value || '-' : value}</div>
      </div>
    </div>
  );
}

export default GeneradorDetallePage;
