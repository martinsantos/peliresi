/**
 * Step Resumen — Summary/confirmation before submitting
 */
import React from 'react';
import { Check } from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import type { RegistrationData, TipoActor } from '../shared';
import type { DocumentoSolicitud } from '../../../../types/api';
import { ZONAS } from '../../../../utils/calculoTEF';
import { RegistrationFleetSummary } from '../../../../components/registration/RegistrationFleetSummary';

interface StepResumenProps {
  reg: RegistrationData;
  form: Record<string, string>;
  adjuntos: Record<string, File>;
  uploadedDocs: Record<string, DocumentoSolicitud>;
  tipoActor: TipoActor;
  isGenerador: boolean;
  isOperador: boolean;
  isTransportista: boolean;
  regError: string | null;
}

export const StepResumen: React.FC<StepResumenProps> = ({
  reg,
  form,
  adjuntos,
  uploadedDocs,
  tipoActor,
  isGenerador,
  isOperador,
  isTransportista,
  regError,
}) => {
  const sections: { label: string; fields: { label: string; value: string }[] }[] = [];

  // Account info
  sections.push({
    label: 'Cuenta',
    fields: [
      { label: 'Nombre', value: reg.nombre },
      { label: 'Email', value: reg.email },
      { label: 'CUIT', value: reg.cuit },
      { label: 'Tipo', value: tipoActor },
    ],
  });

  // Establecimiento
  const estFields = [
    { label: 'Razon Social', value: form.razonSocial || '' },
    { label: 'Domicilio', value: form.domicilio || '' },
    { label: 'Telefono', value: form.telefono || '' },
    { label: 'Email contacto', value: form.emailContacto || '' },
  ];
  if (isGenerador) {
    estFields.push({ label: 'Actividad', value: form.actividad || '' });
    estFields.push({ label: 'Rubro', value: form.rubro || '' });
  } else if (isOperador) {
    estFields.push({ label: 'Tipo Operador', value: form.tipoOperador || '' });
    estFields.push({ label: 'Tecnologia', value: form.tecnologia || '' });
  }
  sections.push({ label: 'Establecimiento', fields: estFields });

  // Regulatorio
  const regFields: { label: string; value: string }[] = [];
  if (isGenerador) {
    regFields.push(
      { label: 'N Inscripcion', value: form.numeroInscripcion || '' },
      { label: 'Categoria', value: form.categoria || '' },
      { label: 'Expediente', value: form.expedienteInscripcion || '' },
      { label: 'Resolucion', value: form.resolucionInscripcion || '' },
    );
  } else if (isOperador) {
    regFields.push(
      { label: 'N Habilitacion', value: form.numeroHabilitacion || '' },
      { label: 'Categoria', value: form.categoria || '' },
      { label: 'Expediente', value: form.expedienteInscripcion || '' },
      { label: 'Certificado N', value: form.certificadoNumero || '' },
      { label: 'Resolucion DPA', value: form.resolucionDPA || '' },
      { label: 'Vencimiento habilitacion', value: form.vencimientoHabilitacion || '' },
    );
  }
  if (regFields.length > 0) {
    sections.push({ label: 'Regulatorio', fields: regFields });
  }

  // Domicilios (generador + operador only)
  if (!isTransportista) {
    sections.push({
      label: 'Domicilios',
      fields: [
        { label: 'Legal - Calle', value: form.domicilioLegalCalle || '' },
        { label: 'Legal - Localidad', value: form.domicilioLegalLocalidad || '' },
        { label: 'Legal - Depto', value: form.domicilioLegalDepto || '' },
        { label: 'Real - Calle', value: form.domicilioRealCalle || '' },
        { label: 'Real - Localidad', value: form.domicilioRealLocalidad || '' },
        { label: 'Real - Depto', value: form.domicilioRealDepto || '' },
      ],
    });
  }

  // Operador-specific
  if (isOperador) {
    sections.push({
      label: 'Representantes',
      fields: [
        { label: 'Legal - Nombre', value: form.representanteLegalNombre || '' },
        { label: 'Legal - DNI', value: form.representanteLegalDNI || '' },
        { label: 'Legal - Telefono', value: form.representanteLegalTelefono || '' },
        { label: 'Tecnico - Nombre', value: form.representanteTecnicoNombre || '' },
        { label: 'Tecnico - Matricula', value: form.representanteTecnicoMatricula || '' },
        { label: 'Tecnico - Telefono', value: form.representanteTecnicoTelefono || '' },
      ],
    });
    sections.push({
      label: 'Corrientes',
      fields: [
        { label: 'Corrientes Y', value: form.corrientesY || '' },
      ],
    });
  } else if (isGenerador) {
    sections.push({
      label: 'Adicional',
      fields: [
        { label: 'Corrientes Control', value: form.corrientesControl || '' },
        { label: 'Categoria Individual', value: form.categoriaIndividual || '' },
        { label: 'Libro Operatoria', value: form.libroOperatoria || '' },
        { label: 'Certificacion ISO', value: form.certificacionISO || '' },
      ],
    });
  }

  // Operational declarations only. Never present a calculated fee to applicants.
  if (!isTransportista) {
    const tefFields: { label: string; value: string }[] = [
      { label: 'Personal', value: form.tefPersonal || '' },
      { label: 'Superficie (m2)', value: form.tefSuperficie || '' },
      { label: 'Potencia (HP)', value: form.tefPotencia || '' },
      { label: 'Zona', value: ZONAS.find(zona => zona.id === form.tefZona)?.label || form.tefZona || '' },
    ];
    if (isOperador) tefFields.push({ label: 'Capacidad (tn/mes)', value: form.tefCapacidad || '' });
    sections.push({ label: 'Actividad', fields: tefFields });
  }

  // Transportista-specific
  if (isTransportista) {
    sections.push({
      label: 'Habilitacion DPA',
      fields: [
        { label: 'Habilitacion', value: form.numeroHabilitacion || '' },
        { label: 'Vencimiento', value: form.vencimientoHabilitacion || '' },
        { label: 'Expediente DPA', value: form.expedienteDPA || '' },
        { label: 'Resolucion DPA', value: form.resolucionDPA || '' },
        { label: 'Resolucion SSP', value: form.resolucionSSP || '' },
        { label: 'Corrientes', value: form.corrientesAutorizadas || '' },
        { label: 'Acta Inspeccion', value: form.actaInspeccion || '' },
        { label: 'Acta Inspeccion 2', value: form.actaInspeccion2 || '' },
        { label: 'Localidad', value: form.localidad || '' },
        { label: 'Coordenadas', value: form.coordenadas || '' },
      ],
    });
    if (form.vehiculosDesc || form.choferesDesc) {
      sections.push({
        label: 'Vehiculos y Choferes',
        fields: [
          { label: 'Vehiculos', value: form.vehiculosDesc || '' },
          { label: 'Choferes', value: form.choferesDesc || '' },
        ],
      });
    }
  }

  // Documents
  const docEntries = [
    ...Object.entries(uploadedDocs).map(([tipo, document]) => [tipo, { name: document.nombre, size: document.size, saved: true }] as const),
    ...Object.entries(adjuntos)
      .filter(([tipo]) => !uploadedDocs[tipo])
      .map(([tipo, file]) => [tipo, { name: file.name, size: file.size, saved: false }] as const),
  ];
  if (docEntries.length > 0) {
    sections.push({
      label: 'Documentos adjuntos',
      fields: docEntries.map(([tipo, file]) => ({
        label: tipo.replace(/_/g, ' '),
        value: `${file.name} (${(file.size / 1024).toFixed(0)} KB)${file.saved ? ' · Guardado' : ' · Pendiente'}`,
      })),
    });
  }

  return (
    <div className="space-y-4">
      <SectionTitle icon={Check} title="Resumen de la Solicitud" />
      <p className="text-sm text-neutral-500">
        Revisá los datos; podés corregirlos en cada paso.
      </p>

      {regError && (
        <div role="alert" className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
          {regError}
        </div>
      )}

      {sections.map(section => (
        <div key={section.label} className="rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
            <h4 className="text-sm font-semibold text-neutral-700">{section.label}</h4>
          </div>
          <dl className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {section.fields
              .filter(f => f.value)
              .map(f => (
                <div key={f.label} className="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 text-sm py-0.5">
                  <dt className="text-neutral-600">{f.label}</dt>
                  <dd className="min-w-0 text-neutral-900 font-medium text-right [overflow-wrap:anywhere]">{f.value}</dd>
                </div>
              ))}
            {section.fields.every(f => !f.value) && (
              <div className="text-sm text-neutral-600 italic sm:col-span-2"><dt className="sr-only">Datos de {section.label}</dt><dd>Sin datos ingresados</dd></div>
            )}
          </dl>
        </div>
      ))}
      {isTransportista && <RegistrationFleetSummary form={form} />}
    </div>
  );
};
