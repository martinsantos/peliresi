import React, { useMemo, useRef, useState } from 'react';
import {
  Building2,
  CalendarClock,
  Clock3,
  FileText,
  LockKeyhole,
  MailWarning,
  MessageSquareText,
  Paperclip,
  Reply,
  Send,
  UserRound,
  Workflow,
} from 'lucide-react';
import type { Inspection, InspectionEvent } from '../../types/inspection';
import { Button } from '../../components/ui/ButtonV2';

type EventInput = {
  tipo: 'COMENTARIO_INTERNO' | 'NOTIFICACION_PREPARADA';
  titulo: string;
  detalle: string;
  visibleActor: boolean;
  destinatario?: string | null;
};

type EventParty = 'ORGANISMO' | 'INSPECCIONADO' | 'INTERNO';

function eventPresentation(event: InspectionEvent): {
  party: EventParty;
  partyLabel: string;
  kindLabel: string;
  icon: React.ReactNode;
  accent: string;
} {
  if (event.tipo === 'RESPUESTA_ACTOR') {
    return {
      party: 'INSPECCIONADO',
      partyLabel: 'Inspeccionado',
      kindLabel: 'Respuesta',
      icon: <Reply size={15} aria-hidden="true" />,
      accent: 'border-l-blue-500',
    };
  }
  if (event.tipo === 'COMENTARIO_INTERNO') {
    return {
      party: 'INTERNO',
      partyLabel: 'Nota interna',
      kindLabel: 'Actuación interna',
      icon: <LockKeyhole size={15} aria-hidden="true" />,
      accent: 'border-l-neutral-400',
    };
  }
  if (event.tipo === 'SOLICITUD_CORRECCION') {
    return {
      party: 'ORGANISMO',
      partyLabel: 'Organismo',
      kindLabel: 'Requerimiento',
      icon: <Send size={15} aria-hidden="true" />,
      accent: 'border-l-primary-600',
    };
  }
  return {
    party: 'ORGANISMO',
    partyLabel: 'Organismo',
    kindLabel: event.tipo === 'NOTIFICACION_PREPARADA' ? 'Notificación preparada' : 'Actuación',
    icon: <Building2 size={15} aria-hidden="true" />,
    accent: event.estadoEntrega === 'NO_ENVIADO' ? 'border-l-amber-500' : 'border-l-primary-600',
  };
}

function deadlinePresentation(value?: string | null) {
  if (!value) return null;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return null;
  const expired = deadline.getTime() < Date.now();
  return {
    expired,
    label: deadline.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' }),
  };
}

