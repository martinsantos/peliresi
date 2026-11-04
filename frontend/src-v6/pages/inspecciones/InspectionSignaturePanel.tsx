import React, { useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import { SignaturePad } from '../../components/ui/SignaturePad';
import { inspectionErrorMessage } from './inspectionPresentation';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';
import { useQueryClient } from '@tanstack/react-query';

export function InspectionSignaturePanel({ inspectionId, saved, editable }: { inspectionId: string; saved: boolean; editable: boolean }) {
  const [preview, setPreview] = useState<any>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(false); const [image, setImage] = useState('');
  const [name, setName] = useState(''); const [document, setDocument] = useState(''); const [character, setCharacter] = useState('');
  const [kind, setKind] = useState<'INSPECCIONADO' | 'INSPECTOR'>('INSPECCIONADO');
  const attempt = useRef(''); const inFlight = useRef(false); const generation = useRef(0); const client = useQueryClient();
  const invalidate = () => { setImage(''); setRead(false); attempt.current = ''; };
  useEffect(() => { generation.current++; setPreview(null); invalidate(); setError(''); }, [inspectionId, saved]);
  const load = async () => {
    if (inFlight.current || !saved) return;
    inFlight.current = true; setBusy(true); setError(''); invalidate(); const run = ++generation.current;
    try { const { data } = await api.get(`/inspecciones/${inspectionId}/firma/vista`); if (run === generation.current) { setPreview(data.data); setName(data.data.acta.datosActa?.atendidoPor || ''); setDocument(data.data.acta.datosActa?.dniAtendido || ''); setCharacter(data.data.acta.datosActa?.cargoAtendido || ''); } }
    catch (e) { setError(inspectionErrorMessage(e, 'No se pudo preparar el acta.')); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const sign = async () => {
    if (inFlight.current || !saved || !preview || !read || !image || !editable) return;
    inFlight.current = true; setBusy(true); setError(''); if (!attempt.current) attempt.current = crypto.randomUUID();
    try {
      const { data } = await api.post(`/inspecciones/${inspectionId}/firmas`, { version: preview.version, contenidoSha256: preview.contenidoSha256, clienteId: attempt.current, nombre: name, documento: document, caracter: character, tipo: kind, imagen: image, lecturaConfirmada: true });
      setPreview({ ...preview, signed: data.data }); invalidate();
      await client.invalidateQueries({ queryKey: ['inspecciones'] });
    } catch (e: any) { setError(inspectionErrorMessage(e, 'No se confirmó la firma. Podés reintentar sin duplicarla.')); if (e?.response?.status === 409) { setPreview(null); invalidate(); } }
    finally { inFlight.current = false; setBusy(false); }
  };
  const download = async (id: string) => {
    try { const { data } = await api.get(`/inspecciones/${inspectionId}/firmas/${id}/acta.pdf`, { responseType: 'blob' }); const url = URL.createObjectURL(data); const a = window.document.createElement('a'); a.href = url; a.download = 'acta-firmada.pdf'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch (e) { setError(inspectionErrorMessage(e, 'No se pudo descargar la copia.')); }
  };
  const fieldLocation = preview?.acta?.datosActa?.ubicacionCampo;
  const input = 'mt-1 min-h-11 w-full rounded-lg border border-neutral-300 p-3 text-base';
  return <section aria-label="Revisión y firma del acta" className="space-y-5">
    <h3 className="text-lg font-semibold">Revisar el acta con la persona presente</h3>
    <p className="text-sm text-neutral-600">La firma manuscrita deja constancia de lectura y recepción; no implica conformidad con los hallazgos. No es una firma digital certificada.</p>
    {!saved && <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm">Guardá los cambios y sincronizá las fotos antes de preparar la firma.</p>}
    <button type="button" disabled={!saved || busy} onClick={() => void load()} className="min-h-11 rounded-lg bg-green-800 px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Procesando…' : 'Preparar acta para lectura'}</button>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {preview && <>
      <article aria-label="Acta presentada para firma" className="space-y-4 rounded-xl border border-neutral-300 bg-white p-4 sm:p-6">
        <header><p className="font-bold text-green-900">SITREP · Acta de inspección</p><h4 className="text-xl font-bold">{preview.acta.numeroActa || preview.acta.numero}</h4><p className="text-sm">{(preview.acta.generador || preview.acta.transportista || preview.acta.operador)?.razonSocial || 'Lugar sin responsable identificado'}</p><p className="text-sm">{preview.acta.ubicacion}</p></header>
        <p className="whitespace-pre-wrap text-base leading-relaxed">{preview.acta.observaciones}</p>
        {Object.entries(preview.acta.datosActa || {}).filter(([k, v]) => v && typeof v !== 'object' && !['modeloCampo', 'solicitaCopia'].includes(k)).map(([k, v]) => <p key={k} className="whitespace-pre-wrap break-words text-sm"><strong>{fieldLabels[k] || k}: </strong>{fieldValue(v)}</p>)}
        {preview.acta.datosActa?.medidas?.map((m: any, i: number) => <div key={m.id} className="rounded-lg border p-3"><strong>Requerimiento {i + 1} · {fieldValue(m.finalidad)}</strong><p>{m.detalle}</p><p>Responsable: {m.responsable}</p><p>{m.dias ? `${m.dias} días ${m.tipoDias === 'HABILES' ? 'hábiles' : 'corridos'}` : 'Sin plazo consignado'}{m.inicio ? ` · Desde: ${m.inicio}` : ''}{m.vencimiento ? ` · Vence: ${new Date(m.vencimiento).toLocaleString('es-AR')}` : ''}</p></div>)}
        {preview.acta.items?.map((r: any) => <p key={r.id} className="text-sm"><strong>{r.etiqueta}: </strong>{fieldValue(r.resultado)}{r.observacion ? ` · ${r.observacion}` : ''}</p>)}
        {preview.acta.comparaciones?.map((r: any) => <div key={r.id} className="border-t pt-2 text-sm"><strong>{r.etiqueta}: {fieldValue(r.resultado)}</strong><p>Declarado: {r.valorDeclarado || 'Sin dato'}</p><p>Observado: {r.valorObservado || (r.resultado === 'COINCIDE' ? 'Coincide con lo declarado' : 'Sin dato consignado')}</p>{r.observacion && <p>{r.observacion}</p>}</div>)}
        {preview.acta.evidencias?.map((e: any) => <figure key={e.id}><InspectionEvidenceImage inspectionId={inspectionId} evidenceId={e.id} alt={e.descripcion || e.nombreOriginal} className="max-h-96 w-full object-contain" preview /><figcaption className="mt-2 whitespace-pre-wrap text-sm">{e.descripcion || e.nombreOriginal}</figcaption></figure>)}
        {fieldLocation && <figure className="space-y-2"><p>Ubicación: {fieldLocation.latitud}, {fieldLocation.longitud} · {fieldValue(fieldLocation.origen)}{fieldLocation.precisionMetros != null ? ` · precisión ±${Math.round(fieldLocation.precisionMetros)} m` : ''}</p>{fieldLocation.mapaImagen ? <img src={fieldLocation.mapaImagen} alt="Mapa guardado que se incorpora al acta" className="w-full rounded-lg border" /> : <p className="text-sm">No se guardó una imagen del mapa.</p>}</figure>}
        {preview.acta.datosActa?.receptores?.length > 0 && <p>Entorno registrado: {preview.acta.datosActa.receptores.map(fieldValue).join(', ')}</p>}
        {preview.acta.datosActa?.cointervinientes?.map((p: any, n: number) => <p key={n}>Interviniente: {p.nombre} · {p.cargo}</p>)}
        <p className="break-all text-xs text-neutral-500">Contenido {preview.contenidoSha256}</p>
      </article>
      {preview.pendientes?.length > 0 && <ul className="list-disc rounded-lg bg-amber-50 p-4 pl-8 text-sm">{preview.pendientes.map((p: string) => <li key={p}>{p}</li>)}</ul>}
      {preview.signed ? <div role="status" className="space-y-2 rounded-lg bg-green-50 p-4"><p>Firma registrada. La copia conserva la versión revisada.</p><button type="button" onClick={() => void download(preview.signed.id)} className="min-h-11 font-semibold text-green-900">Descargar copia firmada</button><p className="text-sm">No se enviaron correos.</p></div> : editable && !preview.pendientes?.length && <fieldset disabled={busy || !saved} className="space-y-4"><legend className="font-semibold">Datos de quien firma</legend><label className="block text-sm">Participación<select className={input} value={kind} onChange={e => { setKind(e.target.value as typeof kind); invalidate(); }}><option value="INSPECCIONADO">Persona que atiende / inspeccionado</option><option value="INSPECTOR">Inspector interviniente</option></select></label>{([['Nombre y apellido', name, setName], ['Documento', document, setDocument], ['Carácter o cargo', character, setCharacter]] as const).map(([label, v, setter]) => <label key={label} className="block text-sm">{label}<input className={input} value={v} onChange={e => { setter(e.target.value); invalidate(); }} /></label>)}
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={read} onChange={e => setRead(e.target.checked)} />La persona pudo revisar el contenido y los anexos mostrados antes de firmar.</label>
        <SignaturePad key={`${preview.contenidoSha256}:${kind}:${name}:${document}:${character}`} onConfirm={v => { setImage(v); attempt.current = ''; }} onClear={() => { setImage(''); attempt.current = ''; }} />
        <button type="button" disabled={!read || !image || name.trim().length < 2 || document.trim().length < 3 || character.trim().length < 2} onClick={() => void sign()} className="min-h-12 w-full rounded-lg bg-green-800 px-4 font-semibold text-white disabled:opacity-50">Registrar firma de esta versión</button>
      </fieldset>}
      {preview.firmas?.map((f: any) => <button key={f.id} type="button" className="block min-h-11 text-sm font-semibold text-green-900" onClick={() => void download(f.id)}>Copia firmada por {f.nombre}</button>)}
    </>}
  </section>;
}
const fieldLabels: Record<string, string> = { atendidoPor: 'Persona presente', cargoAtendido: 'Carácter', dniAtendido: 'Documento', motivoInspeccion: 'Motivo', motivoTipo: 'Tipo de visita', actividadObservada: 'Actividad observada', ampliacionEstado: 'Comparación de instalaciones', ampliacionDetalle: 'Diferencia o ampliación', entornoObservado: 'Entorno', restriccionReferencia: 'Referencia', requerimientos: 'Requerimientos anteriores', contactoActa: 'Contacto declarado', generacion: 'Residuos observados', infraestructura: 'Infraestructura', estadoInfraestructura: 'Estado de instalaciones', detalleInfraestructura: 'Instalaciones', lugarAfectacion: 'Lugar afectado', departamento: 'Departamento', calle: 'Calle', numeroDomicilio: 'Número', codigoPostal: 'Código postal', titular: 'Titular', dniTitular: 'Documento del titular', area: 'Área', actaAnterior: 'Acta anterior', plazoDescargoDias: 'Plazo de descargo (días hábiles)', danosEstado: 'Daños', danosDetalle: 'Detalle de daños', tercerosTestigosEstado: 'Testigos', tercerosTestigosDetalle: 'Participación de testigos', libroOperacionesEstado: 'Libro de operaciones', libroOperacionesDetalle: 'Constancia del libro', domicilioLegal: 'Domicilio legal' };

const fieldValue = (value: unknown): string => ({ OFICIO: 'De oficio o programada', DENUNCIA: 'Denuncia', SEGUIMIENTO: 'Seguimiento', INCIDENTE: 'Incidente', COINCIDE: 'Coincide', DIFIERE: 'Hay diferencias', PENDIENTE: 'Pendiente', NO_VERIFICADO: 'Sin verificar', NO_APLICA: 'No aplica', CUMPLE: 'Cumple', NO_CUMPLE: 'No cumple', NO_OBSERVADOS: 'No se observaron', OBSERVADOS: 'Se observaron', NO_IDENTIFICADOS: 'No se identificaron', IDENTIFICADOS: 'Se identificaron', EXHIBIDO: 'Exhibido y verificado', NO_EXHIBIDO: 'No exhibido', NO_DISPONIBLE: 'No disponible', SECUESTRADO: 'Secuestrado por disposición competente', DOCUMENTACION: 'Documentación', SUBSANACION: 'Subsanación', DESCARGO: 'Descargo', POBLACION: 'Población', SUELO: 'Suelo', AGUA: 'Agua', AIRE: 'Aire', MANUAL: 'Punto ingresado manualmente', MAPA: 'Punto elegido en mapa', GPS: 'GPS' } as Record<string, string>)[String(value)] || String(value);
