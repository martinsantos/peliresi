import { DomEvent, divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useState, useRef } from 'react';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import { ACTOR_ICONS } from '../../utils/map-icons';
import type { InspectionFieldLocation } from '../../types/inspection';
import { areaSquareMeters, distanceMeters, MAP_MAX_DISTANCE_M, MAP_REFERENCE_LABELS, MAP_REFERENCE_TYPES, perimeterMeters, type MapPoint, type MapReference, type MapReferenceType } from '../../utils/inspectionMapGeometry';

type Mode = 'PUNTO' | 'SECTOR' | 'REFERENCIA';
const MAX_VERTICES = 40, MAX_REFERENCES = 20, GREEN = '#1B5E3C', BLUE = '#174a7e';
const MODE_HELP: Record<Mode, string> = {
  PUNTO: 'Tocá el mapa para ubicar el lugar inspeccionado.',
  SECTOR: 'Tocá en orden los vértices del sector observado (mínimo 3). Es un trazado aproximado, no el límite del predio.',
  REFERENCIA: 'Tocá el lugar de un vecino, curso de agua, uso sensible o ampliación. Después elegí el tipo y describilo debajo del mapa.',
};
const fmtMeters = (m: number) => m >= 1000 ? `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} km` : `${Math.round(m).toLocaleString('es-AR')} m`;
const fmtArea = (m2: number) => m2 >= 10000 ? `${(m2 / 10000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha` : `${Math.round(m2).toLocaleString('es-AR')} m²`;
const numberIcon = (n: number) => divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;border:3px solid ${BLUE};color:${BLUE};font:700 13px/1 sans-serif">${n}</span>` });
/** Any drawing change invalidates the saved picture: the act must never show an outdated sketch. */
const withoutPicture = (value: InspectionFieldLocation, patch: Partial<InspectionFieldLocation>): InspectionFieldLocation => {
  const { mapaImagen: _image, mapaZoom: _zoom, ...rest } = value; return { ...rest, ...patch };
};

function Drawing({ value, mode, disabled, onChange, onRejected }: { value?: InspectionFieldLocation; mode: Mode; disabled: boolean; onChange: (v: InspectionFieldLocation) => void; onRejected: (message: string) => void }) {
  const map = useMapEvents({ click: e => {
    if (disabled) return;
    const point: MapPoint = { latitud: e.latlng.lat, longitud: e.latlng.lng };
    if (mode === 'PUNTO' || !value) { onChange({ ...(value ? withoutPicture(value, {}) : {}), ...point, origen: 'MAPA', registradaAt: new Date().toISOString(), zoom: map.getZoom(), precisionMetros: undefined }); return; }
    if (distanceMeters(value, point) > MAP_MAX_DISTANCE_M) { onRejected('Ese lugar está a más de 10 km del punto inspeccionado. Acercá el mapa y volvé a tocar.'); return; }
    if (mode === 'SECTOR') { if ((value.perimetro?.length || 0) < MAX_VERTICES) onChange(withoutPicture(value, { perimetro: [...(value.perimetro || []), point] })); return; }
    if ((value.referencias?.length || 0) < MAX_REFERENCES) onChange(withoutPicture(value, { referencias: [...(value.referencias || []), { id: crypto.randomUUID(), tipo: 'VIVIENDA', etiqueta: '', ...point }] }));
  } });
  React.useEffect(() => { if (value) map.setView([value.latitud, value.longitud], value.zoom || map.getZoom()); }, [map, value?.latitud, value?.longitud]);
  React.useEffect(() => { const node = map.getContainer(); const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(node); return () => observer.disconnect(); }, [map]);
  if (!value) return null;
  const sector = (value.perimetro || []).map(p => [p.latitud, p.longitud] as [number, number]);
  return <>
    {sector.length >= 3 ? <Polygon positions={sector} pathOptions={{ color: GREEN, weight: 3, dashArray: '8 6', fillOpacity: 0.15 }} /> : sector.length === 2 ? <Polyline positions={sector} pathOptions={{ color: GREEN, weight: 3, dashArray: '8 6' }} /> : null}
    {sector.map((p, i) => <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: GREEN, fillColor: '#fff', fillOpacity: 1, weight: 2 }} />)}
    {(value.referencias || []).map((r, i) => <Marker key={`${r.id}:${r.tipo}:${r.etiqueta || ''}`} position={[r.latitud, r.longitud]} icon={numberIcon(i + 1)} title={`${i + 1}. ${r.etiqueta || MAP_REFERENCE_LABELS[r.tipo]}`} />)}
    <Marker position={[value.latitud, value.longitud]} icon={ACTOR_ICONS.inspeccion} title="Lugar registrado de la inspección" />
  </>;
}

