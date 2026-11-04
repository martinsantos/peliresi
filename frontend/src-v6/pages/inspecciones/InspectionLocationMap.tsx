import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Circle, CircleMarker, MapContainer, Marker, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { ACTOR_ICONS } from '../../utils/map-icons';
import type { InspectionFieldLocation } from '../../types/inspection';
import { areaSquareMeters, circlePolygon, distanceMeters, MAP_MAX_DISTANCE_M, MAP_REFERENCE_LABELS, MAP_REFERENCE_TYPES, inspectionPointText, type MapPoint, type MapReference, type MapReferenceType } from '../../utils/inspectionMapGeometry';

// The inspector is standing somewhere: «Estoy acá» marks the point and that is enough. The premises
// can be bigger than a point, so the point grows into a circle with one tap on a radius. References
// around are optional and get named right under the map. Nothing is placed by touching the map.
type Mode = 'PUNTO' | 'REFERENCIA' | null;
const MAX_REFERENCES = 20, GREEN = '#1B5E3C', BLUE = '#174a7e';
const RADII = [50, 100, 250, 500, 1000] as const;
const fmtMeters = (m: number) => m >= 1000 ? `${(m / 1000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} km` : `${Math.round(m).toLocaleString('es-AR')} m`;
const fmtArea = (m2: number) => m2 >= 10000 ? `${(m2 / 10000).toLocaleString('es-AR', { maximumFractionDigits: 2 })} ha` : `${Math.round(m2).toLocaleString('es-AR')} m²`;
const numberIcon = (n: number) => divIcon({ className: '', iconSize: [28, 28], iconAnchor: [14, 14], html: `<span style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:9999px;background:#fff;border:3px solid ${BLUE};color:${BLUE};font:700 13px/1 sans-serif">${n}</span>` });
const touchDevice = () => typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
/** Any drawing change invalidates the saved picture: the act must never show an outdated sketch. */
const withoutPicture = (value: InspectionFieldLocation, patch: Partial<InspectionFieldLocation>): InspectionFieldLocation => {
  const rest = { ...value };
  delete rest.mapaImagen;
  delete rest.mapaZoom;
  return { ...rest, ...patch };
};
/** A new point keeps the premises radius: the circle follows the point. */
const movedPoint = (value: InspectionFieldLocation | undefined, point: MapPoint, patch: Partial<InspectionFieldLocation>): InspectionFieldLocation => {
  const base: InspectionFieldLocation = { ...(value ? withoutPicture(value, {}) : { origen: 'MAPA', registradaAt: '' } as InspectionFieldLocation), ...point, ...patch, registradaAt: new Date().toISOString() };
  return value?.radioMetros ? { ...base, perimetro: circlePolygon(point, value.radioMetros) } : base;
};

type Center = MapPoint & { zoom: number };
/** Follows the map: reports where the cross is, keeps the point in view and, on a phone, hands
 * vertical swipes to the page until the map is tapped. */
function Viewport({ value, locked, onCenter, onUnlock }: { value?: InspectionFieldLocation; locked: boolean; onCenter: (c: Center) => void; onUnlock: () => void }) {
  const map = useMapEvents({ move: () => { const c = map.getCenter(); onCenter({ latitud: c.lat, longitud: c.lng, zoom: map.getZoom() }); }, click: onUnlock });
  useEffect(() => { const c = map.getCenter(); onCenter({ latitud: c.lat, longitud: c.lng, zoom: map.getZoom() }); }, [map, onCenter]);
  const { latitud, longitud, zoom } = value || {};
  useEffect(() => { if (latitud !== undefined && longitud !== undefined) map.setView([latitud, longitud], zoom || map.getZoom()); }, [map, latitud, longitud, zoom]);
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
    {value.radioMetros ? <Circle center={[value.latitud, value.longitud]} radius={value.radioMetros} pathOptions={{ color: GREEN, weight: 3, dashArray: '8 6', fillOpacity: 0.15 }} />
      : sector.length >= 3 ? <><Polygon positions={sector} pathOptions={{ color: GREEN, weight: 3, dashArray: '8 6', fillOpacity: 0.15 }} />{sector.map((p, i) => <CircleMarker key={i} center={p} radius={5} pathOptions={{ color: GREEN, fillColor: '#fff', fillOpacity: 1, weight: 2 }} />)}</> : null}
    {(value.referencias || []).map((r, i) => <Marker key={`${r.id}:${r.tipo}:${r.etiqueta || ''}`} position={[r.latitud, r.longitud]} icon={numberIcon(i + 1)} title={`${i + 1}. ${r.etiqueta || MAP_REFERENCE_LABELS[r.tipo]}`} />)}
    <Marker position={[value.latitud, value.longitud]} icon={ACTOR_ICONS.inspeccion} title="Lugar registrado de la inspección" />
  </>;
}

