import { DomEvent } from 'leaflet';
import React, { useState, useRef } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents, useMap } from 'react-leaflet';
import { ACTOR_ICONS } from '../../utils/map-icons';
import type { InspectionFieldLocation } from '../../types/inspection';

function Pin({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const map = useMapEvents({ click: e => { if (!disabled) onChange({ latitud: e.latlng.lat, longitud: e.latlng.lng, origen: 'MAPA', registradaAt: new Date().toISOString(), zoom: map.getZoom() }); } });
  React.useEffect(() => { if (value) map.setView([value.latitud, value.longitud], value.zoom || map.getZoom()); }, [map, value?.latitud, value?.longitud]);
  React.useEffect(() => { const node = map.getContainer(); const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(node); return () => observer.disconnect(); }, [map]);
  return value ? <Marker position={[value.latitud, value.longitud]} icon={ACTOR_ICONS.inspeccion} title="Lugar registrado de la inspección" /> : null;
}
function MapSnapshot({ value, disabled, onChange, onStatus }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void; onStatus: (s: string) => void }) {
  const control = useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (control.current) DomEvent.disableClickPropagation(control.current); }, []);
  const map = useMap(); const [busy, setBusy] = useState(false); const latest = useRef(value); latest.current = value;
  const capture = async () => {
    if (!value || busy) return; const original = value; setBusy(true); onStatus('Preparando mapa para el acta…');
    try {
      const zoom = Math.min(19, Math.max(2, Math.round(map.getZoom()))), width = 768, height = 432;
      const center = map.project([original.latitud, original.longitud], zoom), left = center.x - width / 2, top = center.y - height / 2;
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
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(width/2, height/2, 12, 0, 2*Math.PI); ctx.fill(); ctx.fillStyle = '#1B5E3C'; ctx.beginPath(); ctx.arc(width/2, height/2, 8, 0, 2*Math.PI); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0,height-28,width,28); ctx.fillStyle = '#163126'; ctx.font = '14px sans-serif'; ctx.fillText('© OpenStreetMap contributors · Punto observado, no límite del predio', 10, height-9);
      if (latest.current !== original) { onStatus('El punto cambió. Guardá nuevamente la vista del mapa.'); return; }
      onChange({ ...original, mapaImagen: canvas.toDataURL('image/png'), mapaZoom: zoom }); onStatus('Vista del mapa incorporada al borrador y al acta.');
    } catch { onStatus('No se pudo guardar el mapa. Revisá la conexión y reintentá; el punto permanece guardado.'); }
    finally { setBusy(false); }
  };
  return <div ref={control} className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto' }}><button type="button" disabled={disabled || !value || busy} onClick={e => { e.stopPropagation(); void capture(); }} onDoubleClick={e => e.stopPropagation()} className="m-2 min-h-11 rounded-lg border border-green-800 bg-white px-3 font-semibold text-green-900 disabled:opacity-50">{busy ? 'Preparando…' : 'Guardar vista para el acta'}</button></div>;
}
export default function InspectionLocationMap({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const locate = () => {
    if (!navigator.geolocation) { setMessage('Este dispositivo no ofrece GPS. Marcá el lugar en el mapa.'); return; }
    setBusy(true); setMessage('Buscando ubicación…');
    navigator.geolocation.getCurrentPosition(p => { onChange({ latitud: p.coords.latitude, longitud: p.coords.longitude, precisionMetros: p.coords.accuracy, origen: 'GPS', registradaAt: new Date().toISOString(), zoom: 17 }); setBusy(false); setMessage('Ubicación obtenida. Revisá que el punto corresponda al lugar inspeccionado.'); }, () => { setBusy(false); setMessage('No se pudo obtener el GPS. Podés marcar el mapa o ingresar coordenadas.'); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };
  return <div className="space-y-3">
    <div className="relative z-0 h-72 overflow-hidden rounded-xl border border-neutral-300" aria-label="Mapa del lugar inspeccionado"><MapContainer center={value ? [value.latitud, value.longitud] : [-32.89, -68.84]} zoom={value?.zoom || 13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap contributors' crossOrigin="anonymous" /><Pin value={value} disabled={disabled} onChange={onChange} /><MapSnapshot value={value} disabled={disabled} onChange={onChange} onStatus={setMessage} /></MapContainer></div>
    {!disabled && <button type="button" disabled={busy} onClick={locate} className="min-h-11 rounded-lg border border-green-700 px-4 font-semibold text-green-900">{busy ? 'Obteniendo ubicación…' : 'Usar mi ubicación'}</button>}
    <p role="status" className="text-sm text-neutral-600">{message || (value ? `Punto registrado · ${value.latitud.toFixed(6)}, ${value.longitud.toFixed(6)}${value.precisionMetros != null ? ` · precisión GPS ±${Math.round(value.precisionMetros)} m` : ' · marcado manual'}` : 'Todavía no hay un punto registrado. Tocá el mapa o usá el GPS.')}</p>
    {value?.mapaImagen && <figure><img src={value.mapaImagen} alt="Vista guardada del lugar inspeccionado para el acta" className="max-h-48 rounded-lg border" /><figcaption className="mt-1 text-xs text-neutral-600">Vista guardada · se incluirá en el acta. Al cambiar el punto, guardá otra vista.</figcaption></figure>}
    <details><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Ingresar coordenadas</summary><ManualPoint value={value} disabled={disabled} onChange={onChange} /></details>
    <p className="text-xs text-neutral-500">El mapa necesita conexión. Las coordenadas se conservan en el borrador; no se presume que un punto sea una delimitación del predio.</p>
  </div>;
}
function ManualPoint({ value, disabled, onChange }: { value?: InspectionFieldLocation; disabled: boolean; onChange: (v: InspectionFieldLocation) => void }) {
  const [lat, setLat] = useState(value?.latitud.toString() || ''); const [lon, setLon] = useState(value?.longitud.toString() || ''); const [error, setError] = useState('');
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><label className="text-sm">Latitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lat} onChange={e => setLat(e.target.value)} /></label><label className="text-sm">Longitud<input className="mt-1 min-h-11 w-full rounded-lg border p-2" disabled={disabled} inputMode="decimal" value={lon} onChange={e => setLon(e.target.value)} /></label></div>{!disabled && <button type="button" className="min-h-11 rounded-lg border px-4" onClick={() => { const a = Number(lat.replace(',', '.')), b = Number(lon.replace(',', '.')); if (!lat.trim() || !lon.trim() || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) { setError('Ingresá ambas coordenadas válidas.'); return; } setError(''); onChange({ latitud: a, longitud: b, origen: 'MANUAL', registradaAt: new Date().toISOString(), zoom: 16 }); }}>Confirmar punto</button>}{error && <p role="alert" className="text-sm text-red-800">{error}</p>}</div>;
}
