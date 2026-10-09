/**
 * Step Empresa — Establishment/regulatory/domicilios/additional data
 * Renders the correct step content for generador, operador, or transportista.
 */
import React from 'react';
import {
  Factory, FlaskConical, ClipboardList, MapPin, Users, Shield,
  Truck, Car,
} from 'lucide-react';
import { SectionTitle } from '../SectionTitle';
import { FieldError } from '../FieldError';
import { Select } from '../../../../components/ui/Select';
import {
  DEPARTAMENTOS_MENDOZA,
  CATEGORIAS_GENERADOR,
  inputCls,
  labelCls,
} from '../shared';

interface StepEmpresaProps {
  step: number;
  form: Record<string, string>;
  up: (field: string, value: string) => void;
  attempted: Set<number>;
  isGenerador: boolean;
  isOperador: boolean;
  isTransportista: boolean;
}

export const StepEmpresa: React.FC<StepEmpresaProps> = ({
  step,
  form,
  up,
  attempted,
  isGenerador,
  isOperador,
  isTransportista,
}) => {
  if (isGenerador) return renderGeneradorStep(step, form, up, attempted);
  if (isOperador) return renderOperadorStep(step, form, up, attempted);
  if (isTransportista) return renderTransportistaStep(step, form, up, attempted);
  return null;
};

// ── Generador Steps 1-4 ──
function renderGeneradorStep(
  step: number,
  form: Record<string, string>,
  up: (f: string, v: string) => void,
  attempted: Set<number>,
): React.ReactNode {
  switch (step) {
    case 1: return (
      <div className="space-y-4">
        <SectionTitle icon={Factory} title="Datos del Establecimiento" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-razonSocial" className={labelCls}>Razon Social *</label>
            <input id="registration-razonSocial" autoComplete="organization" value={form.razonSocial || ''} onChange={e => up('razonSocial', e.target.value)}
              placeholder="Empresa S.A." className={inputCls(attempted.has(1) && !form.razonSocial?.trim())} />
            <FieldError show={attempted.has(1) && !form.razonSocial?.trim()} msg="Razon Social es obligatoria" />
          </div>
          <div>
            <label htmlFor="registration-domicilio" className={labelCls}>Domicilio</label>
            <input id="registration-domicilio" value={form.domicilio || ''} onChange={e => up('domicilio', e.target.value)}
              placeholder="Calle 123, Ciudad" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-telefono" className={labelCls}>Telefono</label>
            <input id="registration-telefono" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono || ''} onChange={e => up('telefono', e.target.value)}
              placeholder="0261-4XXXXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-emailContacto" className={labelCls}>Email de contacto</label>
            <input id="registration-emailContacto" autoComplete="email" type="email" value={form.emailContacto || ''} onChange={e => up('emailContacto', e.target.value)}
              placeholder="contacto@empresa.com" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-actividad" className={labelCls}>Actividad</label>
            <input id="registration-actividad" value={form.actividad || ''} onChange={e => up('actividad', e.target.value)}
              placeholder="Ej: Fabricacion de pinturas" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-rubro" className={labelCls}>Rubro</label>
            <input id="registration-rubro" value={form.rubro || ''} onChange={e => up('rubro', e.target.value)}
              placeholder="Ej: Industria quimica" className={inputCls()} />
          </div>
        </div>
      </div>
    );

    case 2: return (
      <div className="space-y-4">
        <SectionTitle icon={ClipboardList} title="Datos Regulatorios" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-numeroInscripcion" className={labelCls}>N de Inscripcion</label>
            <input id="registration-numeroInscripcion" value={form.numeroInscripcion || ''} onChange={e => up('numeroInscripcion', e.target.value)}
              placeholder="G-000XXX" className={inputCls()} />
          </div>
          <div>
            <Select label="Categoria" value={form.categoria || ''} onChange={(val) => up('categoria', val)} options={[{ value: '', label: 'Seleccionar...' }, ...CATEGORIAS_GENERADOR.map(c => ({ value: c, label: c }))]} size="base" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-expedienteInscripcion" className={labelCls}>Expediente Inscripcion</label>
            <input id="registration-expedienteInscripcion" value={form.expedienteInscripcion || ''} onChange={e => up('expedienteInscripcion', e.target.value)}
              placeholder="EXP-XXXX-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-resolucionInscripcion" className={labelCls}>Resolucion Inscripcion</label>
            <input id="registration-resolucionInscripcion" value={form.resolucionInscripcion || ''} onChange={e => up('resolucionInscripcion', e.target.value)}
              placeholder="RES-XXXX" className={inputCls()} />
          </div>
        </div>
      </div>
    );

    case 3: return renderDomicilios(form, up);

    case 4: return (
      <div className="space-y-4">
        <SectionTitle icon={Shield} title="Datos Adicionales" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-corrientesControl" className={labelCls}>Corrientes de Control</label>
            <input id="registration-corrientesControl" value={form.corrientesControl || ''} onChange={e => up('corrientesControl', e.target.value)}
              placeholder="Y1, Y2, Y3..." className={inputCls()} />
          </div>
          <div>
            <Select label="Categoria Individual" value={form.categoriaIndividual || ''} onChange={(val) => up('categoriaIndividual', val)} options={[{ value: '', label: 'Seleccionar...' }, { value: 'MINIMA', label: 'Minima' }, { value: 'INDIVIDUAL', label: 'Individual' }, { value: '2000-3000', label: '2000-3000' }]} size="base" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-libroOperatoria" className={labelCls}>Libro de Operatoria</label>
            <input id="registration-libroOperatoria" value={form.libroOperatoria || ''} onChange={e => up('libroOperatoria', e.target.value)}
              placeholder="N de libro" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-certificacionISO" className={labelCls}>Certificacion ISO</label>
            <input id="registration-certificacionISO" type="date" value={form.certificacionISO || ''} onChange={e => up('certificacionISO', e.target.value)}
              className={inputCls()} />
          </div>
        </div>
      </div>
    );

    default: return null;
  }
}

