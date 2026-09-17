/**
 * SITREP v6 - Inscripcion Wizard — Shared constants, types, helpers
 */

import React from 'react';
import {
  Factory, FlaskConical, ClipboardList, MapPin, Users, Shield,
  FileText, Check, Calculator, Truck, Car,
} from 'lucide-react';

// ========================================
// CONSTANTS
// ========================================

export const DEPARTAMENTOS_MENDOZA = [
  'Capital', 'Godoy Cruz', 'Guaymallen', 'Las Heras', 'Lujan de Cuyo',
  'Maipu', 'San Rafael', 'General Alvear', 'Junin', 'La Paz',
  'Lavalle', 'Malargue', 'Rivadavia', 'San Carlos', 'San Martin',
  'Santa Rosa', 'Tunuyan', 'Tupungato',
];

export const CATEGORIAS_GENERADOR = ['Grandes Generadores', 'Medianos Generadores', 'Pequenos Generadores'];

export const DOCS_GENERADOR: DocDef[] = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria Técnica' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitación', requiereVigencia: true },
];

export const DOCS_OPERADOR: DocDef[] = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitación', requiereVigencia: true },
  { tipo: 'RESOLUCION_DPA', nombre: 'Resolución DPA' },
];

export const DOCS_TRANSPORTISTA: DocDef[] = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', caras: 'UNA' as const, instrucciones: 'Una copia legible. PDF completo o una imagen.' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Habilitación de Transporte', requiereVigencia: true, caras: 'UNA', instrucciones: 'Una copia legible. Si tiene varias páginas, preferí un PDF completo.' },
  { tipo: 'SEGURO_AMBIENTAL', nombre: 'Seguro Ambiental', requiereVigencia: true, caras: 'UNA', instrucciones: 'Una copia legible. PDF completo o una imagen.' },
  { tipo: 'LICENCIA_CONDUCIR', nombre: 'Licencia de conducir — soporte de choferes', required: false, requiereVigencia: true, caras: 'FRENTE_Y_DORSO', instrucciones: 'Adjuntá un archivo distinto para cada cara, frente y dorso.' },
  { tipo: 'TARJETA_IDENTIFICACION_VEHICULO', nombre: 'Cédula azul / identificación de vehículo', required: false, caras: 'FRENTE_Y_DORSO', instrucciones: 'Adjuntá un archivo distinto para cada cara, frente y dorso.' },
];

