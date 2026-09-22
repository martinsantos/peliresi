import React, { useRef, useState } from 'react';
import { Clock3, FileText, MailWarning, MessageSquareText, Paperclip, Send, UserRound } from 'lucide-react';
import type { Inspection, InspectionEvent } from '../../types/inspection';
import { Button } from '../../components/ui/ButtonV2';

function dotColor(event: InspectionEvent) {
  if (event.estadoEntrega === 'NO_ENVIADO') return 'bg-amber-500';
  if (event.tipo === 'RESPUESTA_ACTOR') return 'bg-blue-600';
  if (event.tipo === 'COMENTARIO_INTERNO') return 'bg-slate-500';
  return 'bg-primary-600';
}

export function InspectionTimeline({ inspection, canComment, busy, onAdd }: {
  inspection: Inspection;
  canComment: boolean;
  busy: boolean;
  onAdd: (input: { tipo: 'COMENTARIO_INTERNO' | 'SOLICITUD_CORRECCION' | 'RESPUESTA_ACTOR' | 'NOTIFICACION_PREPARADA'; titulo: string; detalle: string; visibleActor: boolean; destinatario?: string | null }, file?: File) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'COMENTARIO_INTERNO' | 'SOLICITUD_CORRECCION' | 'RESPUESTA_ACTOR' | 'NOTIFICACION_PREPARADA'>('COMENTARIO_INTERNO');
  const [detail, setDetail] = useState('');
  const [recipient, setRecipient] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    const titles = { COMENTARIO_INTERNO: 'Comentario de administración', SOLICITUD_CORRECCION: 'Solicitud de corrección', RESPUESTA_ACTOR: 'Respuesta del actor', NOTIFICACION_PREPARADA: 'Notificación preparada' };
    await onAdd({ tipo: type, titulo: titles[type], detalle: detail, visibleActor: type !== 'COMENTARIO_INTERNO', destinatario: recipient || null }, file);
    setDetail(''); setRecipient(''); setFile(undefined); setOpen(false);
  };

  return (
    <aside className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-5"><div><h3 className="text-lg font-extrabold text-[#10213A]">Trazabilidad</h3><p className="mt-1 text-xs text-neutral-500">Historia completa del expediente</p></div>{canComment && <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-lg border border-primary-700 px-3 py-2 text-xs font-bold text-primary-800">{open ? 'Cancelar' : 'Agregar'}</button>}</div>
      {open && <div className="space-y-3 border-b border-neutral-200 bg-neutral-50 p-4"><select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm font-semibold"><option value="COMENTARIO_INTERNO">Comentario interno</option><option value="SOLICITUD_CORRECCION">Solicitud de corrección</option><option value="RESPUESTA_ACTOR">Respuesta del actor</option><option value="NOTIFICACION_PREPARADA">Preparar correo sin enviarlo</option></select>{type === 'NOTIFICACION_PREPARADA' && <input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="Destinatario (sólo registro, no se envía)" className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" />}<textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={4} placeholder="Detalle, observación o respuesta…" className="w-full rounded-xl border border-neutral-300 p-3 text-sm" /><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" leftIcon={<Paperclip size={15} />} onClick={() => fileRef.current?.click()}>{file ? file.name : 'Adjuntar'}</Button><Button size="sm" leftIcon={<Send size={15} />} onClick={submit} disabled={!detail.trim()} isLoading={busy}>Registrar</Button></div><input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(event) => setFile(event.target.files?.[0])} /><p className="text-[11px] leading-relaxed text-amber-800">Los eventos de correo quedan marcados “No enviado”. Esta pantalla no despacha comunicaciones externas.</p></div>}
      <div className="px-4 py-5">
        {inspection.eventos.length === 0 ? <p className="text-sm text-neutral-500">Sin eventos registrados.</p> : inspection.eventos.map((event, index) => <div key={event.id} className="relative flex gap-3 pb-6 last:pb-0">{index < inspection.eventos.length - 1 && <span className="absolute left-[6px] top-4 h-full w-px bg-neutral-200" />}<span className={`relative mt-1.5 h-3 w-3 shrink-0 rounded-full ring-4 ring-white ${dotColor(event)}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-bold text-[#10213A]">{event.titulo}</p>{event.visibleActor && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-blue-700">Visible al actor</span>}</div><p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500"><Clock3 size={12} />{new Date(event.createdAt).toLocaleString('es-AR')} · {event.usuario.nombre} {event.usuario.apellido || ''}</p>{event.detalle && <p className="mt-2 text-xs leading-relaxed text-neutral-700">{event.detalle}</p>}{event.canal === 'EMAIL' && <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-900"><MailWarning size={15} className="mt-0.5 shrink-0" /><span>Correo {event.estadoEntrega === 'NO_ENVIADO' ? 'no enviado' : event.estadoEntrega || 'sin estado'}{event.destinatario ? ` · ${event.destinatario}` : ''}</span></div>}{event.tipo === 'RESPUESTA_ACTOR' && <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-blue-700"><UserRound size={14} />Respuesta registrada del interesado</div>}{event.tipo === 'COMENTARIO_INTERNO' && <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-neutral-500"><MessageSquareText size={14} />Nota interna</div>}{event.adjuntos?.map((file) => <div key={file.id} className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-200 px-2.5 py-2 text-xs font-semibold text-neutral-700"><FileText size={15} />{file.nombreOriginal}</div>)}</div></div>)}
      </div>
    </aside>
  );
}