/** Fit the point, sector and references in a 768×432 picture; zoom never goes beyond what the inspector looked at. */
function frame(map: ReturnType<typeof useMap>, value: InspectionFieldLocation, width: number, height: number) {
  const points: MapPoint[] = [value, ...(value.perimetro || []), ...(value.referencias || [])];
  for (let zoom = Math.min(19, Math.max(2, Math.round(map.getZoom()))); zoom >= 2; zoom--) {
    const xy = points.map(p => map.project([p.latitud, p.longitud], zoom));
    const minX = Math.min(...xy.map(p => p.x)), maxX = Math.max(...xy.map(p => p.x)), minY = Math.min(...xy.map(p => p.y)), maxY = Math.max(...xy.map(p => p.y));
    if (maxX - minX <= width - 80 && maxY - minY <= height - 100 || zoom === 2) return { zoom, left: (minX + maxX) / 2 - width / 2, top: (minY + maxY) / 2 - height / 2 + 8 };
  }
  throw new Error('frame');
}
function MapSnapshot({ value, disabled, onChange, onStatus }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void; onStatus: (s: string) => void }) {
  const control = useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (control.current) DomEvent.disableClickPropagation(control.current); }, []);
  const map = useMap(); const [busy, setBusy] = useState(false); const latest = useRef(value); latest.current = value;
  const capture = async () => {
    if (!value || busy) return; const original = value; setBusy(true); onStatus('Preparando mapa para el acta…');
    try {
      const width = 768, height = 432, { zoom, left, top } = frame(map, original, width, height);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error();
      const tasks: Array<Promise<void>> = [];
      for (let x = Math.floor(left / 256); x <= Math.floor((left + width) / 256); x++) for (let y = Math.floor(top / 256); y <= Math.floor((top + height) / 256); y++) {
        tasks.push(new Promise((resolve, reject) => {
          const img = new Image(); img.crossOrigin = 'anonymous'; const timer = setTimeout(() => { img.src = ''; reject(new Error('timeout')); }, 15000);
          img.onload = () => { clearTimeout(timer); ctx.drawImage(img, x * 256 - left, y * 256 - top); resolve(); };
          img.onerror = () => { clearTimeout(timer); reject(new Error('tile')); };
          img.src = `https://tile.openstreetmap.org/${zoom}/${((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom}/${Math.max(0, Math.min(2 ** zoom - 1, y))}.png`;
        }));
      }
      await Promise.all(tasks);
      const at = (p: MapPoint) => { const q = map.project([p.latitud, p.longitud], zoom); return [q.x - left, q.y - top] as const; };
      const sector = (original.perimetro || []).map(at);
      if (sector.length >= 2) {
        ctx.beginPath(); sector.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); if (sector.length >= 3) ctx.closePath();
        ctx.fillStyle = 'rgba(27,94,60,0.18)'; if (sector.length >= 3) ctx.fill(); ctx.setLineDash([10, 7]); ctx.lineWidth = 3; ctx.strokeStyle = GREEN; ctx.stroke(); ctx.setLineDash([]);
      }
      const [px, py] = at(original);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px, py, 12, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(px, py, 8, 0, 2 * Math.PI); ctx.fill();
      (original.referencias || []).forEach((r, i) => {
        const [x, y] = at(r); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, 13, 0, 2 * Math.PI); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = BLUE; ctx.stroke();
        ctx.fillStyle = BLUE; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x, y + 1); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
      });
      // North and a rounded scale bar: the picture must be readable without the live map.
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(width - 46, 10, 36, 44); ctx.fillStyle = '#163126'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('N', width - 28, 28);
      ctx.beginPath(); ctx.moveTo(width - 28, 34); ctx.lineTo(width - 35, 48); ctx.lineTo(width - 21, 48); ctx.closePath(); ctx.fill(); ctx.textAlign = 'start';
      const metersPerPixel = 156543.03392 * Math.cos(original.latitud * Math.PI / 180) / 2 ** zoom;
      const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000].find(m => m / metersPerPixel >= 70) || 10000, bar = nice / metersPerPixel;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(10, height - 62, bar + 70, 26); ctx.fillStyle = '#163126'; ctx.fillRect(18, height - 47, bar, 5); ctx.font = '13px sans-serif'; ctx.fillText(fmtMeters(nice), 26 + bar, height - 42);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, height - 28, width, 28); ctx.fillStyle = '#163126'; ctx.font = '13px sans-serif';
      ctx.fillText(`© OpenStreetMap contributors · Trazado aproximado del inspector · ${new Date().toLocaleDateString('es-AR')}`, 10, height - 9);
      if (latest.current !== original) { onStatus('El mapa cambió mientras se preparaba. Guardá nuevamente la vista.'); return; }
      onChange({ ...original, mapaImagen: canvas.toDataURL('image/png'), mapaZoom: zoom }); onStatus('Vista del mapa incorporada al borrador y al acta.');
    } catch { onStatus('No se pudo guardar el mapa. Revisá la conexión y reintentá; el punto y el trazado permanecen guardados.'); }
    finally { setBusy(false); }
  };
  return <div ref={control} className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto' }}><button type="button" disabled={disabled || !value || busy} onClick={e => { e.stopPropagation(); void capture(); }} onDoubleClick={e => e.stopPropagation()} className="m-2 min-h-11 rounded-lg border border-green-800 bg-white px-3 font-semibold text-green-900 disabled:opacity-50">{busy ? 'Preparando…' : 'Guardar vista para el acta'}</button></div>;
}

