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

export function useActiveTripRecovery() {
  const { currentUser, isTransportista } = useAuth();

  useEffect(() => {
    if (!isTransportista || !currentUser) return;

    // Only recover if there's no active trip in localStorage already
    const existingTripId = localStorage.getItem('sitrep_active_trip_id');
    if (existingTripId) return;

    let cancelled = false;

    const recover = async () => {
      try {
        const res = await manifiestoService.list({ estado: 'EN_TRANSITO' as any, limit: 1 });
        if (cancelled) return;

        const manifiestos = res?.items || [];
        if (manifiestos.length > 0) {
          const trip = manifiestos[0];
          const tripId = String(trip.id);
          localStorage.setItem('sitrep_active_trip_id', tripId);
          localStorage.setItem(`viaje_snapshot_${tripId}`, JSON.stringify({
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
