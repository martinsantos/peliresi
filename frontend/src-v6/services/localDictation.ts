import type { Model, KaldiRecognizer } from 'vosk-browser';
import captureUrl from './dictationCapture.worklet?worker&url';

const modelUrl = new URL(import.meta.env.BASE_URL + 'voice/vosk-small-es-0.42.tar.gz', location.origin).href;
let modelPromise: Promise<Model> | undefined;
let loadedModel: Model | undefined;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
let owner: symbol | undefined;

export interface DictationEvents {
  onPhase: (phase: 'preparing' | 'listening' | 'stopping') => void;
  onText: (text: string) => void;
  onPartial: (text: string) => void;
  onLevel: (level: number) => void;
  onError: (error: Error) => void;
}
export interface DictationSession { stop: () => Promise<void>; cancel: () => void }

function loadModel(): Promise<Model> {
  if (!modelPromise) modelPromise = import('vosk-browser').then(({ Model }) => new Promise<Model>((resolve, reject) => {
    const model = new Model(modelUrl, -1);
    const timer = setTimeout(() => fail(new Error('No se pudo preparar la voz local. Revisá la conexión y el espacio del dispositivo; después reintentá.')), 90_000);
    const fail = (error: Error) => { clearTimeout(timer); model.terminate(); modelPromise = undefined; reject(error); };
    model.on('load', message => {
      if (!('result' in message) || !message.result) return fail(new Error('No se pudo abrir el modelo de voz.'));
      clearTimeout(timer); loadedModel = model; resolve(model);
    });
    model.on('error', () => fail(new Error('No se pudo cargar el español local. Conectate una vez para prepararlo y verificá que el almacenamiento esté habilitado.')));
  })).catch(error => { modelPromise = undefined; throw error; });
  return modelPromise;
}

/** Real PCM -> local WASM worker -> editable text. Audio never leaves memory. */
export async function startLocalDictation(events: DictationEvents, signal: AbortSignal): Promise<DictationSession> {
  if (owner) throw new Error('Ya hay otro dictado en curso. Detenelo antes de abrir este micrófono.');
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) throw new Error('El micrófono requiere HTTPS y un navegador actualizado.');
  const token = Symbol(); owner = token;
  clearTimeout(releaseTimer);
  // Construct/resume during the tap, before awaits (required by mobile Safari).
  let context: AudioContext;
  try { context = new AudioContext(); } catch (error) { owner = undefined; throw error; }
  void context.resume().catch(() => undefined);
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let capture: AudioWorkletNode | undefined;
  let muted: GainNode | undefined;
  let recognizer: KaldiRecognizer | undefined;
  let closed = false;
  let stopping: Promise<void> | undefined;
  let acknowledgeStop: (() => void) | undefined;
  let finalResult: (() => void) | undefined;
  let pendingChunks = 0;
  let drained: (() => void) | undefined;
  const acknowledgeChunk = () => { pendingChunks = Math.max(0, pendingChunks - 1); if (!pendingChunks) drained?.(); };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener('abort', cleanup);
    stream?.getTracks().forEach(track => track.stop());
    source?.disconnect(); capture?.disconnect(); capture?.port.close(); muted?.disconnect();
    recognizer?.remove();
    void context.close().catch(() => undefined);
    if (owner === token) owner = undefined;
    // Release the large model when dictation is no longer being used.
    releaseTimer = setTimeout(() => { if (!owner) { loadedModel?.terminate(); loadedModel = undefined; modelPromise = undefined; } }, 60_000);
  };
  signal.addEventListener('abort', cleanup, { once: true });
  const check = () => { if (signal.aborted || closed) throw new DOMException('Dictado cancelado', 'AbortError'); };
  try {
    check();
    events.onPhase('preparing');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    if (closed || signal.aborted) { stream.getTracks().forEach(track => track.stop()); check(); }
    const model = await loadModel();
    check();
    await context.audioWorklet.addModule(captureUrl);
    check();
    recognizer = new model.KaldiRecognizer(context.sampleRate);
    recognizer.on('result', message => {
      if (closed || message.event !== 'result') return;
      acknowledgeChunk();
      if (message.result.text.trim()) events.onText(message.result.text.trim());
      events.onPartial('');
      finalResult?.();
    });
    recognizer.on('partialresult', message => {
      if (!closed && message.event === 'partialresult') { acknowledgeChunk(); events.onPartial(message.result.partial); }
    });
    recognizer.on('error', () => { if (!closed) { cleanup(); events.onError(new Error('Se interrumpió el reconocimiento. El texto incorporado se conserva.')); } });
    capture = new AudioWorkletNode(context, 'sitrep-dictation');
    capture.port.onmessage = ({ data }: MessageEvent<{ samples?: Float32Array; sampleRate?: number; stopped?: boolean }>) => {
      if (closed) return;
      if (data.samples) {
        let sum = 0;
        for (const value of data.samples) sum += value * value;
        events.onLevel(Math.min(1, Math.sqrt(sum / data.samples.length) * 5));
        pendingChunks++;
        recognizer?.acceptWaveformFloat(data.samples, data.sampleRate || context.sampleRate);
      }
      if (data.stopped) acknowledgeStop?.();
    };
    source = context.createMediaStreamSource(stream);
    muted = context.createGain(); muted.gain.value = 0;
    source.connect(capture); capture.connect(muted); muted.connect(context.destination);
    await context.resume();
    check();
    const stop = (): Promise<void> => {
      if (stopping) return stopping;
      if (closed) return Promise.resolve();
      events.onPhase('stopping');
      stopping = (async () => {
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 500);
          acknowledgeStop = () => { clearTimeout(timeout); resolve(); };
          capture?.port.postMessage('stop');
        });
        stream?.getTracks().forEach(track => track.stop());
        // Finish all submitted PCM before requesting the final fragment.
        // Otherwise a queued utterance could be mistaken for the final response.
        if (pendingChunks) await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 5_000);
          drained = () => { clearTimeout(timeout); resolve(); };
        });
        if (closed) return;
        await new Promise<void>(resolve => {
          const timeout = setTimeout(resolve, 5_000);
          finalResult = () => { clearTimeout(timeout); resolve(); };
          recognizer?.retrieveFinalResult();
        });
        cleanup();
      })();
      return stopping;
    };
    stream.getAudioTracks().forEach(track => track.addEventListener('ended', () => {
      if (!closed && !stopping) { void stop(); events.onError(new Error('El micrófono se desconectó. Revisá el texto y volvé a dictar.')); }
    }));
    events.onPhase('listening');
    return { stop, cancel: cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