// ── Operador Steps 1-5 ──
function renderOperadorStep(
  step: number,
  form: Record<string, string>,
  up: (f: string, v: string) => void,
  attempted: Set<number>,
): React.ReactNode {
  switch (step) {
    case 1: return (
      <div className="space-y-4">
        <SectionTitle icon={FlaskConical} title="Datos del Establecimiento" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-razonSocial" className={labelCls}>Razon Social *</label>
            <input id="registration-razonSocial" autoComplete="organization" value={form.razonSocial || ''} onChange={e => up('razonSocial', e.target.value)}
              placeholder="Operador S.A." className={inputCls(attempted.has(1) && !form.razonSocial?.trim())} />
            <FieldError show={attempted.has(1) && !form.razonSocial?.trim()} msg="Razon Social es obligatoria" />
          </div>
          <div>
            <label htmlFor="registration-domicilio" className={labelCls}>Domicilio</label>
            <input id="registration-domicilio" value={form.domicilio || ''} onChange={e => up('domicilio', e.target.value)}
              placeholder="Calle 123, Ciudad" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-telefono" className={labelCls}>Telefono</label>
            <input id="registration-telefono" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono || ''} onChange={e => up('telefono', e.target.value)}
              placeholder="0261-4XXXXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-emailContacto" className={labelCls}>Email de contacto</label>
            <input id="registration-emailContacto" autoComplete="email" type="email" value={form.emailContacto || ''} onChange={e => up('emailContacto', e.target.value)}
              placeholder="contacto@operador.com" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Select label="Tipo de Operador" value={form.tipoOperador || ''} onChange={(val) => up('tipoOperador', val)} options={[{ value: '', label: 'Seleccionar...' }, { value: 'FIJO', label: 'Planta fija' }, { value: 'IN_SITU', label: 'Operador in situ' }, ...(form.tipoOperador && !['FIJO', 'IN_SITU'].includes(form.tipoOperador) ? [{ value: form.tipoOperador, label: `Dato previo: ${form.tipoOperador}` }] : [])]} size="base" />
          </div>
          <div>
            <label htmlFor="registration-tecnologia" className={labelCls}>Tecnologia</label>
            <input id="registration-tecnologia" value={form.tecnologia || ''} onChange={e => up('tecnologia', e.target.value)}
              placeholder="Ej: Incineracion, neutralizacion" className={inputCls()} />
          </div>
        </div>
      </div>
    );

    case 2: return (
      <div className="space-y-4">
        <SectionTitle icon={ClipboardList} title="Datos Regulatorios" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-numeroHabilitacion" className={labelCls}>N de Habilitacion</label>
            <input id="registration-numeroHabilitacion" value={form.numeroHabilitacion || ''} onChange={e => up('numeroHabilitacion', e.target.value)}
              placeholder="HAB-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-categoria" className={labelCls}>Categoria</label>
            <input id="registration-categoria" value={form.categoria || ''} onChange={e => up('categoria', e.target.value)}
              placeholder="Categoria del operador" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-expedienteInscripcion" className={labelCls}>Expediente Inscripcion</label>
            <input id="registration-expedienteInscripcion" value={form.expedienteInscripcion || ''} onChange={e => up('expedienteInscripcion', e.target.value)}
              placeholder="EXP-XXXX-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-certificadoNumero" className={labelCls}>Certificado Numero</label>
            <input id="registration-certificadoNumero" value={form.certificadoNumero || ''} onChange={e => up('certificadoNumero', e.target.value)}
              placeholder="CERT-XXXX" className={inputCls()} />
          </div>
        </div>
        <div>
          <label htmlFor="registration-resolucionDPA" className={labelCls}>Resolucion DPA</label>
          <input id="registration-resolucionDPA" value={form.resolucionDPA || ''} onChange={e => up('resolucionDPA', e.target.value)}
            placeholder="RES-DPA-XXXX" className={inputCls()} />
        </div>
      </div>
    );

    case 3: return renderDomicilios(form, up);

    case 4: return (
      <div className="space-y-4">
        <SectionTitle icon={Users} title="Representantes" />
        <h4 className="text-sm font-semibold text-neutral-700">Representante Legal</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="registration-representanteLegalNombre" className={labelCls}>Nombre</label>
            <input id="registration-representanteLegalNombre" value={form.representanteLegalNombre || ''} onChange={e => up('representanteLegalNombre', e.target.value)}
              placeholder="Nombre completo" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-representanteLegalDNI" className={labelCls}>DNI</label>
            <input id="registration-representanteLegalDNI" inputMode="numeric" value={form.representanteLegalDNI || ''} onChange={e => up('representanteLegalDNI', e.target.value)}
              placeholder="12345678" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-representanteLegalTelefono" className={labelCls}>Telefono</label>
            <input id="registration-representanteLegalTelefono" type="tel" inputMode="tel" autoComplete="tel" value={form.representanteLegalTelefono || ''} onChange={e => up('representanteLegalTelefono', e.target.value)}
              placeholder="0261-XXXXXXX" className={inputCls()} />
          </div>
        </div>

        <h4 className="text-sm font-semibold text-neutral-700 mt-4">Representante Tecnico</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="registration-representanteTecnicoNombre" className={labelCls}>Nombre</label>
            <input id="registration-representanteTecnicoNombre" value={form.representanteTecnicoNombre || ''} onChange={e => up('representanteTecnicoNombre', e.target.value)}
              placeholder="Nombre completo" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-representanteTecnicoMatricula" className={labelCls}>Matricula</label>
            <input id="registration-representanteTecnicoMatricula" value={form.representanteTecnicoMatricula || ''} onChange={e => up('representanteTecnicoMatricula', e.target.value)}
              placeholder="MAT-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-representanteTecnicoTelefono" className={labelCls}>Telefono</label>
            <input id="registration-representanteTecnicoTelefono" type="tel" inputMode="tel" autoComplete="tel" value={form.representanteTecnicoTelefono || ''} onChange={e => up('representanteTecnicoTelefono', e.target.value)}
              placeholder="0261-XXXXXXX" className={inputCls()} />
          </div>
        </div>
      </div>
    );

    case 5: return (
      <div className="space-y-4">
        <SectionTitle icon={Shield} title="Corrientes de Residuos (Y)" />
        <p className="text-sm text-neutral-500">
          Indique las corrientes de residuos que el operador esta habilitado a recibir y tratar.
        </p>
        <div>
          <label htmlFor="registration-corrientesY" className={labelCls}>Corrientes Y</label>
          <textarea id="registration-corrientesY"
            value={form.corrientesY || ''}
            onChange={e => up('corrientesY', e.target.value)}
            placeholder="Y1, Y2, Y3... (separadas por coma)"
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-base sm:text-sm bg-white transition-colors resize-none"
          />
        </div>
      </div>
    );

    default: return null;
  }
}