/** Fit the point, premises and references in a 768×432 picture; zoom never goes beyond what the inspector looked at. */
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
      if (sector.length >= 3) {
        ctx.beginPath(); sector.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
        ctx.fillStyle = 'rgba(27,94,60,0.18)'; ctx.fill(); ctx.setLineDash([10, 7]); ctx.lineWidth = 3; ctx.strokeStyle = GREEN; ctx.stroke(); ctx.setLineDash([]);
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

const primary = 'min-h-12 rounded-lg border border-green-800 bg-green-800 px-4 font-semibold text-white disabled:opacity-50';
const secondary = 'min-h-12 rounded-lg border border-green-700 bg-white px-4 font-semibold text-green-900 disabled:opacity-50';
const chip = (active: boolean) => `min-h-11 rounded-full border px-3 text-sm font-semibold ${active ? 'border-green-800 bg-green-800 text-white' : 'border-neutral-300 bg-white text-neutral-800'}`;

export default function InspectionLocationMap({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false); const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<Mode>(null); const [center, setCenter] = useState<Center | null>(null); const [locked, setLocked] = useState(touchDevice);
  const [customRadius, setCustomRadius] = useState(''); const [editingReference, setEditingReference] = useState<string | null>(null);
  // Scrolling the page (a touch that started outside the map) hands the map back to the page.
  useEffect(() => {
    if (!touchDevice()) return;
    const relock = () => setLocked(true);
    window.addEventListener('scroll', relock, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', relock, { capture: true });
  }, []);
  const activeMode: Mode = value ? mode : 'PUNTO';
  const references = value?.referencias || [];
  const legacySector = Boolean(value?.perimetro?.length && !value.radioMetros);
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Este dispositivo no ofrece GPS. Mové el mapa hasta la cruz y marcá el punto.'); return; }
    setBusy(true); setMessage('Buscando tu ubicación…');
    navigator.geolocation.getCurrentPosition(p => { onChange(movedPoint(value, { latitud: p.coords.latitude, longitud: p.coords.longitude }, { precisionMetros: p.coords.accuracy, origen: 'GPS', zoom: 17 })); setBusy(false); setMode(null); setMessage('Punto tomado del GPS. Revisá que corresponda al lugar.'); }, () => { setBusy(false); setMessage('No se pudo obtener el GPS. Mové el mapa hasta la cruz y marcá el punto, o ingresá coordenadas.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  const markHere = () => {
    if (!center || disabled) return;
    const point: MapPoint = { latitud: center.latitud, longitud: center.longitud };
    setMessage('');
    if (activeMode === 'PUNTO' || !value) { onChange(movedPoint(value, point, { origen: 'MAPA', zoom: center.zoom, precisionMetros: undefined })); setMode(null); return; }
    if (distanceMeters(value, point) > MAP_MAX_DISTANCE_M) { setMessage('La cruz está a más de 10 km del punto. Acercala y volvé a intentar.'); return; }
    if (references.length >= MAX_REFERENCES) return;
    const id = crypto.randomUUID();
    onChange(withoutPicture(value, { referencias: [...references, { id, tipo: 'VIVIENDA', etiqueta: '', ...point }] }));
    setMode(null); setEditingReference(id);
  };
  const setRadius = (radius?: number) => { if (!value) return; onChange(withoutPicture(value, radius ? { radioMetros: radius, perimetro: circlePolygon(value, radius) } : { radioMetros: undefined, perimetro: undefined })); };
  const setReference = (id: string, patch: Partial<MapReference>) => value && onChange(withoutPicture(value, { referencias: references.map(r => r.id === id ? { ...r, ...patch } : r) }));
  const removeReference = (id: string) => { if (!value) return; const rest = references.filter(r => r.id !== id); onChange(withoutPicture(value, { referencias: rest.length ? rest : undefined })); if (editingReference === id) setEditingReference(null); };
  const crosshair = !disabled && activeMode !== null;
  const status = message || (activeMode === 'REFERENCIA' && value && center ? `La cruz está a ${fmtMeters(distanceMeters(value, center))} del punto.` : value ? `Punto registrado · ${inspectionPointText(value)}` : 'Todavía no hay un punto registrado.');
  const referenceRow = (r: MapReference, i: number) => <li key={r.id} className="space-y-2 rounded-lg border border-neutral-200 p-3">
    <p className="flex items-center gap-2 text-sm font-semibold"><span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-[#174a7e] text-xs text-[#174a7e]">{i + 1}</span>Referencia {i + 1} · a {fmtMeters(distanceMeters(value!, r))} del punto</p>
    {disabled || (editingReference !== r.id && (r.etiqueta || '').trim()) ? <p className="flex items-center justify-between gap-2 text-sm"><span>{MAP_REFERENCE_LABELS[r.tipo]}{r.etiqueta ? ` — ${r.etiqueta}` : ''}</span>{!disabled && <button type="button" className="min-h-11 shrink-0 font-semibold text-green-900 underline" onClick={() => setEditingReference(r.id)}>Editar</button>}</p>
      : <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm font-semibold">Qué es<select className="mt-1 min-h-12 w-full rounded-lg border border-neutral-400 bg-white p-2 text-base font-normal" value={r.tipo} onChange={e => setReference(r.id, { tipo: e.target.value as MapReferenceType })}>{MAP_REFERENCE_TYPES.map(t => <option key={t} value={t}>{MAP_REFERENCE_LABELS[t]}</option>)}</select></label>
        <label className="text-sm font-semibold">Descripción breve<input className="mt-1 min-h-12 w-full rounded-lg border border-neutral-400 p-2 text-base font-normal" maxLength={160} value={r.etiqueta || ''} placeholder="Ej.: casa lindera al norte" onChange={e => setReference(r.id, { etiqueta: e.target.value })} /></label>
      </div>}
    {!disabled && <button type="button" className="min-h-11 text-sm font-semibold text-red-800 underline" onClick={() => removeReference(r.id)}>Quitar referencia {i + 1}</button>}
  </li>;
  const editingIndex = references.findIndex(r => r.id === editingReference);
  return <div className="space-y-3">
    {!disabled && <p className="text-sm text-neutral-700">{!value ? 'Tocá «Estoy acá» para tomar el punto del GPS. Si no hay señal, mové el mapa hasta la cruz y marcalo.' : activeMode === 'PUNTO' ? 'Mové el mapa hasta que la cruz quede sobre el lugar y marcá el punto.' : activeMode === 'REFERENCIA' ? 'Llevá la cruz sobre el vecino, curso de agua o uso sensible y marcá la referencia.' : 'El punto está registrado. Si el predio es más grande, elegí un radio.'}</p>}
    <div className="relative z-0 h-64 overflow-hidden rounded-xl border border-neutral-300 sm:h-96" aria-label="Mapa del lugar inspeccionado">
      <MapContainer center={value ? [value.latitud, value.longitud] : [-32.89, -68.84]} zoom={value?.zoom || 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' crossOrigin="anonymous" />
        <Viewport value={value} locked={locked} onCenter={setCenter} onUnlock={() => setLocked(false)} />
        <Drawn value={value} />
        <MapSnapshot value={value} disabled={disabled} onChange={onChange} onStatus={setMessage} slot={slot} />
      </MapContainer>
      {crosshair && <div data-testid="map-crosshair" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
        <span className="relative block h-9 w-9 rounded-full border-[3px] border-green-800 bg-white/30 shadow-[0_0_0_2px_rgba(255,255,255,0.9)]"><span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-800" /></span>
      </div>}
      {!disabled && locked && <p className="pointer-events-none absolute left-1/2 top-2 z-[500] -translate-x-1/2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-neutral-800 shadow">Tocá el mapa para moverlo</p>}
    </div>
    {!disabled && <div className="flex flex-wrap gap-2">
      {activeMode === 'PUNTO' && <><button type="button" disabled={busy} onClick={locate} className={primary}>{busy ? 'Buscando…' : 'Estoy acá'}</button><button type="button" disabled={!center} onClick={markHere} className={secondary}>Marcar el punto aquí</button>{value && <button type="button" onClick={() => setMode(null)} className="min-h-12 px-2 font-semibold text-neutral-700 underline">Cancelar</button>}</>}
      {activeMode === 'REFERENCIA' && <><button type="button" disabled={!center} onClick={markHere} className={primary}>Marcar la referencia aquí</button><button type="button" onClick={() => { setMode(null); setMessage(''); }} className="min-h-12 px-2 font-semibold text-neutral-700 underline">Cancelar</button></>}
      {activeMode === null && <><button type="button" disabled={busy} onClick={locate} className={secondary}>{busy ? 'Buscando…' : 'Estoy acá de nuevo'}</button><button type="button" onClick={() => { setMode('PUNTO'); setMessage(''); }} className="min-h-12 px-2 font-semibold text-green-900 underline">Mover el punto</button></>}
    </div>}
    <p role="status" className="text-sm text-neutral-600">{status}</p>
    <div ref={setSlot} />
    {value && !disabled && <div className="space-y-2">
      <p className="text-sm font-semibold text-neutral-900">¿El predio es más grande que un punto?</p>
      <div role="group" aria-label="Radio del predio" className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!value.radioMetros && !legacySector} onClick={() => setRadius(undefined)} className={chip(!value.radioMetros && !legacySector)}>Es un punto</button>
        {RADII.map(r => <button key={r} type="button" aria-pressed={value.radioMetros === r} onClick={() => setRadius(r)} className={chip(value.radioMetros === r)}>{fmtMeters(r)}</button>)}
        <label className="flex min-h-11 items-center gap-1 text-sm font-semibold">Otro<input inputMode="numeric" aria-label="Radio en metros" className="ml-1 w-20 min-h-11 rounded-lg border border-neutral-400 p-1 text-center text-base font-normal" value={customRadius} placeholder="m" onChange={e => setCustomRadius(e.target.value)} onBlur={() => { const r = Number(customRadius); if (r >= 10 && r <= 5000) setRadius(Math.round(r)); }} /></label>
      </div>
      {value.radioMetros ? <p className="text-sm text-neutral-700">Predio aproximado: radio de {fmtMeters(value.radioMetros)} · superficie aprox. {fmtArea(areaSquareMeters(value.perimetro || []))}.</p>
        : legacySector ? <p className="text-sm text-neutral-700">Hay un trazado anterior de {value.perimetro!.length} vértices. Elegí un radio para reemplazarlo o <button type="button" className="font-semibold text-red-800 underline" onClick={() => setRadius(undefined)}>quitalo</button>.</p> : null}
    </div>}
    {disabled && value?.radioMetros && <p className="text-sm text-neutral-700">Predio aproximado: radio de {fmtMeters(value.radioMetros)} alrededor del punto.</p>}
    {value && (references.length > 0 || !disabled) && <div className="space-y-2">
      <p className="text-sm font-semibold text-neutral-900">Referencias alrededor <span className="font-normal text-neutral-600">· vecinos, cursos de agua, usos sensibles · opcional</span></p>
      {references.length > 0 && <ol className="space-y-2">{editingIndex >= 0 && referenceRow(references[editingIndex], editingIndex)}{references.map((r, i) => i === editingIndex ? null : referenceRow(r, i))}</ol>}
      {!disabled && activeMode !== 'REFERENCIA' && references.length < MAX_REFERENCES && <button type="button" onClick={() => { setMode('REFERENCIA'); setMessage(''); setEditingReference(null); }} className={secondary}>Agregar referencia</button>}
    </div>}
    {value?.mapaImagen && <figure><img src={value.mapaImagen} alt="Vista guardada del lugar inspeccionado para el acta" className="w-full max-w-xl rounded-lg border" /><figcaption className="mt-1 text-xs text-neutral-600">Así va en el acta. Se actualiza sola al cambiar el punto, el predio o las referencias.</figcaption></figure>}
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Ingresar coordenadas</summary><ManualPoint value={value} disabled={disabled} onChange={onChange} /></details>
    <p className="text-xs text-neutral-500">Trazado aproximado del inspector: no delimita el predio ni define por sí solo una restricción ambiental. Sin conexión, el punto y el trazado se conservan.</p>
  </div>;
}
function ManualPoint({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [lat, setLat] = useState(value?.latitud.toString() || ''); const [lon, setLon] = useState(value?.longitud.toString() || ''); const [error, setError] = useState('');
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-sm">Latitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} /></label><label className="text-sm">Longitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lon} onChange={e => setLon(e.target.value)} /></label></div>{!disabled && <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => { const a = Number(lat.replace(',', '.')), b = Number(lon.replace(',', '.')); if (!lat.trim() || !lon.trim() || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { setError('Ingresá ambas coordenadas válidas.'); return; } setError(''); onChange(movedPoint(value, { latitud: a, longitud: b }, { origen: 'MANUAL', zoom: 16, precisionMetros: undefined })); }}>Confirmar punto</button>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>;
}