export function InspectionTimeline({ inspection, canComment, busy, onAdd }: {
  inspection: Inspection;
  canComment: boolean;
  busy: boolean;
  onAdd: (input: EventInput, file?: File) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EventInput['tipo']>('COMENTARIO_INTERNO');
  const [detail, setDetail] = useState('');
  const [recipient, setRecipient] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const deadline = deadlinePresentation(inspection.plazoRespuestaAt);

  const eventCounts = useMemo(() => inspection.eventos.reduce((counts, event) => {
    counts.total += 1;
    if (event.visibleActor) counts.visible += 1;
    else counts.internal += 1;
    return counts;
  }, { total: 0, visible: 0, internal: 0 }), [inspection.eventos]);

  const submit = async () => {
    const titles = { COMENTARIO_INTERNO: 'Comentario de administración', NOTIFICACION_PREPARADA: 'Borrador de notificación' };
    await onAdd({ tipo: type, titulo: titles[type], detalle: detail, visibleActor: false, destinatario: recipient || null }, file);
    setDetail(''); setRecipient(''); setFile(undefined); setOpen(false);
  };

  return (
    <aside className="overflow-hidden rounded-2xl border border-neutral-200 bg-white" aria-labelledby="inspection-timeline-title">
      <div className="border-b border-neutral-200 px-4 py-5 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary-700"><Workflow size={15} aria-hidden="true" />Registro operativo y auditoría</p>
            <h3 id="inspection-timeline-title" className="mt-1 text-lg font-extrabold text-[#10213A]">Historial del expediente</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">Eventos del sistema, cambios de estado y notas internas. Las presentaciones formales se gestionan en su instancia específica.</p>
          </div>
          {canComment && <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="shrink-0 rounded-lg border border-primary-700 px-3 py-2 text-xs font-bold text-primary-800 transition-colors hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2">{open ? 'Cancelar' : 'Agregar nota'}</button>}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-lg bg-primary-50 px-3 py-2"><span className="font-extrabold text-primary-800">{eventCounts.total}</span><span className="ml-1 text-primary-800">Eventos</span></div>
          <div className="rounded-lg bg-blue-50 px-3 py-2"><span className="font-extrabold text-blue-800">{eventCounts.visible}</span><span className="ml-1 text-blue-800">Visibles</span></div>
          <div className="col-span-2 rounded-lg bg-neutral-100 px-3 py-2 sm:col-span-1"><span className="font-extrabold text-neutral-700">{eventCounts.internal}</span><span className="ml-1 text-neutral-600">Internos</span></div>
        </div>

        {deadline && <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs ${deadline.expired ? 'border-error-200 bg-error-50 text-error-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span><strong>Plazo del expediente:</strong> {deadline.label}{deadline.expired ? ' · vencido' : ' · vigente'}</span></div>}
      </div>

      {open && <div className="space-y-3 border-b border-neutral-200 bg-neutral-50 p-4 sm:p-5">
        <div>
          <label htmlFor="inspection-event-type" className="mb-1.5 block text-xs font-bold text-neutral-700">Tipo de registro</label>
          <select id="inspection-event-type" value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100"><option value="COMENTARIO_INTERNO">Nota interna</option><option value="NOTIFICACION_PREPARADA">Borrador de notificación no enviada</option></select>
        </div>
        {type === 'NOTIFICACION_PREPARADA' && <div><label htmlFor="inspection-event-recipient" className="mb-1.5 block text-xs font-bold text-neutral-700">Destinatario (registro interno)</label><input id="inspection-event-recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Correo o identificación del destinatario" className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100" /></div>}
        <div>
          <label htmlFor="inspection-event-detail" className="mb-1.5 block text-xs font-bold text-neutral-700">Detalle del registro</label>
          <textarea id="inspection-event-detail" value={detail} onChange={(event) => setDetail(event.target.value)} rows={4} placeholder="Nota operativa, contexto o constancia interna…" className="w-full rounded-xl border border-neutral-300 p-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" leftIcon={<Paperclip size={15} />} onClick={() => fileRef.current?.click()}>{file ? file.name : 'Adjuntar documento'}</Button>
          <Button size="sm" leftIcon={<Send size={15} />} onClick={submit} disabled={!detail.trim()} isLoading={busy}>Registrar nota</Button>
        </div>
        <label htmlFor="inspection-event-file" className="sr-only">Adjunto del registro</label>
        <input id="inspection-event-file" ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0])} />
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-amber-900"><MailWarning size={15} className="mt-0.5 shrink-0" aria-hidden="true" />No se envió ninguna comunicación externa. Las notificaciones preparadas quedan registradas como borrador documental.</p>
      </div>}

      <div className="px-4 py-5 sm:px-5">
        {inspection.eventos.length === 0 ? <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-7 text-center"><MessageSquareText className="mx-auto text-neutral-400" size={23} aria-hidden="true" /><p className="mt-2 text-sm font-semibold text-neutral-700">Sin actuaciones registradas</p><p className="mt-1 text-xs text-neutral-500">El circuito mostrará requerimientos, respuestas y decisiones en orden cronológico.</p></div> : <ol className="space-y-3" aria-label="Actuaciones del expediente">{inspection.eventos.map((event, index) => {
          const presentation = eventPresentation(event);
          return <li key={event.id} className={`rounded-xl border border-neutral-200 border-l-4 bg-white p-3.5 shadow-sm ${presentation.accent}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${presentation.party === 'INSPECCIONADO' ? 'bg-blue-50 text-blue-800' : presentation.party === 'INTERNO' ? 'bg-neutral-100 text-neutral-700' : 'bg-primary-50 text-primary-800'}`}>{presentation.icon}{presentation.partyLabel}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{presentation.kindLabel}</span>
              <span className="ml-auto font-mono text-[10px] text-neutral-400">#{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h4 className="mt-2.5 text-sm font-extrabold leading-snug text-[#10213A]">{event.titulo}</h4>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-neutral-500"><Clock3 size={12} aria-hidden="true" />{new Date(event.createdAt).toLocaleString('es-AR')}<span aria-hidden="true">·</span>{event.usuario.nombre} {event.usuario.apellido || ''}</p>
            {event.estadoDesde && event.estadoHasta && <p className="mt-2 rounded-lg bg-neutral-50 px-2.5 py-2 text-xs font-semibold text-neutral-700">Estado: {event.estadoDesde.replaceAll('_', ' ')} <span aria-hidden="true">→</span> {event.estadoHasta.replaceAll('_', ' ')}</p>}
            {event.detalle && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700">{event.detalle}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
              {event.visibleActor ? <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">Visible al inspeccionado</span> : <span className="rounded-full bg-neutral-100 px-2 py-1 text-neutral-600">Uso interno</span>}
            </div>
            {event.canal === 'EMAIL' && <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-900"><MailWarning size={15} className="mt-0.5 shrink-0" aria-hidden="true" /><span><strong>Correo {event.estadoEntrega === 'NO_ENVIADO' ? 'no enviado' : event.estadoEntrega || 'sin estado'}</strong>{event.destinatario ? ` · Destinatario registrado: ${event.destinatario}` : ''}<span className="mt-0.5 block text-[11px] font-normal">No se envió ninguna comunicación externa.</span></span></div>}
            {event.tipo === 'RESPUESTA_ACTOR' && <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-blue-700"><UserRound size={14} aria-hidden="true" />Respuesta incorporada por el inspeccionado</div>}
            {event.tipo === 'COMENTARIO_INTERNO' && <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-neutral-500"><MessageSquareText size={14} aria-hidden="true" />No integra la comunicación al inspeccionado</div>}
            {Boolean(event.adjuntos?.length) && <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-2.5"><p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Adjuntos ({event.adjuntos?.length})</p>{event.adjuntos?.map((attachment) => <div key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-semibold text-neutral-700"><FileText size={15} className="shrink-0 text-neutral-500" aria-hidden="true" /><span className="truncate">{attachment.nombreOriginal}</span></div>)}</div>}
          </li>;
        })}</ol>}
      </div>
    </aside>
  );
}