// ── Transportista Steps 1-3 ──
function renderTransportistaStep(
  step: number,
  form: Record<string, string>,
  up: (f: string, v: string) => void,
  attempted: Set<number>,
): React.ReactNode {
  switch (step) {
    case 1: return (
      <div className="space-y-4">
        <SectionTitle icon={Truck} title="Datos del Transportista" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-razonSocial" className={labelCls}>Razon Social *</label>
            <input id="registration-razonSocial" autoComplete="organization" value={form.razonSocial || ''} onChange={e => up('razonSocial', e.target.value)}
              placeholder="Transporte S.A." className={inputCls(attempted.has(1) && !form.razonSocial?.trim())} />
            <FieldError show={attempted.has(1) && !form.razonSocial?.trim()} msg="Razon Social es obligatoria" />
          </div>
          <div>
            <label htmlFor="registration-domicilio" className={labelCls}>Domicilio</label>
            <input id="registration-domicilio" value={form.domicilio || ''} onChange={e => up('domicilio', e.target.value)}
              placeholder="Calle 123, Ciudad" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-telefono" className={labelCls}>Telefono</label>
            <input id="registration-telefono" type="tel" inputMode="tel" autoComplete="tel" value={form.telefono || ''} onChange={e => up('telefono', e.target.value)}
              placeholder="0261-4XXXXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-emailContacto" className={labelCls}>Email de contacto</label>
            <input id="registration-emailContacto" autoComplete="email" type="email" value={form.emailContacto || ''} onChange={e => up('emailContacto', e.target.value)}
              placeholder="contacto@transporte.com" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-localidad" className={labelCls}>Localidad</label>
            <input id="registration-localidad" value={form.localidad || ''} onChange={e => up('localidad', e.target.value)}
              placeholder="Godoy Cruz, Mendoza" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-coordenadas" className={labelCls}>Coordenadas</label>
            <input id="registration-coordenadas" value={form.coordenadas || ''} onChange={e => up('coordenadas', e.target.value)}
              placeholder="-32.89, -68.83" className={inputCls()} />
          </div>
        </div>
      </div>
    );
    case 2: return (
      <div className="space-y-4">
        <SectionTitle icon={Shield} title="Habilitacion y Datos DPA" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-numeroHabilitacion" className={labelCls}>N de Habilitacion</label>
            <input id="registration-numeroHabilitacion" value={form.numeroHabilitacion || ''} onChange={e => up('numeroHabilitacion', e.target.value)}
              placeholder="HAB-TR-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-vencimientoHabilitacion" className={labelCls}>Vencimiento Habilitacion</label>
            <input id="registration-vencimientoHabilitacion" type="date" value={form.vencimientoHabilitacion || ''} onChange={e => up('vencimientoHabilitacion', e.target.value)} className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-expedienteDPA" className={labelCls}>Expediente DPA</label>
            <input id="registration-expedienteDPA" value={form.expedienteDPA || ''} onChange={e => up('expedienteDPA', e.target.value)} placeholder="EXP-DPA-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-resolucionDPA" className={labelCls}>Resolucion DPA</label>
            <input id="registration-resolucionDPA" value={form.resolucionDPA || ''} onChange={e => up('resolucionDPA', e.target.value)} placeholder="0359/24" className={inputCls()} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="registration-resolucionSSP" className={labelCls}>Resolucion SSP</label>
            <input id="registration-resolucionSSP" value={form.resolucionSSP || ''} onChange={e => up('resolucionSSP', e.target.value)} placeholder="SSP-XXXX" className={inputCls()} />
          </div>
          <div>
            <label htmlFor="registration-corrientesAutorizadas" className={labelCls}>Corrientes Autorizadas</label>
            <input id="registration-corrientesAutorizadas" value={form.corrientesAutorizadas || ''} onChange={e => up('corrientesAutorizadas', e.target.value)} placeholder="Y4, Y8, Y9" className={inputCls()} />
          </div>
        </div>
      </div>
    );
    case 3: return (
      <div className="space-y-4">
        <SectionTitle icon={Car} title="Vehiculos y Choferes" />
        <p className="text-sm text-neutral-500">
          Describa los vehiculos y choferes habilitados. Un dato por linea.
        </p>
        <div>
          <label htmlFor="registration-vehiculosDesc" className={labelCls}>Vehiculos (patente, marca, modelo, capacidad — uno por linea)</label>
          <textarea id="registration-vehiculosDesc" value={form.vehiculosDesc || ''} onChange={e => up('vehiculosDesc', e.target.value)}
            placeholder={"AB123CD, Mercedes, Atego 1726, 10 tn\nXY456ZW, Iveco, Tector, 8 tn"} rows={5}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-base sm:text-sm bg-white transition-colors resize-none font-mono" />
        </div>
        <div>
          <label htmlFor="registration-choferesDesc" className={labelCls}>Choferes (nombre, DNI, licencia — uno por linea)</label>
          <textarea id="registration-choferesDesc" value={form.choferesDesc || ''} onChange={e => up('choferesDesc', e.target.value)}
            placeholder={"Juan Perez, 12345678, LIC-001\nMaria Lopez, 87654321, LIC-002"} rows={4}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-base sm:text-sm bg-white transition-colors resize-none font-mono" />
        </div>
      </div>
    );
    default: return null;
  }
}

