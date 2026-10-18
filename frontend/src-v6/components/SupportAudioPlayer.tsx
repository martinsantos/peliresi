import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { Button } from './ui/ButtonV2';
import { supportError, supportService } from '../services/support.service';
import { assertSupportSession } from '../utils/supportSession';
import type { SupportFile } from '../types/support';

export function SupportAudioPlayer({ ticketId, file, owner }: { ticketId: string; file: SupportFile; owner: string }) {
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = useRef(true);
  const inFlight = useRef(false);
  const url = useRef('');
  useEffect(() => { active.current = true; return () => { active.current = false; if (url.current) URL.revokeObjectURL(url.current); }; }, []);
  const load = async () => {
    if (inFlight.current || src) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      assertSupportSession(owner);
      const blob = await supportService.download(ticketId, file.id);
      if (!active.current) return;
      assertSupportSession(owner);
      if (!blob.size || !blob.type.startsWith('audio/')) throw new Error('invalid-audio');
      url.current = URL.createObjectURL(blob); setSrc(url.current);
    } catch (failure) { if (active.current) setError(supportError(failure)); }
    finally { inFlight.current = false; if (active.current) setBusy(false); }
  };
  return <div className="min-w-0 space-y-2">
    {src ? <audio controls preload="metadata" src={src} aria-label={'Audio del ticket: ' + file.nombre} className="w-full max-w-full" onError={() => setError('No pudimos reproducir este audio. Podés descargarlo para escucharlo.')} />
      : <Button type="button" variant="outline" leftIcon={<Play size={16} />} isLoading={busy} onClick={() => void load()}>Escuchar audio</Button>}
    {error && <p role="alert" className="text-sm text-error-700">{error}</p>}
  </div>;
}
