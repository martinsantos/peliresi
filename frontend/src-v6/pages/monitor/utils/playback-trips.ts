import type { EnTransitoItem } from '../api/monitor-api';
import type { TripState } from '../hooks/useTimeline';

/** A historical marker may be the place of pickup rather than a GPS point.
 * Never substitute the playback cursor for the actual reception timestamp. */
export function playbackTripList(trips: Map<string, TripState>): EnTransitoItem[] {
  return [...trips].map(([manifiestoId, trip]) => ({
    manifiestoId,
    numero: trip.numero || 'Manifiesto sin número',
    transportista: '',
    origen: { razonSocial: '', lat: null, lng: null },
    destino: { razonSocial: '', lat: null, lng: null },
    fechaRetiro: null,
    ultimaPosicion: trip.positionSource === 'gps' && trip.lastGpsReceivedAt ? {
      latitud: trip.lat,
      longitud: trip.lng,
      timestamp: trip.lastGpsReceivedAt,
    } : null,
    ruta: trip.trail.map(([lat, lng]) => ({ lat, lng, timestamp: '' })),
    esHistorial: true,
  }));
}