// ── Shared domicilios sub-step (generador step 3, operador step 3) ──
function renderDomicilios(form: Record<string, string>, up: (f: string, v: string) => void): React.ReactNode {
  return (
    <div className="space-y-4">
      <SectionTitle icon={MapPin} title="Domicilios" />
      <h4 className="text-sm font-semibold text-neutral-700">Domicilio Legal</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="registration-domicilioLegalCalle" className={labelCls}>Calle</label>
          <input id="registration-domicilioLegalCalle" value={form.domicilioLegalCalle || ''} onChange={e => up('domicilioLegalCalle', e.target.value)}
            placeholder="Av. San Martin 123" className={inputCls()} />
        </div>
        <div>
          <label htmlFor="registration-domicilioLegalLocalidad" className={labelCls}>Localidad</label>
          <input id="registration-domicilioLegalLocalidad" value={form.domicilioLegalLocalidad || ''} onChange={e => up('domicilioLegalLocalidad', e.target.value)}
            placeholder="Mendoza" className={inputCls()} />
        </div>
        <div>
          <Select label="Departamento" value={form.domicilioLegalDepto || ''} onChange={(val) => up('domicilioLegalDepto', val)} options={[{ value: '', label: 'Seleccionar...' }, ...DEPARTAMENTOS_MENDOZA.map(d => ({ value: d, label: d }))]} size="base" searchable />
        </div>
      </div>

      <h4 className="text-sm font-semibold text-neutral-700 mt-4">Domicilio Real</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="registration-domicilioRealCalle" className={labelCls}>Calle</label>
          <input id="registration-domicilioRealCalle" value={form.domicilioRealCalle || ''} onChange={e => up('domicilioRealCalle', e.target.value)}
            placeholder="Ruta 40 km 5" className={inputCls()} />
        </div>
        <div>
          <label htmlFor="registration-domicilioRealLocalidad" className={labelCls}>Localidad</label>
          <input id="registration-domicilioRealLocalidad" value={form.domicilioRealLocalidad || ''} onChange={e => up('domicilioRealLocalidad', e.target.value)}
            placeholder="Lujan de Cuyo" className={inputCls()} />
        </div>
        <div>
          <Select label="Departamento" value={form.domicilioRealDepto || ''} onChange={(val) => up('domicilioRealDepto', val)} options={[{ value: '', label: 'Seleccionar...' }, ...DEPARTAMENTOS_MENDOZA.map(d => ({ value: d, label: d }))]} size="base" searchable />
        </div>
      </div>
    </div>
  );
}
