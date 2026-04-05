/**
 * Step Resumen — Summary/confirmation before submitting
 */
import React from 'react';
import { Check } from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import type { RegistrationData, TipoActor } from '../shared';

interface StepResumenProps {
  reg: RegistrationData;
  form: Record<string, string>;
  adjuntos: Record<string, File>;
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

  // TEF
  if (!isTransportista) {
    const tefFields: { label: string; value: string }[] = [
      { label: 'Factor R', value: form.factorR || '' },
      { label: 'Monto MxR', value: form.montoMxR ? `$ ${form.montoMxR}` : '' },
      { label: 'Personal', value: form.tefPersonal || '' },
      { label: 'Superficie (m2)', value: form.tefSuperficie || '' },
      { label: 'Zona', value: form.tefZona || '' },
    ];
    if (isGenerador) tefFields.push({ label: 'Potencia (HP)', value: form.tefPotencia || '' });
    if (isOperador) tefFields.push({ label: 'Capacidad (tn/mes)', value: form.tefCapacidad || '' });
    sections.push({ label: 'Calculo TEF', fields: tefFields });
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
  const docEntries = Object.entries(adjuntos);
  if (docEntries.length > 0) {
    sections.push({
      label: 'Documentos adjuntos',
      fields: docEntries.map(([tipo, file]) => ({
        label: tipo.replace(/_/g, ' '),
        value: `${file.name} (${(file.size / 1024).toFixed(0)} KB)`,
      })),
    });
  }

  return (
    <div className="space-y-4">
      <SectionTitle icon={Check} title="Resumen de la Solicitud" />
      <p className="text-sm text-neutral-500">
        Revise los datos antes de enviar. Podra volver a pasos anteriores para corregir.
      </p>

      {regError && (
        <div className="bg-error-50 border border-error-200 rounded-xl p-3 text-sm text-error-700">
          {regError}
        </div>
      )}

      {sections.map(section => (
        <div key={section.label} className="rounded-xl border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
            <h4 className="text-sm font-semibold text-neutral-700">{section.label}</h4>
          </div>
          <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {section.fields
              .filter(f => f.value)
              .map(f => (
                <div key={f.label} className="flex justify-between text-sm py-0.5">
                  <span className="text-neutral-500">{f.label}</span>
                  <span className="text-neutral-900 font-medium text-right max-w-[60%] truncate">{f.value}</span>
                </div>
              ))}
            {section.fields.every(f => !f.value) && (
              <p className="text-sm text-neutral-400 italic col-span-2">Sin datos ingresados</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
