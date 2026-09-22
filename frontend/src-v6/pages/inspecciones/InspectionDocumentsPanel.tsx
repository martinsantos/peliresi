import React from 'react';
import { ClipboardCheck, FileText, Scale } from 'lucide-react';
import { Card } from '../../components/ui/CardV2';
import type { InspectionActData, InspectionTechnicalReport } from '../../types/inspection';

interface Props {
  actData: InspectionActData;
  report: InspectionTechnicalReport;
  actEditable: boolean;
  reportEditable: boolean;
  onActDataChange: (value: InspectionActData) => void;
  onReportChange: (value: InspectionTechnicalReport) => void;
}

const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm font-normal text-neutral-900 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50 disabled:text-neutral-600';
const textareaClass = 'mt-1.5 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal leading-relaxed text-neutral-900 outline-none focus:border-primary-600 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50 disabled:text-neutral-600';

function countValues(value: Record<string, unknown>): number {
  return Object.values(value).filter((entry) => entry !== undefined && entry !== null && String(entry).trim() !== '').length;
}

export const InspectionDocumentsPanel: React.FC<Props> = ({ actData, report, actEditable, reportEditable, onActDataChange, onReportChange }) => {
  const actCount = countValues(actData as Record<string, unknown>);
  const reportCount = countValues(report as Record<string, unknown>);
  const actField = <Key extends keyof InspectionActData>(key: Key, value: InspectionActData[Key]) => onActDataChange({ ...actData, [key]: value });
  const reportField = <Key extends keyof InspectionTechnicalReport>(key: Key, value: InspectionTechnicalReport[Key]) => onReportChange({ ...report, [key]: value });

  return <Card className="!p-0 overflow-hidden">
    <div className="border-b border-neutral-200 px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><Scale size={20} /></span>
        <div><h3 className="font-extrabold text-[#10213A]">Documentación para dictamen</h3><p className="mt-1 text-xs leading-relaxed text-neutral-600">El acta levantada en la tablet y el informe técnico son documentos complementarios del mismo expediente. Se remiten juntos a Legales; ninguno reemplaza al otro.</p></div>
      </div>
    </div>

    <details className="group border-b border-neutral-200" open={actEditable && actCount === 0}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-neutral-50 sm:px-5">
        <ClipboardCheck size={18} className="shrink-0 text-primary-700" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#10213A]">Acta de inspección / constatación</span><span className="block text-xs text-neutral-500">Datos de campo, intervinientes, alcance y notificación</span></span>
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-600">{actCount} datos</span>
      </summary>
      <div className="border-t border-neutral-100 bg-neutral-50/40 px-4 py-4 sm:px-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-neutral-700">Atendido por<input disabled={!actEditable} value={actData.atendidoPor || ''} onChange={(event) => actField('atendidoPor', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Cargo<input disabled={!actEditable} value={actData.cargoAtendido || ''} onChange={(event) => actField('cargoAtendido', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-neutral-700">DNI de quien atiende<input disabled={!actEditable} value={actData.dniAtendido || ''} onChange={(event) => actField('dniAtendido', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Área interviniente<input disabled={!actEditable} value={actData.area || ''} onChange={(event) => actField('area', event.target.value)} placeholder="Ej. Residuos Peligrosos" className={inputClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Departamento<input disabled={!actEditable} value={actData.departamento || ''} onChange={(event) => actField('departamento', event.target.value)} className={inputClass} /></label>
          <div className="grid grid-cols-[1fr_92px] gap-2"><label className="text-xs font-bold text-neutral-700">Calle<input disabled={!actEditable} value={actData.calle || ''} onChange={(event) => actField('calle', event.target.value)} className={inputClass} /></label><label className="text-xs font-bold text-neutral-700">Número<input disabled={!actEditable} value={actData.numeroDomicilio || ''} onChange={(event) => actField('numeroDomicilio', event.target.value)} className={inputClass} /></label></div>
          <label className="text-xs font-bold text-neutral-700 sm:col-span-2">Motivo de inspección<textarea disabled={!actEditable} value={actData.motivoInspeccion || ''} onChange={(event) => actField('motivoInspeccion', event.target.value)} rows={2} className={textareaClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Lugar de afectación<textarea disabled={!actEditable} value={actData.lugarAfectacion || ''} onChange={(event) => actField('lugarAfectacion', event.target.value)} rows={2} className={textareaClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Infraestructura<select disabled={!actEditable} value={actData.infraestructura || 'NO_VERIFICADO'} onChange={(event) => actField('infraestructura', event.target.value as InspectionActData['infraestructura'])} className={inputClass}><option value="NO_VERIFICADO">No verificada</option><option value="SI">Sí</option><option value="NO">No</option></select></label>
          <label className="text-xs font-bold text-neutral-700">Detalle de infraestructura<textarea disabled={!actEditable} value={actData.detalleInfraestructura || ''} onChange={(event) => actField('detalleInfraestructura', event.target.value)} rows={2} className={textareaClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Estado de infraestructura<textarea disabled={!actEditable} value={actData.estadoInfraestructura || ''} onChange={(event) => actField('estadoInfraestructura', event.target.value)} rows={2} className={textareaClass} /></label>
          <label className="text-xs font-bold text-neutral-700 sm:col-span-2">Generación o corrientes observadas<textarea disabled={!actEditable} value={actData.generacion || ''} onChange={(event) => actField('generacion', event.target.value)} rows={2} className={textareaClass} /></label>
          <label className="text-xs font-bold text-neutral-700 sm:col-span-2">Requerimientos expresos<textarea disabled={!actEditable} value={actData.requerimientos || ''} onChange={(event) => actField('requerimientos', event.target.value)} rows={3} placeholder="Sólo lo indicado por el inspector; el sistema no lo infiere" className={textareaClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Acta antecedente o continuada<input disabled={!actEditable} value={actData.actaAnterior || ''} onChange={(event) => actField('actaAnterior', event.target.value)} className={inputClass} /></label>
          <label className="text-xs font-bold text-neutral-700">Plazo de descargo (días hábiles)<input disabled={!actEditable} type="number" min={0} max={365} value={actData.plazoDescargoDias ?? ''} onChange={(event) => actField('plazoDescargoDias', event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></label>
        </div>
      </div>
    </details>

    <details className="group" open={reportEditable && reportCount === 0}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-neutral-50 sm:px-5">
        <FileText size={18} className="shrink-0 text-blue-700" />
        <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#10213A]">Informe técnico</span><span className="block text-xs text-neutral-500">Objetivo, antecedentes, evaluación, conclusión y recomendación</span></span>
        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold text-neutral-600">{reportCount}/7</span>
      </summary>
      <div className="space-y-3 border-t border-neutral-100 bg-neutral-50/40 px-4 py-4 sm:px-5">
        <label className="block text-xs font-bold text-neutral-700">Expediente electrónico<input disabled={!reportEditable} value={report.expedienteElectronico || ''} onChange={(event) => reportField('expedienteElectronico', event.target.value)} placeholder="EX-…" className={inputClass} /></label>
        <label className="block text-xs font-bold text-neutral-700">Referencias y documentos de orden<textarea disabled={!reportEditable} value={report.referencias || ''} onChange={(event) => reportField('referencias', event.target.value)} rows={2} className={textareaClass} /></label>
        <label className="block text-xs font-bold text-neutral-700">1. Objetivo<textarea disabled={!reportEditable} value={report.objetivo || ''} onChange={(event) => reportField('objetivo', event.target.value)} rows={2} className={textareaClass} /></label>
        <label className="block text-xs font-bold text-neutral-700">2. Antecedentes<textarea disabled={!reportEditable} value={report.antecedentes || ''} onChange={(event) => reportField('antecedentes', event.target.value)} rows={4} className={textareaClass} /></label>
        <label className="block text-xs font-bold text-neutral-700">3. Evaluación<textarea disabled={!reportEditable} value={report.evaluacion || ''} onChange={(event) => reportField('evaluacion', event.target.value)} rows={5} className={textareaClass} /></label>
        <label className="block text-xs font-bold text-neutral-700">4. Conclusión<textarea disabled={!reportEditable} value={report.conclusion || ''} onChange={(event) => reportField('conclusion', event.target.value)} rows={4} placeholder="No se completa automáticamente" className={textareaClass} /></label>
        <label className="block text-xs font-bold text-neutral-700">5. Recomendación<textarea disabled={!reportEditable} value={report.recomendacion || ''} onChange={(event) => reportField('recomendacion', event.target.value)} rows={3} placeholder="No se completa automáticamente" className={textareaClass} /></label>
      </div>
    </details>
  </Card>;
};