export interface StepDef {
  id: number;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

export const STEPS_GENERADOR: StepDef[] = [
  { id: 1, label: 'Establecimiento', icon: Factory },
  { id: 2, label: 'Regulatorio', icon: ClipboardList },
  { id: 3, label: 'Domicilios', icon: MapPin },
  { id: 4, label: 'Adicional', icon: Shield },
  { id: 5, label: 'Cálculo TEF', icon: Calculator },
  { id: 6, label: 'Documentos', icon: FileText },
  { id: 7, label: 'Resumen', icon: Check },
];

export const STEPS_OPERADOR: StepDef[] = [
  { id: 1, label: 'Establecimiento', icon: FlaskConical },
  { id: 2, label: 'Regulatorio', icon: ClipboardList },
  { id: 3, label: 'Domicilios', icon: MapPin },
  { id: 4, label: 'Representantes', icon: Users },
  { id: 5, label: 'Corrientes', icon: Shield },
  { id: 6, label: 'Cálculo TEF', icon: Calculator },
  { id: 7, label: 'Documentos', icon: FileText },
  { id: 8, label: 'Resumen', icon: Check },
];

export const STEPS_TRANSPORTISTA: StepDef[] = [
  { id: 1, label: 'Datos básicos', icon: Truck },
  { id: 2, label: 'Habilitación', icon: Shield },
  { id: 3, label: 'Vehículos', icon: Car },
  { id: 4, label: 'Documentos', icon: FileText },
  { id: 5, label: 'Resumen', icon: Check },
];

// ========================================
// TYPES
// ========================================

export type TipoActor = 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA';

export interface RegistrationData {
  nombre: string;
  email: string;
  password: string;
  confirmPassword: string;
  cuit: string;
}

/** Fixture for the non-mutating QA/review version of the registration wizard. */
export function getReviewFixture(tipoActor: TipoActor): {
  reg: RegistrationData;
  form: Record<string, string>;
} {
  const reg: RegistrationData = {
    nombre: 'Usuario QA de revision',
    email: 'qa-alta@sitrep.local',
    password: 'RevisionQA1',
    confirmPassword: 'RevisionQA1',
    cuit: '30-70987654-3',
  };
  const common = {
    domicilio: 'Av. de Acceso 1234, Mendoza',
    telefono: '0261-555-0147',
    emailContacto: 'qa-empresa@sitrep.local',
    domicilioLegalCalle: 'Av. de Acceso 1234',
    domicilioLegalLocalidad: 'Mendoza',
    domicilioLegalDepto: 'Capital',
    domicilioRealCalle: 'Parque Industrial Lote 8',
    domicilioRealLocalidad: 'Lujan de Cuyo',
    domicilioRealDepto: 'Lujan de Cuyo',
  };

  if (tipoActor === 'GENERADOR') {
    return { reg, form: {
      ...common,
      razonSocial: 'Generador QA Internacional S.A.',
      actividad: 'Fabricacion de insumos quimicos',
      rubro: 'Industria quimica',
      numeroInscripcion: 'G-QA-2026-001',
      categoria: 'Medianos Generadores',
      expedienteInscripcion: 'EX-2026-00012345',
      resolucionInscripcion: 'RES-DGFA-QA-001/26',
      corrientesControl: 'Y8, Y12, Y48',
      alcanceTratamiento: 'INTERNACIONAL',
      categoriaIndividual: '1000-2000',
      libroOperatoria: 'LIB-QA-001',
      certificacionISO: '2027-06-30',
      factorR: '1', montoMxR: '12500', tefPersonal: '24', tefSuperficie: '1800', tefPotencia: '450', tefZona: 'Industrial',
    } };
  }

  if (tipoActor === 'OPERADOR') {
    return { reg, form: {
      ...common,
      razonSocial: 'Operador QA Tratamiento Exterior S.A.',
      tipoOperador: 'TRATAMIENTO', tecnologia: 'Tratamiento fisico-quimico',
      numeroHabilitacion: 'HAB-QA-2026-001', categoria: 'Tratamiento y disposicion final',
      expedienteInscripcion: 'EX-2026-00023456', certificadoNumero: 'CERT-QA-001', resolucionDPA: 'RES-DPA-QA-002/26',
      representanteLegalNombre: 'Laura Revision', representanteLegalDNI: '28123456', representanteLegalTelefono: '0261-555-0148',
      representanteTecnicoNombre: 'Martin Control', representanteTecnicoMatricula: 'MAT-QA-001', representanteTecnicoTelefono: '0261-555-0149',
      corrientesY: 'Y8, Y12, Y48', factorR: '1', montoMxR: '18500', tefPersonal: '18', tefSuperficie: '2400', tefCapacidad: '800', tefZona: 'Industrial',
    } };
  }

  return { reg, form: {
    ...common,
    razonSocial: 'Transporte QA Ambiental S.A.', localidad: 'Godoy Cruz, Mendoza', coordenadas: '-32.9275, -68.8440',
    numeroHabilitacion: 'HAB-TR-QA-001', vencimientoHabilitacion: '2027-12-31', expedienteDPA: 'EX-DPA-QA-003',
    resolucionDPA: '0359/26', resolucionSSP: 'SSP-QA-004', corrientesAutorizadas: 'Y4, Y8, Y9, Y48',
    vehiculosJson: JSON.stringify([{ patente: 'QA123AB', marca: 'Mercedes-Benz', modelo: 'Atego', anio: '2026', capacidad: '10' }]),
    choferesJson: JSON.stringify([{ nombre: 'Juan', apellido: 'Revision', dni: '20123456', licencia: 'LIC-QA-001', vencimiento: '2027-12-31' }]),
  } };
}

export interface DocDef {
  tipo: string;
  nombre: string;
  required?: boolean;
  requiereVigencia?: boolean;
  caras?: 'UNA' | 'FRENTE_Y_DORSO';
  instrucciones?: string;
}

// ========================================
// HELPERS
// ========================================

export function validateCuit(cuit: string): boolean {
  const digits = cuit.replace(/\D/g, '');
  return digits.length === 11;
}

export function validatePassword(pw: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (pw.length < 8) errors.push('Mínimo 8 caracteres');
  if (!/[A-Z]/.test(pw)) errors.push('Al menos 1 mayúscula');
  if (!/\d/.test(pw)) errors.push('Al menos 1 número');
  return { valid: errors.length === 0, errors };
}

export const inputCls = (hasError = false) =>
  `w-full px-4 h-10 rounded-xl border ${hasError ? 'border-error-400 bg-error-50' : 'border-neutral-200'} focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors`;

export const selectCls = (hasError = false) =>
  `w-full px-4 h-10 rounded-xl border ${hasError ? 'border-error-400 bg-error-50' : 'border-neutral-200'} focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors`;

export const labelCls = 'block text-sm font-medium text-neutral-700 mb-1';
