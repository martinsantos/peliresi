/**
 * useActiveTripRecovery
 * =====================
 * After a TRANSPORTISTA logs in, checks API for any EN_TRANSITO manifiestos
 * and restores the active trip to localStorage.
 * This ensures trip persistence across app reinstalls and crashes.
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import { EstadoManifiesto } from '../types/models';
import {
  activeTripStorageKey,
  gpsPendingStorageKey,
  tripSnapshotStorageKey,
  tripStatusStorageKey,
} from '../utils/userContext';

export function useActiveTripRecovery() {
  const { currentUser, isTransportista } = useAuth();

  useEffect(() => {
    if (!isTransportista || !currentUser) return;

    // Only recover if there's no active trip in localStorage already
    const activeTripKey = activeTripStorageKey(currentUser.id);
    const existingTripId = localStorage.getItem(activeTripKey);
    if (existingTripId) return;

    let cancelled = false;

    const recover = async () => {
      try {
        const res = await manifiestoService.list({ estado: EstadoManifiesto.EN_TRANSITO, limit: 1 });
        if (cancelled) return;

        const manifiestos = res?.items || [];
        if (manifiestos.length > 0) {
          const trip = manifiestos[0];
          const tripId = String(trip.id);
          // Safely adopt legacy context only after the API proves that the
          // trip belongs to the currently authenticated transportista.
          if (localStorage.getItem('sitrep_active_trip_id') === tripId) {
            const legacyPairs = [
              [`viaje_snapshot_${tripId}`, tripSnapshotStorageKey(currentUser.id, tripId)],
              [`viaje_status_${tripId}`, tripStatusStorageKey(currentUser.id, tripId)],
              [`gps_pending_${tripId}`, gpsPendingStorageKey(currentUser.id, tripId)],
            ] as const;
            for (const [legacyKey, scopedKey] of legacyPairs) {
              const legacyValue = localStorage.getItem(legacyKey);
              if (legacyValue != null && localStorage.getItem(scopedKey) == null) {
                localStorage.setItem(scopedKey, legacyValue);
              }
              localStorage.removeItem(legacyKey);
            }
            localStorage.removeItem('sitrep_active_trip_id');
          }
          localStorage.setItem(activeTripKey, tripId);
          localStorage.setItem(tripSnapshotStorageKey(currentUser.id, tripId), JSON.stringify({
            id: trip.id,
            numero: trip.numero,
            estado: trip.estado,
            generador: trip.generador?.razonSocial,
            operador: trip.operador?.razonSocial,
          }));
        }
      } catch {
        // Silent fail — if API is offline, we can't recover
      }
    };

    recover();
    return () => { cancelled = true; };
  }, [isTransportista, currentUser?.id]);
}
