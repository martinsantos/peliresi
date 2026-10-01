import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { Link, useLocation } from 'react-router-dom';
import { hasInspectionCoordinates, operationSubject, type InspectionOperation } from '../../services/inspectionOperations.service';
import { ACTOR_ICONS } from '../../utils/map-icons';
import { inspectionDate, INSPECTION_STATE_LABELS } from './inspectionPresentation';

/** Places of inspection, never inferred positions of inspectors. */
export function InspectionMapLayer({ items, onSelect }: { items: InspectionOperation[]; onSelect?: (id: string) => void }) {
  const location = useLocation();
  const prefix = location.pathname.startsWith('/mobile') ? '/mobile' : '';
  return <>{items.filter(hasInspectionCoordinates).map((row) => <Marker key={`inspection-${row.id}`} position={[row.latitud!, row.longitud!]} icon={ACTOR_ICONS.inspeccion} title={`Inspección ${row.numero}`} alt={`Inspección ${row.numero}`} eventHandlers={{ click: () => onSelect?.(row.id) }}>
    <Popup><div className="text-sm"><strong>Inspección · {row.numero}</strong><p>{operationSubject(row)}</p><p>{INSPECTION_STATE_LABELS[row.estado]} · {row.estado === 'PLANIFICADA' ? 'Lugar previsto' : 'Lugar registrado'}</p><p>{row.ubicacion || 'Sin referencia escrita'}</p><p>Actualizado: {inspectionDate(row.updatedAt, true)}</p><Link to={`${prefix}/inspecciones/${row.id}`}>Abrir expediente</Link></div></Popup>
  </Marker>)}</>;
}
