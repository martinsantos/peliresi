import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { ACTOR_ICONS } from '../../utils/map-icons';
import type { InspectionFieldLocation } from '../../types/inspection';
import { areaSquareMeters, distanceMeters, MAP_MAX_DISTANCE_M, MAP_REFERENCE_LABELS, MAP_REFERENCE_TYPES, perimeterMeters, inspectionPointText, type MapPoint, type MapReference, type MapReferenceType } from '../../utils/inspectionMapGeometry';

// The finger never places anything. The inspector drags the map until the fixed cross is on the
// spot and presses one button, so a vertex can neither drift during the pan nor land on a tap
// that was meant to scroll the page.
type Mode = 'PUNTO' | 'SECTOR' | 'REFERENCIA';
const MAX_VERTICES = 40, MAX_REFERENCES = 20, GREEN = '#1B5E3C', BLUE = '#174a7e';
const MODE_LABEL: Record<Mode, string> = { PUNTO: 'Punto', SECTOR: 'Sector', REFERENCIA: 'Referencias' };
const MARK_LABEL: Record<Mode, string> = { PUNTO: 'Marcar el punto aquí', SECTOR: 'Agregar vértice aquí', REFERENCIA: 'Agregar referencia aquí' };
const MODE_HELP: Record<Mode, string> = {
  PUNTO: 'Mové el mapa hasta que la cruz quede sobre el lugar inspeccionado.',
  SECTOR: 'Llevá la cruz a cada esquina del sector y agregá el vértice. Con tres o más se cierra solo.',
  REFERENCIA: 'Llevá la cruz sobre un vecino, curso de agua o uso sensible y agregá la referencia.',
};
const fmtMeters = (m: number) => m >= 1000 ? `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} km` : `${Math.round(m).toLocaleString('es-AR')} m`;
const fmtArea = (m2: number) => m2 >= 10000 ? `${(m2 / 10000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha` : `${Math.round(m2).toLocaleString('es-AR')} m²`;
const numberIcon = (n: number) => divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;border:3px solid ${BLUE};color:${BLUE};font:700 13px/1 sans-serif">${n}</span>` });
const touchDevice = () => typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
/** Any drawing change invalidates the saved picture: the act must never show an outdated sketch. */
const withoutPicture = (value: InspectionFieldLocation, patch: Partial<InspectionFieldLocation>): InspectionFieldLocation => {
  const { mapaImagen: _image, mapaZoom: _zoom, ...rest } = value; return { ...rest, ...patch };
};

type Center = MapPoint & { zoom: number };
/** Follows the map: reports where the cross is, keeps the point in view and, on a phone, hands
 * vertical swipes to the page until the map is tapped. */
function Viewport({ value, locked, onCenter, onUnlock }: { value?: InspectionFieldLocation; locked: boolean; onCenter: (c: Center) => void; onUnlock: () => void }) {
  const map = useMapEvents({ move: () => { const c = map.getCenter(); onCenter({ latitud: c.lat, longitud: c.lng, zoom: map.getZoom() }); }, click: onUnlock });
  useEffect(() => { const c = map.getCenter(); onCenter({ latitud: c.lat, longitud: c.lng, zoom: map.getZoom() }); }, [map, onCenter]);
  useEffect(() => { if (value) map.setView([value.latitud, value.longitud], value.zoom || map.getZoom()); }, [map, value?.latitud, value?.longitud]);
  useEffect(() => { const node = map.getContainer(); const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(node); return () => observer.disconnect(); }, [map]);
  useEffect(() => {
    const container = map.getContainer();
    if (locked) { map.dragging.disable(); map.touchZoom.disable(); container.style.touchAction = 'pan-y'; }
    else { map.dragging.enable(); map.touchZoom.enable(); container.style.touchAction = 'none'; }
  }, [map, locked]);
  return null;
}

function Drawn({ value }: { value?: InspectionFieldLocation }) {
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
const drawingKey = (value?: InspectionFieldLocation) => value ? JSON.stringify([value.latitud, value.longitud, value.perimetro, (value.referencias || []).map(r => [r.latitud, r.longitud])]) : '';
/** The picture for the act is prepared on its own once the drawing settles. Only a failure asks for a tap. */
function MapSnapshot({ value, disabled, onChange, onStatus, slot }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void; onStatus: (s: string) => void; slot: HTMLElement | null }) {
  const map = useMap(); const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false); const latest = useRef(value); latest.current = value;
  const capture = async () => {
    const original = latest.current;
    if (!original || busy) return; setBusy(true); setFailed(false);
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
      // The drawing moved on while the tiles loaded: the next idle period prepares it again.
      if (latest.current !== original) return;
      onChange({ ...original, mapaImagen: canvas.toDataURL('image/png'), mapaZoom: zoom }); onStatus('Vista del mapa guardada para el acta.');
    } catch { setFailed(true); }
    finally { setBusy(false); }
  };
  const key = drawingKey(value), pictured = Boolean(value?.mapaImagen);
  useEffect(() => {
    if (!key || pictured || disabled || !navigator.onLine) return;
    const timer = setTimeout(() => void capture(), 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pictured, disabled]);
  if (!slot || disabled || pictured) return null;
  return createPortal(busy ? <p role="status" className="text-sm text-neutral-600">Preparando la vista del mapa para el acta…</p>
    : failed ? <p role="alert" className="text-sm text-amber-950">No se pudo preparar la vista del mapa para el acta. <button type="button" onClick={() => void capture()} className="min-h-11 font-semibold underline">Reintentar</button></p> : null, slot);
}

