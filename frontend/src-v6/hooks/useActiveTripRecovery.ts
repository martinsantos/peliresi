/**
 * useActiveTripRecovery
 * =====================
 * Restore the shortcut only when the carrier has exactly one active trip.
 * With multiple trips, the driver chooses a manifest from the trip queue.
 */

import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { manifiestoService } from '../services/manifiesto.service';
import { EstadoManifiesto } from '../types/models';
import { useQueryOwner } from './useQueryOwner';
import { readActiveTrip, readTripSnapshot, writeTripSnapshot } from '../services/tripSnapshot';

export function useActiveTripRecovery() {
  const { currentUser, isTransportista, isRestricted } = useAuth();
  const owner = useQueryOwner();

  useEffect(() => {
    if (!isTransportista || !currentUser || isRestricted || !owner) return;

    // Only recover if there's no active trip in localStorage already
    const existingTripId = readActiveTrip(owner);
    if (existingTripId) return;

    let cancelled = false;

    const recover = async () => {
      try {
        const res = await manifiestoService.list({ estado: EstadoManifiesto.EN_TRANSITO, limit: 2 });
        if (cancelled) return;

        const manifiestos = res?.items || [];
        if (manifiestos.length === 1 && res.total === 1) {
          const trip = manifiestos[0];
          const tripId = String(trip.id);
          // The open trip page may have saved a more complete, verified copy
          // while this background list request was in flight.
          if (readActiveTrip(owner) || readTripSnapshot(owner, tripId)) return;
          writeTripSnapshot(owner, tripId, {
            id: trip.id,
            numero: trip.numero,
            estado: trip.estado,
            generador: trip.generador ? { razonSocial: trip.generador.razonSocial } : undefined,
            operador: trip.operador ? { razonSocial: trip.operador.razonSocial } : undefined,
          });
        }
      } catch {
        // Silent fail — if API is offline, we can't recover
      }
    };

    recover();
    return () => { cancelled = true; };
  }, [isTransportista, currentUser?.id, isRestricted, owner]);
}
