import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, X } from 'lucide-react';
import { startLocalDictation, type DictationSession } from '../../services/localDictation';

type Phase = 'idle' | 'preparing' | 'listening' | 'stopping';

/** Microphone waveform and streaming local transcription; no audio attachment. */
export function OfflineDictation({ onText, onActiveChange, disabled = false, active = true, buttonLabel = 'Dictar', compact = false }: { onText: (text: string) => void; onActiveChange?: (active: boolean) => void; disabled?: boolean; active?: boolean; buttonLabel?: string; compact?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState('');
  const [partial, setPartial] = useState('');
  const [seconds, setSeconds] = useState(0);
  const session = useRef<DictationSession | null>(null);
  const controller = useRef<AbortController | null>(null);
  const callbacks = useRef({ onText, onActiveChange });
  useLayoutEffect(() => { callbacks.current = { onText, onActiveChange }; }, [onText, onActiveChange]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const level = useRef(0);
  const received = useRef(false);
  const mounted = useRef(true);
  const stop = useCallback(async () => {
    if (!controller.current || !session.current) return;
    setPhase('stopping');
    const current = session.current;
    await current.stop();
    if (session.current !== current) return;
    session.current = null; controller.current = null;
    callbacks.current.onActiveChange?.(false);
    if (mounted.current) { setPhase('idle'); setPartial(''); setMessage(received.current ? 'Texto incorporado. Revisá nombres, números y términos técnicos.' : 'No se reconocieron palabras. Revisá el permiso del micrófono y acercate para volver a dictar.'); }
  }, []);
  const cancel = useCallback(() => {
    controller.current?.abort(); controller.current = null;
    session.current?.cancel(); session.current = null;
    callbacks.current.onActiveChange?.(false);
    if (mounted.current) { setPhase('idle'); setPartial(''); setMessage('Dictado cancelado. El texto ya incorporado se conserva.'); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.visibilityState === 'hidden') { if (session.current) void stop(); else if (controller.current) cancel(); } };
    document.addEventListener('visibilitychange', hidden);
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', hidden); cancel(); };
  }, [cancel, stop]);
  // Stop the external microphone session when its field is no longer editable.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!active || disabled) { if (session.current) void stop(); else if (controller.current) cancel(); } }, [active, disabled, stop, cancel]);
  useEffect(() => {
    if (phase !== 'listening') return;
    const started = Date.now();
    const bars: number[] = Array(42).fill(0);
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - started) / 1000);
      setSeconds(elapsed);
      if (elapsed >= 120) { void stop(); return; }
      const element = canvas.current;
      const drawing = element?.getContext('2d');
      if (!element || !drawing) return;
      bars.shift(); bars.push(level.current);
      element.dataset.level = String(level.current);
      drawing.clearRect(0, 0, 252, 44);
      drawing.fillStyle = '#0D8A4F';
      bars.forEach((value, index) => { const height = Math.max(2, value * 40); drawing.fillRect(index * 6, (44 - height) / 2, 3, height); });
    }, 100);
    return () => clearInterval(timer);
  }, [phase, stop]);
  const start = async () => {
    if (controller.current || disabled || !active) return;
    const abort = new AbortController(); controller.current = abort;
    received.current = false; level.current = 0; setSeconds(0); setPartial(''); setMessage('');
    setPhase('preparing'); callbacks.current.onActiveChange?.(true);
    try {
      const value = await startLocalDictation({
        onPhase: value => { if (mounted.current && !abort.signal.aborted) setPhase(value); },
        onText: text => { if (!abort.signal.aborted) { received.current = true; callbacks.current.onText(text); } },
        onPartial: text => { if (mounted.current && !abort.signal.aborted) setPartial(text); },
        onLevel: value => { level.current = value; },
        onError: error => { if (mounted.current && !abort.signal.aborted) { session.current = null; controller.current = null; callbacks.current.onActiveChange?.(false); setPhase('idle'); setMessage(error.message); } },
      }, abort.signal);
      if (abort.signal.aborted) { value.cancel(); return; }
      session.current = value;
    } catch (error) {
      if (abort.signal.aborted || !mounted.current) return;
      controller.current = null; session.current = null; callbacks.current.onActiveChange?.(false); setPhase('idle');
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      setMessage(denied ? 'Micrófono bloqueado. Habilitalo en los permisos de este sitio y volvé a tocar Dictar.' : error instanceof Error ? error.message : 'No se pudo iniciar el micrófono. Podés reintentar sin perder el texto.');
    }
  };
  return <div className="min-w-0 text-sm" data-testid="offline-dictation">
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <button type="button" onClick={() => phase === 'listening' ? void stop() : void start()} disabled={disabled || !active || phase === 'preparing' || phase === 'stopping'} className={`inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg border-2 px-4 font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2 disabled:opacity-60 ${phase === 'listening' ? 'border-error-700 bg-error-50 text-error-900' : 'border-primary-700 bg-primary-50 text-primary-900 hover:bg-primary-100'}`}>
        {phase === 'listening' ? <Square size={16} /> : phase === 'preparing' || phase === 'stopping' ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}
        {phase === 'listening' ? 'Detener dictado' : phase === 'preparing' ? 'Preparando voz…' : phase === 'stopping' ? 'Terminando…' : buttonLabel}
      </button>
      {phase === 'preparing' && <button type="button" onClick={cancel} aria-label="Cancelar preparación del dictado" className="min-h-11 rounded-lg px-2 text-neutral-600 hover:bg-neutral-100"><X size={18} /></button>}
      {phase === 'listening' && <div className="flex min-w-0 flex-1 items-center gap-2" role="status" aria-label="Micrófono activo">
        <canvas ref={canvas} width={252} height={44} aria-label="Nivel de sonido del micrófono" className="h-11 min-w-0 max-w-[252px] flex-1" />
        <span className="shrink-0 font-mono tabular-nums text-neutral-600">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
      </div>}
      {phase === 'idle' && !message && !compact && <span className="text-xs text-neutral-500">Voz a texto · en este dispositivo</span>}
    </div>
    {phase === 'preparing' && <p role="status" className="mt-2 text-neutral-600">La primera vez se descarga el español (~40 MB). Después funciona sin señal. El audio no se envía.</p>}
    {phase === 'listening' && <p className="mt-2 text-neutral-600">Hablá con naturalidad. El texto se incorpora al campo mientras dictás.</p>}
    {partial && <p aria-live="polite" className="mt-2 break-words border-l-2 border-primary-400 pl-3 text-neutral-600">{partial}</p>}
    {message && <p role="status" className="mt-2 text-neutral-600">{message}</p>}
  </div>;
}
