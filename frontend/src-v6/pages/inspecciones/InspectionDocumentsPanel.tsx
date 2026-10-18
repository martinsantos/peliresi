import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import type { InspectionActData, InspectionActorType, InspectionTechnicalReport } from '../../types/inspection';

interface Props {
  actData: InspectionActData;
  report: InspectionTechnicalReport;
  actEditable: boolean;
  reportEditable: boolean;
  reportFirst?: boolean;
  section?: 'acta' | 'informe';
  actorType?: InspectionActorType | null;
  onActDataChange: (value: InspectionActData) => void;
  onReportChange: (value: InspectionTechnicalReport) => void;
}

const inputClass = 'mt-2 min-h-12 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base font-normal text-neutral-900 focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50 disabled:text-neutral-600';
const gridClass = 'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2';
const groupClass = 'group/act border-t border-neutral-200';
const summaryClass = 'flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-neutral-900 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 [&::-webkit-details-marker]:hidden';
const groupTitle = (title: string) => <summary className={summaryClass}>{title}<ChevronDown aria-hidden size={18} className="shrink-0 text-neutral-600 group-open/act:rotate-180" /></summary>;

export const InspectionDocumentsPanel: React.FC<Props> = ({ actData, report, actEditable, reportEditable, reportFirst = false, section, actorType, onActDataChange, onReportChange }) => {
  const fieldPrefix = useId();
  const update = (key: keyof InspectionActData, value: string | number | undefined) => onActDataChange({ ...actData, [key]: value });
  const text = (key: keyof InspectionActData, label: string, multiline = false) => <div key={key} className={'text-sm font-medium text-neutral-700' + (multiline ? ' sm:col-span-2' : '')}><label htmlFor={fieldPrefix + key}>{label}</label>{multiline
    ? <textarea id={fieldPrefix + key} rows={key === 'requerimientos' ? 2 : 3} disabled={!actEditable} value={String(actData[key] ?? '')} onChange={(event) => update(key, event.target.value)} className={inputClass} />
    : <input id={fieldPrefix + key} disabled={!actEditable} value={String(actData[key] ?? '')} onChange={(event) => update(key, event.target.value)} className={inputClass} />}</div>;
  const select = (key: keyof InspectionActData, label: string, options: Array<[string, string]>, fallback = 'NO_VERIFICADO') => <label key={key} className="block text-sm font-medium text-neutral-700">{label}<select disabled={!actEditable} value={String(actData[key] || fallback)} onChange={(event) => update(key, event.target.value)} className={inputClass}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
  const operationalLabel = actorType === 'GENERADOR' ? 'Residuos generados y almacenamiento observado' : actorType === 'OPERADOR' ? 'Residuos recibidos y tratamientos observados' : actorType === 'TRANSPORTISTA' ? 'Carga y condiciones del transporte' : 'Materiales o residuos observados';
  const operationalTitle = actorType === 'GENERADOR' ? 'Detalle de generación y almacenamiento' : actorType === 'OPERADOR' ? 'Detalle de recepción y tratamiento' : actorType === 'TRANSPORTISTA' ? 'Detalle del transporte' : 'Detalle de materiales y lugar';
  const infrastructure = <>
    {select('infraestructura', 'Infraestructura', [['NO_VERIFICADO', 'No verificada'], ['SI', 'Sí'], ['NO', 'No']])}
    {text('estadoInfraestructura', 'Estado de las instalaciones')}
    {text('detalleInfraestructura', 'Instalaciones y condiciones observadas', true)}
  </>;
  const act = <div data-testid={'inspection-form-' + (actorType || 'HALLAZGO')}>
    <div className="pb-5">{text('requerimientos', 'Medidas o requerimientos indicados', true)}</div>
    <details className={groupClass}>{groupTitle(operationalTitle)}<div className={gridClass + ' pb-5'}>{text('motivoInspeccion', 'Motivo de la visita')}{text('generacion', operationalLabel, true)}</div></details>
    <details className={groupClass}>{groupTitle('Personas y lugar')}<div className={gridClass + ' pb-5'}>
      {text('atendidoPor', actorType ? 'Persona que atendió' : 'Persona presente o denunciante')}
      {text('cargoAtendido', 'Carácter o cargo')}{text('dniAtendido', 'Documento de identidad')}{text('area', 'Área interviniente')}
      {text('departamento', 'Departamento')}{text('calle', 'Calle')}{text('numeroDomicilio', 'Número')}{text('lugarAfectacion', 'Lugar afectado', true)}
    </div></details>
    {(actorType === 'GENERADOR' || actorType === 'OPERADOR') && <details className={groupClass}>{groupTitle(actorType === 'OPERADOR' ? 'Planta y tratamiento' : 'Establecimiento y almacenamiento')}<div className={gridClass + ' pb-5'}>{infrastructure}</div></details>}
    <details className={groupClass}>{groupTitle('Constancias de la visita')}<div className={gridClass + ' pb-5'}>
      {select('danosEstado', 'Daños a personas o bienes', [['NO_VERIFICADO', 'Pendiente de constatar'], ['NO_OBSERVADOS', 'No se observaron'], ['OBSERVADOS', 'Se observaron']])}
      {text('danosDetalle', 'Detalle de daños', true)}
      {select('tercerosTestigosEstado', 'Terceros y testigos', [['NO_VERIFICADO', 'Pendiente de constatar'], ['NO_IDENTIFICADOS', 'No se identificaron'], ['IDENTIFICADOS', 'Se identificaron']])}
      {text('tercerosTestigosDetalle', 'Identificación y participación', true)}
      {select('firmaIntervinienteEstado', 'Firma de la persona interviniente', [['PENDIENTE', 'Pendiente'], ['FIRMADA', 'Firma asentada en el acta'], ['NEGATIVA', 'Se negó a firmar'], ['IMPOSIBILIDAD', 'Imposibilidad de firmar'], ['AUSENTE', 'Sin persona presente para firmar']], 'PENDIENTE')}
      {text('firmaIntervinienteDetalle', 'Constancia de firma, negativa o imposibilidad', true)}
      {select('copiaActaEstado', 'Entrega de copia', [['PENDIENTE', 'Pendiente'], ['ENTREGADA', 'Copia entregada'], ['NEGATIVA_RECEPCION', 'Negativa a recibir copia'], ['NO_ENTREGADA', 'No entregada']], 'PENDIENTE')}
      {text('copiaActaDetalle', 'Constancia de entrega', true)}
    </div></details>
    <details className={groupClass}>{groupTitle('Documentación y comunicación')}<div className={gridClass + ' pb-5'}>
      {select('libroOperacionesEstado', 'Libro de Registro de Operaciones', [['NO_VERIFICADO', 'Pendiente de verificar'], ['EXHIBIDO', 'Exhibido y verificado'], ['NO_EXHIBIDO', 'No exhibido'], ['NO_DISPONIBLE', 'No disponible'], ['SECUESTRADO', 'Secuestrado por disposición competente'], ['NO_APLICA', 'No aplica']])}
      {text('libroOperacionesDetalle', 'Constancia del libro', true)}
      {text('actaAnterior', 'Acta antecedente')}{text('domicilioLegal', 'Domicilio legal constituido')}
      <label className="text-sm font-medium text-neutral-700">Plazo de descargo (días hábiles)<input type="number" min={0} max={365} disabled={!actEditable} value={actData.plazoDescargoDias ?? ''} onChange={(event) => update('plazoDescargoDias', event.target.value === '' ? undefined : Number(event.target.value))} className={inputClass} /></label>
      {select('notificacionEstado', 'Comunicación de lo actuado', [['PENDIENTE', 'Pendiente'], ['COMUNICADA_EN_ACTA', 'Informada en campo/acta'], ['CONSTANCIA_FORMAL', 'Constancia formal incorporada'], ['NO_REALIZADA', 'No realizada']], 'PENDIENTE')}
      {text('notificacionDetalle', 'Constancia de comunicación y derechos', true)}
    </div></details>
    {!['GENERADOR', 'OPERADOR'].includes(actorType || '') && (actData.infraestructura || actData.detalleInfraestructura || actData.estadoInfraestructura) && <details className={groupClass}>{groupTitle('Otros datos ya registrados')}<div className={gridClass}>{infrastructure}</div></details>}
  </div>;
  const reportFields: Array<[keyof InspectionTechnicalReport, string, number]> = [
    ['expedienteElectronico', 'Expediente electrónico', 0], ['objetivo', 'Objetivo', 2],
    ['antecedentes', 'Antecedentes', 3], ['evaluacion', 'Evaluación', 5],
    ['conclusion', 'Conclusión', 4], ['recomendacion', 'Recomendación', 3], ['referencias', 'Referencias y documentos', 2],
  ];
  const technical = <div className="space-y-6">{reportFields.map(([key, label, rows]) => <label key={key} className="block text-sm font-medium text-neutral-700">{label}{rows
    ? <textarea rows={rows} disabled={!reportEditable} value={report[key] || ''} onChange={(event) => onReportChange({ ...report, [key]: event.target.value })} className={inputClass} />
    : <input disabled={!reportEditable} value={report[key] || ''} onChange={(event) => onReportChange({ ...report, [key]: event.target.value })} className={inputClass} />}</label>)}</div>;
  if (section) return section === 'acta' ? act : technical;
  return <div className="space-y-6">{reportFirst ? <>{technical}{act}</> : <>{act}{technical}</>}</div>;
};
