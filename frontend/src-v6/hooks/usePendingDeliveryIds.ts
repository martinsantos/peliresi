import { useEffect, useState } from 'react';
import { getSyncQueue } from '../services/indexeddb';
import { subscribeOfflineQueueChanged } from '../services/offlineSyncEvents';
import { queuedDeliveryManifestId } from '../services/syncQueuePolicy';
import { useQueryOwner } from './useQueryOwner';

type State = { owner: string; ids: Set<string>; checking: boolean; error: boolean };

/** Only IDs already shown by an authorized server query are used by callers. */
export function usePendingDeliveryIds(enabled = true) {
  const owner = useQueryOwner();
  const [state, setState] = useState<State>({ owner: '', ids: new Set(), checking: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!owner || !enabled) return;
    let active = true, generation = 0;
    const read = () => {
      const version = ++generation;
      void getSyncQueue().then(actions => {
        if (!active || version !== generation) return;
        const ids = new Set(actions.filter(action => action.type === 'POST')
          .map(action => queuedDeliveryManifestId(action.endpoint)).filter((id): id is string => !!id));
        setState({ owner, ids, checking: false, error: false });
      }).catch(() => { if (active && version === generation) setState({ owner, ids: new Set(), checking: false, error: true }); });
    };
    read();
    const unsubscribe = subscribeOfflineQueueChanged(read);
    window.addEventListener('focus', read);
    const interval = window.setInterval(read, 15_000);
    return () => { active = false; window.clearInterval(interval); unsubscribe(); window.removeEventListener('focus', read); };
  }, [owner, retry, enabled]);
  if (!enabled) return { ids: new Set<string>(), checking: false, error: false, retry: () => {} };
  const ready = state.owner === owner && !!owner;
  return { ids: ready ? state.ids : new Set<string>(), checking: !ready || state.checking, error: ready && state.error,
    retry: () => setRetry(value => value + 1) };
}