export default function InspectionLocationMap({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [mode, setMode] = useState<Mode>('PUNTO'); const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [center, setCenter] = useState<Center | null>(null); const [locked, setLocked] = useState(touchDevice);
  // Scrolling the page (a touch that started outside the map) hands the map back to the page.
  useEffect(() => {
    if (!touchDevice()) return;
    const relock = () => setLocked(true);
    window.addEventListener('scroll', relock, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', relock, { capture: true });
  }, []);
  const activeMode: Mode = value ? mode : 'PUNTO';
  const sector = value?.perimetro || [], references = value?.referencias || [];
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Este dispositivo no ofrece GPS. Llevá la cruz al lugar y marcá el punto.'); return; }
    setBusy(true); setMessage('Buscando ubicación…');
    navigator.geolocation.getCurrentPosition(p => { onChange({ ...(value ? withoutPicture(value, {}) : {}), latitud: p.coords.latitude, longitud: p.coords.longitude, precisionMetros: p.coords.accuracy, origen: 'GPS', registradaAt: new Date().toISOString(), zoom: 17 }); setBusy(false); setMessage('Ubicación obtenida. Revisá que el punto corresponda al lugar inspeccionado.'); }, () => { setBusy(false); setMessage('No se pudo obtener el GPS. Llevá la cruz al lugar y marcá el punto, o ingresá coordenadas.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const setSector = (next: MapPoint[]) => value && onChange(withoutPicture(value, { perimetro: next.length ? next : undefined }));
  const setReference = (id: string, patch: Partial<MapReference>) => value && onChange(withoutPicture(value, { referencias: references.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const mark = () => {
    if (!center || disabled) return;
    const point: MapPoint = { latitud: center.latitud, longitud: center.longitud };
    setMessage('');
    if (activeMode === 'PUNTO' || !value) { onChange({ ...(value ? withoutPicture(value, {}) : {}), ...point, origen: 'MAPA', registradaAt: new Date().toISOString(), zoom: center.zoom, precisionMetros: undefined }); return; }
    if (distanceMeters(value, point) > MAP_MAX_DISTANCE_M) { setMessage('La cruz está a más de 10 km del punto inspeccionado. Acercala y volvé a intentar.'); return; }
    if (activeMode === 'SECTOR') { if (sector.length < MAX_VERTICES) setSector([...sector, point]); return; }
    if (references.length < MAX_REFERENCES) onChange(withoutPicture(value, { referencias: [...references, { id: crypto.randomUUID(), tipo: 'VIVIENDA', etiqueta: '', ...point }] }));
  };
  const readout = !disabled && value && center && activeMode !== 'PUNTO' ? `La cruz está a ${fmtMeters(distanceMeters(value, center))} del punto.` : '';
  const button = 'min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50';
  return <div className="space-y-3">
    {value && !disabled && <div role="group" aria-label="Qué marcar en el mapa" className="grid grid-cols-3 gap-2">
      {(['PUNTO', 'SECTOR', 'REFERENCIA'] as const).map(m => <button key={m} type="button" aria-pressed={activeMode === m} onClick={() => { setMode(m); setMessage(''); }}
        className={`min-h-11 rounded-lg border px-2 text-sm font-semibold ${activeMode === m ? 'border-green-800 bg-green-800 text-white' : 'border-neutral-300 bg-white text-neutral-800'}`}>{MODE_LABEL[m]}</button>)}
    </div>}
    {!disabled && <p className="text-sm text-neutral-700">{value ? MODE_HELP[activeMode] : 'Usá el GPS, o mové el mapa hasta que la cruz quede sobre el lugar y marcá el punto.'}</p>}
    <div className="relative z-0 h-72 overflow-hidden rounded-xl border border-neutral-300 sm:h-96" aria-label="Mapa del lugar inspeccionado">
      <MapContainer center={value ? [value.latitud, value.longitud] : [-32.89, -68.84]} zoom={value?.zoom || 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' crossOrigin="anonymous" />
        <Viewport value={value} locked={locked} onCenter={setCenter} onUnlock={() => setLocked(false)} />
        <Drawn value={value} />
        <MapSnapshot value={value} disabled={disabled} onChange={onChange} onStatus={setMessage} slot={slot} />
      </MapContainer>
      {!disabled && <div data-testid="map-crosshair" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
        <span className="relative block h-9 w-9 rounded-full border-[3px] border-green-800 bg-white/30 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"><span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-800" /></span>
      </div>}
      {!disabled && locked && <p className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] bg-white/90 py-1.5 text-center text-xs font-semibold text-neutral-800">Tocá el mapa para moverlo</p>}
    </div>
    {!disabled && <div className="flex flex-wrap gap-2">
      <button type="button" disabled={!center} onClick={mark} className={`${button} border-green-800 bg-green-800 text-white`}>{MARK_LABEL[activeMode]}</button>
      {activeMode === 'SECTOR' && sector.length > 0 && <button type="button" onClick={() => setSector(sector.slice(0, -1))} className={`${button} border-neutral-300 bg-white text-neutral-800`}>Deshacer</button>}
      {activeMode === 'PUNTO' && <button type="button" disabled={busy} onClick={locate} className={`${button} border-green-700 bg-white text-green-900`}>{busy ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}</button>}
    </div>}
    <p role="status" className="text-sm text-neutral-600">{message || readout || (value ? `Punto registrado · ${inspectionPointText(value)}` : 'Todavía no hay un punto registrado.')}</p>
    <div ref={setSlot} />
    {sector.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 p-3 text-sm">
      <p><span className="font-semibold">Sector</span> · {sector.length < 3 ? `${sector.length} ${sector.length === 1 ? 'vértice' : 'vértices'} · ${3 - sector.length === 1 ? 'falta 1' : `faltan ${3 - sector.length}`} para cerrarlo` : `${sector.length} vértices · superficie aprox. ${fmtArea(areaSquareMeters(sector))} · perímetro aprox. ${fmtMeters(perimeterMeters(sector))}`}</p>
      {!disabled && <button type="button" className="min-h-11 font-semibold text-red-800 underline" onClick={() => setSector([])}>Borrar sector</button>}
    </div>}
    {references.length > 0 && <ol className="space-y-3 rounded-lg border border-neutral-200 p-3">{references.map((r, i) => <li key={r.id} className="space-y-2 border-t border-neutral-100 pt-3 first:border-0 first:pt-0">
      <p className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-[#174a7e] text-xs text-[#174a7e]">{i + 1}</span>Referencia {i + 1} · a {fmtMeters(distanceMeters(value!, r))} del punto</p>
      {disabled ? <p className="text-sm">{MAP_REFERENCE_LABELS[r.tipo]}{r.etiqueta ? ` — ${r.etiqueta}` : ''}</p> : <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">Tipo<select className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 bg-white p-2 text-base" value={r.tipo} onChange={e => setReference(r.id, { tipo: e.target.value as MapReferenceType })}>{MAP_REFERENCE_TYPES.map(t => <option key={t} value={t}>{MAP_REFERENCE_LABELS[t]}</option>)}</select></label>
        <label className="text-sm">Descripción breve<input className="mt-1 min-h-11 w-full rounded-lg border border-neutral-300 p-2 text-base" maxLength={160} value={r.etiqueta || ''} placeholder="Ej.: casa lindera al norte" onChange={e => setReference(r.id, { etiqueta: e.target.value })} /></label>
      </div>}
      {!disabled && <button type="button" className="min-h-11 text-sm font-semibold text-red-800 underline" onClick={() => value && onChange(withoutPicture(value, { referencias: references.filter(x => x.id !== r.id).length ? references.filter(x => x.id !== r.id) : undefined }))}>Quitar referencia {i + 1}</button>}
    </li>)}</ol>}
    {value?.mapaImagen && <figure><img src={value.mapaImagen} alt="Vista guardada del lugar inspeccionado para el acta" className="w-full max-w-xl rounded-lg border" /><figcaption className="mt-1 text-xs text-neutral-600">Así va en el acta. Se actualiza sola al cambiar el punto, el sector o las referencias.</figcaption></figure>}
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Ingresar coordenadas</summary><ManualPoint value={value} disabled={disabled} onChange={onChange} /></details>
    <p className="text-xs text-neutral-500">Trazado aproximado del inspector: no delimita el predio ni define por sí solo una restricción ambiental. Sin conexión, el punto y el trazado se conservan.</p>
  </div>;
}
function ManualPoint({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [lat, setLat] = useState(value?.latitud.toString() || ''); const [lon, setLon] = useState(value?.longitud.toString() || ''); const [error, setError] = useState('');
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-sm">Latitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} /></label><label className="text-sm">Longitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lon} onChange={e => setLon(e.target.value)} /></label></div>{!disabled && <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => { const a = Number(lat.replace(',', '.')), b = Number(lon.replace(',', '.')); if (!lat.trim() || !lon.trim() || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { setError('Ingresá ambas coordenadas válidas.'); return; } setError(''); onChange({ ...(value ? withoutPicture(value, {}) : {}), latitud: a, longitud: b, origen: 'MANUAL', registradaAt: new Date().toISOString(), zoom: 16, precisionMetros: undefined }); }}>Confirmar punto</button>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>;
}
