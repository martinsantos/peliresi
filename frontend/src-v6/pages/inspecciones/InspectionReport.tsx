import React, { useMemo } from 'react';
import { AlertTriangle, Camera, CheckCircle2, CircleMinus, ClipboardCheck, FileAudio, FileText, XCircle } from 'lucide-react';
import { Badge } from '../../components/ui/BadgeV2';
import type { Inspection } from '../../types/inspection';
import { InspectionEvidenceImage } from './InspectionEvidenceImage';

export function InspectionReport({ inspection }: { inspection: Inspection }) {
  const photos = inspection.evidencias.filter((item) => item.tipo === 'FOTO');
  const differs = inspection.comparaciones.filter((item) => item.resultado === 'DIFIERE');
  const noComply = inspection.items.filter((item) => item.resultado === 'NO_CUMPLE');
  const checked = inspection.comparaciones.filter((item) => item.resultado !== 'PENDIENTE').length;
  const complies = inspection.items.filter((item) => item.resultado === 'CUMPLE').length;
  const pending = inspection.items.filter((item) => item.resultado === 'PENDIENTE').length;
  const notApplicable = inspection.items.filter((item) => item.resultado === 'NO_APLICA').length;
  const checklistGroups = useMemo(() => Array.from(new Set(inspection.items.map((item) => item.categoria))), [inspection.items]);
  const summary = useMemo(() => inspection.observaciones || `Se contrastaron ${checked} de ${inspection.comparaciones.length} datos declarados y se registraron ${differs.length} diferencias. El checklist presenta ${noComply.length} puntos no conformes.`, [checked, differs.length, inspection.comparaciones.length, inspection.observaciones, noComply.length]);

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-4 py-5 sm:px-6"><h3 className="text-xl font-extrabold tracking-tight text-[#10213A]">Resultado del acta</h3><p className="mt-1 text-sm text-neutral-600">Informe consolidado de hallazgos, evidencias y controles.</p></div>
      <div className="space-y-7 px-4 py-5 sm:px-6">
        <div className="border-l-4 border-primary-600 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-3"><ClipboardCheck className="mt-0.5 shrink-0 text-primary-700" size={20} /><div><p className="font-bold text-[#10213A]">Síntesis ejecutiva</p><p className="mt-1 text-sm leading-relaxed text-neutral-700">{summary}</p></div></div>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 lg:grid-cols-4">
          <ReportKpi label="Datos verificados" value={`${checked}/${inspection.comparaciones.length}`} tone="text-primary-700" />
          <ReportKpi label="Diferencias" value={String(differs.length)} tone={differs.length ? 'text-amber-800' : 'text-emerald-700'} />
          <ReportKpi label="Controles conformes" value={`${complies}/${inspection.items.length}`} tone="text-emerald-700" />
          <ReportKpi label="Pendientes" value={String(pending)} tone={pending ? 'text-amber-800' : 'text-neutral-700'} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between"><h4 className="font-extrabold text-[#10213A]">Evidencia incorporada</h4><span className="text-xs font-semibold text-neutral-500">{inspection.evidencias.length} archivos</span></div>
          {photos.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{photos.slice(0, 6).map((photo, index) => <figure key={photo.id} className="overflow-hidden rounded-xl border border-neutral-200"><InspectionEvidenceImage inspectionId={inspection.id} evidenceId={photo.id} alt={photo.descripcion || photo.nombreOriginal} className="aspect-[4/3] w-full object-cover" /><figcaption className="p-3"><p className="text-sm font-bold text-[#10213A]">{String(index + 1).padStart(2, '0')}. {photo.nombreOriginal}</p><p className="mt-1 text-xs leading-relaxed text-neutral-600">{photo.descripcion || `Capturada ${new Date(photo.capturadaAt).toLocaleString('es-AR')}`}</p></figcaption></figure>)}</div> : <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-sm text-neutral-500"><Camera size={18} className="mr-2" />Aún no hay fotografías.</div>}
          {inspection.evidencias.some((item) => item.tipo !== 'FOTO') && <div className="mt-3 flex flex-wrap gap-2">{inspection.evidencias.filter((item) => item.tipo !== 'FOTO').map((item) => <span key={item.id} className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700">{item.tipo === 'AUDIO' ? <FileAudio className="shrink-0" size={16} /> : <FileText className="shrink-0" size={16} />}<span className="min-w-0 break-all">{item.nombreOriginal}</span></span>)}</div>}
        </div>

        <div>
          <h4 className="mb-3 font-extrabold text-[#10213A]">Hallazgos comparativos</h4>
          <div data-testid="comparison-ledger" className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <div className="hidden grid-cols-[minmax(150px,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-5 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-neutral-500 lg:grid">
              <span>Concepto</span><span>Declarado</span><span>Verificado</span><span className="text-right">Resultado</span>
            </div>
            {inspection.comparaciones.map((row) => (
              <article key={row.id} className={`grid min-w-0 gap-4 border-b border-neutral-200 px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(150px,0.9fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:gap-5 ${row.resultado === 'DIFIERE' ? 'border-l-2 border-l-error-500 bg-error-50/30 pl-[14px]' : ''}`}>
                <div className="flex min-w-0 items-start justify-between gap-3 lg:block">
                  <h5 className="min-w-0 break-words text-sm font-bold leading-relaxed text-[#10213A] [overflow-wrap:anywhere]">{row.etiqueta}</h5>
                  <div className="shrink-0 lg:hidden"><ComparisonStatus result={row.resultado} /></div>
                </div>
                <div className="min-w-0"><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500 lg:hidden">Declarado</p><p className="whitespace-pre-line break-words text-sm leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">{row.valorDeclarado || 'Sin dato'}</p></div>
                <div className="min-w-0"><p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500 lg:hidden">Verificado</p><p className="whitespace-pre-line break-words text-sm leading-relaxed text-neutral-700 [overflow-wrap:anywhere]">{row.valorObservado || 'No verificado'}</p>{row.observacion && <div className={`mt-2 border-l-2 pl-2 text-xs leading-relaxed ${row.resultado === 'DIFIERE' ? 'border-error-400 text-error-800' : 'border-neutral-300 text-neutral-600'}`}><span className="font-bold">Observación: </span>{row.observacion}</div>}</div>
                <div className="hidden items-start justify-end lg:flex"><ComparisonStatus result={row.resultado} /></div>
              </article>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h4 className="font-extrabold text-[#10213A]">Checklist del acta</h4><p className="mt-1 text-sm text-neutral-600">Resultado de cada control realizado en campo.</p></div><div className="flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-success-50 px-2.5 py-1 text-success-800">{complies} cumplen</span>{noComply.length > 0 && <span className="rounded-full bg-error-50 px-2.5 py-1 text-error-800">{noComply.length} no cumplen</span>}<span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">{notApplicable} no aplican</span>{pending > 0 && <span className="rounded-full bg-warning-50 px-2.5 py-1 text-warning-800">{pending} pendientes</span>}</div></div>
          <div data-testid="inspection-checklist-report" className="overflow-hidden rounded-xl border border-neutral-200">
            {checklistGroups.map((group) => {
              const rows = inspection.items.filter((item) => item.categoria === group);
              const groupFails = rows.filter((item) => item.resultado === 'NO_CUMPLE').length;
              return <section key={group} className="border-b border-neutral-200 last:border-0">
                <div className="flex items-center justify-between gap-3 bg-neutral-50 px-4 py-3"><h5 className="text-sm font-extrabold text-[#10213A]">{group}</h5><span className={`text-xs font-bold ${groupFails ? 'text-error-700' : 'text-neutral-500'}`}>{groupFails ? `${groupFails} sin cumplir` : `${rows.length} controles`}</span></div>
                {rows.map((item) => {
                  const isFail = item.resultado === 'NO_CUMPLE';
                  const icon = item.resultado === 'CUMPLE' ? <CheckCircle2 size={18} /> : isFail ? <XCircle size={18} /> : item.resultado === 'NO_APLICA' ? <CircleMinus size={18} /> : <AlertTriangle size={18} />;
                  const tone = item.resultado === 'CUMPLE' ? 'text-success-700' : isFail ? 'text-error-700' : item.resultado === 'PENDIENTE' ? 'text-warning-700' : 'text-neutral-500';
                  return <article key={item.id} data-result={item.resultado} className={`border-t border-neutral-100 px-4 py-3.5 first:border-0 ${isFail ? 'border-l-[3px] border-l-error-500 bg-error-50/30 pl-[13px]' : ''}`}>
                    <div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 shrink-0 ${tone}`}>{icon}</span><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-semibold leading-relaxed text-[#10213A] [overflow-wrap:anywhere]">{item.etiqueta}</p><p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{item.codigo}</p></div><ChecklistStatus result={item.resultado} /></div>{item.observacion && <div className={`mt-2 border-l-2 pl-2 text-xs leading-relaxed ${isFail ? 'border-error-400 text-error-800' : 'border-neutral-300 text-neutral-600'}`}><span className="font-bold">{isFail ? 'Hallazgo: ' : 'Observación: '}</span>{item.observacion}</div>}{(item.evidencias || []).length > 0 && <div className="mt-3"><p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Evidencia del control</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{(item.evidencias || []).map((evidence) => <figure key={evidence.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white"><InspectionEvidenceImage inspectionId={inspection.id} evidenceId={evidence.id} alt={evidence.descripcion || evidence.nombreOriginal} className="aspect-[4/3] w-full object-cover" /><figcaption className="truncate px-2 py-1.5 text-[11px] font-semibold text-neutral-600">{evidence.nombreOriginal}</figcaption></figure>)}</div></div>}</div></div>
                  </article>;
                })}
              </section>;
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReportKpi({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="min-w-0 bg-white px-4 py-3"><p className="text-xs font-semibold text-neutral-500">{label}</p><p className={`mt-1 text-2xl font-extrabold ${tone}`}>{value}</p></div>;
}

function ComparisonStatus({ result }: { result: Inspection['comparaciones'][number]['resultado'] }) {
  const color = result === 'COINCIDE' ? 'success' : result === 'DIFIERE' ? 'error' : result === 'PENDIENTE' ? 'warning' : 'neutral';
  return <Badge variant="soft" color={color} size="sm" className="whitespace-nowrap">{result === 'COINCIDE' ? <CheckCircle2 size={14} /> : result === 'DIFIERE' ? <AlertTriangle size={14} /> : null}{result.replace('_', ' ')}</Badge>;
}

function ChecklistStatus({ result }: { result: Inspection['items'][number]['resultado'] }) {
  const color = result === 'CUMPLE' ? 'success' : result === 'NO_CUMPLE' ? 'error' : result === 'PENDIENTE' ? 'warning' : 'neutral';
  const label = result === 'CUMPLE' ? 'Cumple' : result === 'NO_CUMPLE' ? 'No cumple' : result === 'NO_APLICA' ? 'No aplica' : 'Pendiente';
  return <Badge variant="soft" size="sm" color={color} className="w-fit shrink-0">{label}</Badge>;
}
