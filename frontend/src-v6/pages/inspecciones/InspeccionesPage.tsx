import React, { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ClipboardCheck, Plus, Search, MapPin, CalendarDays, Camera, UserRound, X } from 'lucide-react';
import { Button } from '../../components/ui/ButtonV2';
import { Badge, type BadgeColor } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { toast } from '../../components/ui/Toast';
import { useAuth } from '../../contexts/AuthContext';
import { useCatalogoGeneradores, useCatalogoOperadores, useCatalogoTransportistas } from '../../hooks/useCatalogos';
import { useInspections, useInspectionMutation } from '../../hooks/useInspecciones';
import { inspeccionService } from '../../services/inspeccion.service';
import type { InspectionActorType, InspectionState } from '../../types/inspection';
import { inspectionActor } from '../../types/inspection';

const STATE_LABELS: Record<InspectionState, string> = {
  BORRADOR: 'Borrador', PLANIFICADA: 'Planificada', EN_CAMPO: 'En campo', EN_REVISION: 'En revisión',
  NOTIFICADA: 'Notificada', EN_DESCARGO: 'En descargo', REQUIERE_SUBSANACION: 'Requiere subsanación',
  CERRADA_CONFORME: 'Cerrada conforme', DERIVADA_LEGALES: 'Derivada a legales', EN_TRAMITE_LEGAL: 'En trámite legal',
  DERIVADA_ATM: 'Derivada a ATM', FINALIZADA: 'Finalizada', CANCELADA: 'Cancelada',
};

const STATE_COLORS: Partial<Record<InspectionState, BadgeColor>> = {
  BORRADOR: 'neutral', PLANIFICADA: 'info', EN_CAMPO: 'primary', EN_REVISION: 'warning',
  NOTIFICADA: 'info', EN_DESCARGO: 'warning', REQUIERE_SUBSANACION: 'error',
  CERRADA_CONFORME: 'success', DERIVADA_LEGALES: 'error', EN_TRAMITE_LEGAL: 'warning',
  DERIVADA_ATM: 'warning', FINALIZADA: 'success', CANCELADA: 'neutral',
};

const ACTOR_LABELS: Record<InspectionActorType, string> = {
  GENERADOR: 'Generador', TRANSPORTISTA: 'Transportista', OPERADOR: 'Operador',
};

const InspeccionesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mobile = location.pathname.startsWith('/mobile');
  const { currentUser, isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const [state, setState] = useState<InspectionState | ''>('');
  const [showCreate, setShowCreate] = useState(false);
  const [type, setType] = useState<InspectionActorType>('GENERADOR');
  const [actorId, setActorId] = useState('');
  const [numeroActa, setNumeroActa] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [fechaProgramada, setFechaProgramada] = useState('');

  const allowed = Boolean(isAdmin || currentUser?.esInspector || currentUser?.rol.startsWith('ADMIN_'));
  const inspections = useInspections({ estado: state || undefined, search: search || undefined, limit: 100 });
  const generadores = useCatalogoGeneradores();
  const transportistas = useCatalogoTransportistas();
  const operadores = useCatalogoOperadores();
  const actorOptions = useMemo(() => {
    if (type === 'GENERADOR') return generadores.data || [];
    if (type === 'TRANSPORTISTA') return transportistas.data || [];
    return operadores.data || [];
  }, [type, generadores.data, transportistas.data, operadores.data]);

  const createMutation = useInspectionMutation(async () => {
    const created = await inspeccionService.create({
      tipoActor: type,
      actorId,
      numeroActa: numeroActa || undefined,
      ubicacion: ubicacion || undefined,
      fechaProgramada: fechaProgramada ? new Date(fechaProgramada).toISOString() : undefined,
    });
    return created;
  });

  const createInspection = async () => {
    if (!actorId) return toast.warning('Actor requerido', 'Seleccione la entidad que se inspeccionará.');
    try {
      const created = await createMutation.mutateAsync(undefined) as Awaited<ReturnType<typeof inspeccionService.create>>;
      toast.success('Inspección creada', `${created.numero} quedó en borrador.`);
      navigate(`${mobile ? '/mobile' : ''}/inspecciones/${created.id}`);
    } catch (error: any) {
      toast.error('No se pudo crear', error?.response?.data?.message || 'Revise los datos e intente nuevamente.');
    }
  };

  if (!allowed) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <ClipboardCheck className="mx-auto text-neutral-400" size={36} />
        <h2 className="mt-4 text-xl font-bold text-neutral-900">Acceso reservado a inspecciones</h2>
        <p className="mt-2 text-sm text-neutral-600">Su cuenta no tiene el perfil inspector habilitado.</p>
      </Card>
    );
  }

  const rows = inspections.data?.items || [];
  const inField = rows.filter((item) => item.estado === 'EN_CAMPO').length;
  const pendingReview = rows.filter((item) => item.estado === 'EN_REVISION').length;
  const deadlines = rows.filter((item) => item.plazoRespuestaAt && new Date(item.plazoRespuestaAt) > new Date()).length;

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-primary-700"><ClipboardCheck size={23} /></div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">Inspecciones</h2>
            <p className="text-sm text-neutral-600">Expedientes de campo, revisión y trazabilidad.</p>
          </div>
        </div>
        <Button leftIcon={<Plus size={17} />} onClick={() => setShowCreate(true)}>Nueva inspección</Button>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="!p-4"><p className="text-sm text-neutral-500">En campo</p><p className="mt-1 text-2xl font-bold text-primary-700">{inField}</p></Card>
        <Card className="!p-4"><p className="text-sm text-neutral-500">Pendientes de revisión</p><p className="mt-1 text-2xl font-bold text-amber-700">{pendingReview}</p></Card>
        <Card className="!p-4"><p className="text-sm text-neutral-500">Con plazo abierto</p><p className="mt-1 text-2xl font-bold text-blue-700">{deadlines}</p></Card>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por número, acta o actor" className="h-11 w-full rounded-lg border border-neutral-300 bg-white pl-10 pr-3 text-sm text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </label>
        <select value={state} onChange={(event) => setState(event.target.value as InspectionState | '')} className="h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-800 focus:border-primary-600 focus:outline-none">
          <option value="">Todos los estados</option>
          {Object.entries(STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {inspections.isLoading ? <p className="p-8 text-center text-sm text-neutral-500">Cargando inspecciones…</p> : rows.length === 0 ? (
          <div className="p-10 text-center"><ClipboardCheck className="mx-auto text-neutral-300" size={40} /><p className="mt-3 font-semibold text-neutral-800">Todavía no hay inspecciones</p><p className="mt-1 text-sm text-neutral-500">Creá el primer expediente para comenzar el trabajo de campo.</p></div>
        ) : rows.map((inspection) => {
          const actor = inspectionActor(inspection);
          return (
            <button key={inspection.id} onClick={() => navigate(`${mobile ? '/mobile' : ''}/inspecciones/${inspection.id}`)} className="grid w-full grid-cols-1 gap-3 border-b border-neutral-100 p-4 text-left transition last:border-0 hover:bg-primary-50/40 sm:grid-cols-[1.1fr_1.5fr_1fr_auto] sm:items-center">
              <div><p className="font-bold text-neutral-950">{inspection.numero}</p><p className="mt-1 text-xs text-neutral-500">{inspection.numeroActa || 'Acta sin numerar'}</p></div>
              <div><p className="font-semibold text-neutral-900">{actor?.razonSocial || 'Actor no disponible'}</p><p className="mt-1 text-xs text-neutral-500">{ACTOR_LABELS[inspection.tipoActor]} · {actor?.cuit}</p></div>
              <div className="flex items-center gap-2 text-sm text-neutral-600"><UserRound size={15} /><span>{inspection.inspector.nombre} {inspection.inspector.apellido || ''}</span></div>
              <div className="flex items-center justify-between gap-3 sm:justify-end"><Badge color={STATE_COLORS[inspection.estado] || 'neutral'}>{STATE_LABELS[inspection.estado]}</Badge><span className="text-xs text-neutral-400">{inspection._count?.evidencias || 0} evid.</span></div>
            </button>
          );
        })}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5" onClick={() => setShowCreate(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="new-inspection-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><h3 id="new-inspection-title" className="text-xl font-bold text-neutral-950">Nueva inspección</h3><p className="mt-1 text-sm text-neutral-600">Se crea un expediente con el checklist correspondiente al actor.</p></div>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" aria-label="Cerrar"><X size={20} /></button>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-neutral-800">Tipo de actor
                <select value={type} onChange={(event) => { setType(event.target.value as InspectionActorType); setActorId(''); }} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">
                  {Object.entries(ACTOR_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-neutral-800">Actor inspeccionado
                <select value={actorId} onChange={(event) => setActorId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 font-normal">
                  <option value="">Seleccionar actor…</option>
                  {actorOptions.map((actor) => <option key={String(actor.id)} value={String(actor.id)}>{String(actor.razonSocial || actor.nombre || actor.id)}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold text-neutral-800">Número de acta
                <input value={numeroActa} onChange={(event) => setNumeroActa(event.target.value)} placeholder="Opcional al iniciar" className="mt-2 h-11 w-full rounded-lg border border-neutral-300 px-3 font-normal" />
              </label>
              <label className="text-sm font-semibold text-neutral-800">Fecha programada
                <div className="relative mt-2"><CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} /><input type="datetime-local" value={fechaProgramada} onChange={(event) => setFechaProgramada(event.target.value)} className="h-11 w-full rounded-lg border border-neutral-300 pl-10 pr-3 font-normal" /></div>
              </label>
              <label className="text-sm font-semibold text-neutral-800 sm:col-span-2">Ubicación prevista
                <div className="relative mt-2"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} /><input value={ubicacion} onChange={(event) => setUbicacion(event.target.value)} placeholder="Domicilio o referencia" className="h-11 w-full rounded-lg border border-neutral-300 pl-10 pr-3 font-normal" /></div>
              </label>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button isLoading={createMutation.isPending} leftIcon={<Camera size={17} />} onClick={createInspection}>Crear expediente</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default InspeccionesPage;
