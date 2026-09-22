import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarClock, ChevronRight, ClipboardCheck, FileText, Scale } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/BadgeV2';
import { Card } from '../../components/ui/CardV2';
import { inspeccionService } from '../../services/inspeccion.service';
import { InspectionExchangePanel } from './InspectionExchangePanel';
import { INSPECTION_STATE_COLORS, INSPECTION_STATE_LABELS, inspectionDate } from './inspectionPresentation';

const InspeccionadoParticipacionPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/mobile') ? '/mobile' : '';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const listQuery = useQuery({
    queryKey: ['inspecciones', 'participacion'],
    queryFn: () => inspeccionService.listParticipation(),
    enabled: !id,
    staleTime: 20_000,
  });

  if (id) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-5 pb-24 lg:pb-8">
        <button type="button" onClick={() => navigate(`${prefix}/mis-inspecciones`)} className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"><ArrowLeft size={18} />Volver a mis inspecciones</button>
        <div id="trazabilidad" className="scroll-mt-24"><InspectionExchangePanel inspectionId={id} /></div>
      </div>
    );
  }

  const cases = listQuery.data || [];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-24 lg:pb-8">
      <header className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F4EC] text-[#1B5E3C]"><Scale size={23} /></div>
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#1B5E3C]">Participación formal</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#10213A]">Mis inspecciones</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-neutral-600">Consulte actuaciones puestas a su disposición, responda requerimientos y adjunte documentación dentro del expediente auditado.</p></div>
      </header>

      <Card className="!p-0">
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 sm:px-5"><p className="text-xs font-bold uppercase tracking-wide text-neutral-600">Expedientes disponibles · {cases.length}</p></div>
        {listQuery.isLoading ? <p className="px-5 py-10 text-center text-sm text-neutral-500">Consultando expedientes…</p> : listQuery.isError ? <div className="px-5 py-10 text-center"><p className="font-bold text-error-800">No se pudieron consultar sus inspecciones.</p><button type="button" onClick={() => void listQuery.refetch()} className="mt-3 text-sm font-semibold text-primary-700 hover:underline">Volver a intentar</button></div> : cases.length === 0 ? <div className="px-5 py-12 text-center"><ClipboardCheck className="mx-auto text-neutral-300" size={40} /><p className="mt-3 font-bold text-[#10213A]">No hay inspecciones puestas a disposición</p><p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-neutral-600">Cuando la autoridad notifique una actuación a su entidad, aparecerá aquí. Esta pantalla no muestra borradores internos.</p></div> : <div className="divide-y divide-neutral-200">{cases.map((inspection) => {
          const expired = Boolean(inspection.plazoRespuestaAt && new Date(inspection.plazoRespuestaAt).getTime() < now);
          return <button key={inspection.id} type="button" onClick={() => navigate(`${prefix}/mis-inspecciones/${inspection.id}`)} className="grid w-full grid-cols-1 gap-3 px-4 py-4 text-left transition-colors hover:bg-primary-50/40 focus:bg-primary-50/50 focus:outline-none sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-center sm:px-5"><div><p className="font-extrabold text-[#10213A]">{inspection.numero}</p><p className="mt-0.5 text-xs text-neutral-500">Acta {inspection.numeroActa || 'sin numerar'}</p></div><div><p className="font-semibold text-neutral-900">{inspection.actor?.razonSocial || 'Entidad inspeccionada'}</p><p className="mt-0.5 text-xs text-neutral-500">CUIT {inspection.actor?.cuit || 's/d'}</p></div><div className="flex flex-wrap items-center gap-2"><Badge color={INSPECTION_STATE_COLORS[inspection.estado] || 'neutral'}>{INSPECTION_STATE_LABELS[inspection.estado]}</Badge>{inspection.plazoRespuestaAt && <span className={`inline-flex items-center gap-1 text-xs font-semibold ${expired ? 'text-error-700' : 'text-neutral-600'}`}><CalendarClock size={14} />{expired ? 'Venció ' : 'Hasta '}{inspectionDate(inspection.plazoRespuestaAt)}</span>}<span className="inline-flex items-center gap-1 text-xs text-neutral-500"><FileText size={14} />{inspection.cantidadPresentaciones}</span></div><ChevronRight className="hidden text-neutral-400 sm:block" size={20} /></button>;
        })}</div>}
      </Card>
    </div>
  );
};

export default InspeccionadoParticipacionPage;