export default function InspectionLocationMap({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [mode, setMode] = useState<Mode>('PUNTO');
  const activeMode: Mode = value ? mode : 'PUNTO';
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Este dispositivo no ofrece GPS. Marcá el lugar en el mapa.'); return; }
    setBusy(true); setMessage('Buscando ubicación…');
    navigator.geolocation.getCurrentPosition(p => { onChange({ ...(value ? withoutPicture(value, {}) : {}), latitud: p.coords.latitude, longitud: p.coords.longitude, precisionMetros: p.coords.accuracy, origen: 'GPS', registradaAt: new Date().toISOString(), zoom: 17 }); setBusy(false); setMessage('Ubicación obtenida. Revisá que el punto corresponda al lugar inspeccionado.'); }, () => { setBusy(false); setMessage('No se pudo obtener el GPS. Podés marcar el mapa o ingresar coordenadas.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const sector = value?.perimetro || [], references = value?.referencias || [];
  const drawn = sector.length > 0 || references.length > 0;
  const setReference = (id: string, patch: Partial<MapReference>) => value && onChange(withoutPicture(value, { referencias: references.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const setSector = (next: MapPoint[]) => value && onChange(withoutPicture(value, { perimetro: next.length ? next : undefined }));
  return <div className="space-y-3">
    {!disabled && <div role="group" aria-label="Qué marcar en el mapa" className="grid grid-cols-3 gap-2">
      {(['PUNTO', 'SECTOR', 'REFERENCIA'] as const).map(m => <button key={m} type="button" aria-pressed={activeMode === m} disabled={m !== 'PUNTO' && !value} onClick={() => { setMode(m); setMessage(''); }}
        className={`min-h-11 rounded-lg border px-2 text-sm font-semibold disabled:opacity-50 ${activeMode === m ? 'border-green-800 bg-green-800 text-white' : 'border-neutral-300 bg-white text-neutral-800'}`}>{{ PUNTO: 'Punto', SECTOR: 'Sector', REFERENCIA: 'Referencia' }[m]}</button>)}
    </div>}
    {!disabled && <p className="text-sm text-neutral-700">{value ? MODE_HELP[activeMode] : 'Primero ubicá el punto inspeccionado; después podés trazar el sector y marcar referencias.'}</p>}
    <div className="relative z-0 h-72 overflow-hidden rounded-xl border border-neutral-300 sm:h-96" aria-label="Mapa del lugar inspeccionado"><MapContainer center={value ? [value.latitud, value.longitud] : [-32.89, -68.84]} zoom={value?.zoom || 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' crossOrigin="anonymous" /><Drawing value={value} mode={activeMode} disabled={disabled} onChange={onChange} onRejected={setMessage} /><MapSnapshot value={value} disabled={disabled} onChange={onChange} onStatus={setMessage} /></MapContainer></div>
    {!disabled && <button type="button" disabled={busy} onClick={locate} className="min-h-11 rounded-lg border border-green-700 px-4 font-semibold text-green-900">{busy ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}</button>}
    <p role="status" className="text-sm text-neutral-600">{message || (value ? `Punto registrado · ${value.latitud.toFixed(6)}, ${value.longitud.toFixed(6)}${value.precisionMetros != null ? ` · precisión GPS ±${Math.round(value.precisionMetros)} m` : ' · marcado manual'}` : 'Todavía no hay un punto registrado. Tocá el mapa o usá el GPS.')}</p>
    {sector.length > 0 && <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
      <p className="font-semibold">Sector observado</p>
      <p>{sector.length < 3 ? `${sector.length} ${sector.length === 1 ? 'vértice' : 'vértices'} · ${3 - sector.length === 1 ? 'falta 1' : `faltan ${3 - sector.length}`} para cerrar el sector.` : `${sector.length} vértices · superficie ≈ ${fmtArea(areaSquareMeters(sector))} · perímetro ≈ ${fmtMeters(perimeterMeters(sector))}`}</p>
      {!disabled && <div className="flex flex-wrap gap-3"><button type="button" className="min-h-11 font-semibold text-green-900 underline" onClick={() => setSector(sector.slice(0, -1))}>Deshacer último vértice</button><button type="button" className="min-h-11 font-semibold text-red-800 underline" onClick={() => setSector([])}>Borrar sector</button></div>}
    </div>}
    {references.length > 0 && <div className="space-y-3 rounded-lg border border-neutral-200 p-3"><p className="text-sm font-semibold">Referencias del entorno · distancia aproximada al punto</p>
      <ol className="space-y-3">{references.map((r, i) => <li key={r.id} className="space-y-2 border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
        <p className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-[#174a7e] text-xs text-[#174a7e]">{i + 1}</span>Referencia {i + 1} · ≈ {fmtMeters(distanceMeters(value!, r))}</p>
        {disabled ? <p className="text-sm">{MAP_REFERENCE_LABELS[r.tipo]}{r.etiqueta ? ` — ${r.etiqueta}` : ''}</p> : <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">Tipo<select className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-white p-2 text-base" value={r.tipo} onChange={e => setReference(r.id, { tipo: e.target.value as MapReferenceType })}>{MAP_REFERENCE_TYPES.map(t => <option key={t} value={t}>{MAP_REFERENCE_LABELS[t]}</option>)}</select></label>
          <label className="text-sm">Descripción breve<input className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 p-2 text-base" maxLength={160} value={r.etiqueta || ''} placeholder="Ej.: casa lindera al norte" onChange={e => setReference(r.id, { etiqueta: e.target.value })} /></label>
        </div>}
        {!disabled && <button type="button" className="min-h-11 text-sm font-semibold text-red-800 underline" onClick={() => value && onChange(withoutPicture(value, { referencias: references.filter(x => x.id !== r.id).length ? references.filter(x => x.id !== r.id) : undefined }))}>Quitar referencia {i + 1}</button>}
      </li>)}</ol></div>}
    {value?.mapaImagen ? <figure><img src={value.mapaImagen} alt="Vista guardada del lugar inspeccionado para el acta" className="w-full max-w-xl rounded-lg border" /><figcaption className="mt-1 text-xs text-neutral-600">Vista guardada · se incluirá en el acta con la misma numeración. Si cambiás el punto, el sector o las referencias, guardá otra vista.</figcaption></figure>
      : value && !disabled && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{drawn ? 'El acta todavía no tiene la vista con el sector y las referencias actuales. Usá «Guardar vista para el acta» en el mapa.' : 'Para incluir el mapa en el acta, usá «Guardar vista para el acta».'}</p>}
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Ingresar coordenadas</summary><ManualPoint value={value} disabled={disabled} onChange={onChange} /></details>
    <p className="text-xs text-neutral-500">El mapa necesita conexión; el punto y el trazado se conservan en el borrador. Distancias y superficies son aproximadas: no delimitan el predio ni determinan por sí solas el cumplimiento de una restricción ambiental.</p>
  </div>;
}
function ManualPoint({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [lat, setLat] = useState(value?.latitud.toString() || ''); const [lon, setLon] = useState(value?.longitud.toString() || ''); const [error, setError] = useState('');
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-sm">Latitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} /></label><label className="text-sm">Longitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lon} onChange={e => setLon(e.target.value)} /></label></div>{!disabled && <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => { const a = Number(lat.replace(',', '.')), b = Number(lon.replace(',', '.')); if (!lat.trim() || !lon.trim() || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { setError('Ingresá ambas coordenadas válidas.'); return; } setError(''); onChange({ ...(value ? withoutPicture(value, {}) : {}), latitud: a, longitud: b, origen: 'MANUAL', registradaAt: new Date().toISOString(), zoom: 16, precisionMetros: undefined }); }}>Confirmar punto</button>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>;
}
