import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import { SUPPORT_AUDIO_LIMIT, SUPPORT_AUDIO_SECONDS, recordingMime } from '../utils/supportAudio';
function AudioPreview({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <audio controls preload="metadata" src={url} aria-label="Escuchar audio antes de enviarlo" className="w-full max-w-full" />;
}

/** Short voice attachment, not speech recognition. No provider, background
 * recording or persistent audio draft. Tracks/timers die on cancel/unmount. */
export function SupportAudioInput({ value, onChange, onBusyChange, disabled = false }: {
  value: File | null; onChange: (value: File | null) => void; onBusyChange: (busy: boolean) => void; disabled?: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording' | 'stopping'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const alive = useRef(true);
  const acquiring = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const cancelled = useRef(false);
  const release = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = undefined;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
  }, []);
  useEffect(() => { alive.current = true; return () => {
    alive.current = false; cancelled.current = true;
    if (recorder.current) {
      recorder.current.ondataavailable = null; recorder.current.onstop = null; recorder.current.onerror = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    release();
  }; }, [release]);
  const finish = (discard = false) => {
    if (!recorder.current || recorder.current.state === 'inactive') return;
    cancelled.current = discard; setPhase('stopping'); recorder.current.stop(); release();
  };
  const start = async () => {
    if (acquiring.current || disabled || phase !== 'idle') return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setError('Este navegador no permite grabar. Podés escribir o adjuntar un audio existente.'); return; }
    const mime = recordingMime(MediaRecorder);
    if (!mime) { setError('Este navegador no ofrece un formato de audio compatible. Podés escribir o adjuntar un audio.'); return; }
    acquiring.current = true; setPhase('requesting'); onBusyChange(true);
    try {
      const acquired = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!alive.current) { acquired.getTracks().forEach(track => track.stop()); return; }
      stream.current = acquired; cancelled.current = false;
      const instance = new MediaRecorder(acquired, { mimeType: mime, audioBitsPerSecond: 64000 });
      recorder.current = instance;
      const chunks: Blob[] = []; let bytes = 0;
      instance.ondataavailable = event => {
        bytes += event.data.size;
        if (bytes > SUPPORT_AUDIO_LIMIT) { cancelled.current = true; setError('El audio superó 5 MB. Grabá uno más corto.'); finish(true); return; }
        chunks.push(event.data);
      };
      instance.onstop = () => {
        release(); recorder.current = null;
        if (!alive.current) return;
        setPhase('idle'); onBusyChange(false);
        if (cancelled.current) return;
        const blob = new Blob(chunks, { type: instance.mimeType });
        if (!blob.size) { setError('No se obtuvo audio. Revisá el micrófono y volvé a grabar.'); return; }
        const extension = instance.mimeType.includes('mp4') ? 'm4a' : instance.mimeType.includes('ogg') ? 'ogg' : 'webm';
        onChange(new File([blob], 'audio-' + crypto.randomUUID() + '.' + extension, { type: blob.type }));
      };
      instance.onerror = () => { cancelled.current = true; release(); if (instance.state !== 'inactive') instance.stop(); if (alive.current) { setError('La grabación se interrumpió. Tu texto sigue disponible.'); setPhase('idle'); onBusyChange(false); } };
      instance.start(1000); setSeconds(0); setPhase('recording');
      const began = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - began) / 1000); setSeconds(elapsed);
        if (elapsed >= SUPPORT_AUDIO_SECONDS) finish();
      }, 500);
    } catch (failure) {
      release(); if (alive.current) { setPhase('idle'); onBusyChange(false); setError((failure as { name?: string }).name === 'NotAllowedError'
        ? 'No se habilitó el micrófono. Podés escribir o permitirlo y volver a grabar.' : 'No pudimos abrir el micrófono. Podés continuar con texto.'); }
    } finally { acquiring.current = false; }
  };
  return <div className="min-w-0 space-y-3" role="group" aria-label="Audio opcional">
    <div className="flex flex-wrap items-center gap-2">
      {phase === 'idle' ? <Button type="button" variant="outline" leftIcon={<Mic size={18} />} disabled={disabled} onClick={() => void start()}>{value ? 'Volver a grabar audio' : 'Grabar audio'}</Button>
        : <><Button type="button" variant="primary" leftIcon={<Square size={18} />} disabled={phase !== 'recording'} onClick={() => finish()}>Terminar grabación</Button>
          <Button type="button" variant="outline" disabled={phase !== 'recording'} onClick={() => finish(true)}>Cancelar grabación</Button>
          <span role="status" className="font-mono text-sm text-neutral-900">{phase === 'requesting' ? 'Esperando permiso del micrófono…' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</span></>}
    </div>
    {value && <div className="space-y-2"><AudioPreview key={value.name + value.lastModified} file={value} />
      <Button type="button" variant="outline" leftIcon={<X size={16} />} disabled={disabled || phase !== 'idle'} onClick={() => onChange(null)}>Quitar audio</Button></div>}
    <p className="text-sm text-neutral-600">Opcional · hasta 2 minutos. Escuchalo antes de enviar. No se guarda al cerrar el formulario.</p>
    {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
  </div>;
}
