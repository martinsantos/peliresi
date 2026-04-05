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

export const DOCS_GENERADOR = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria Tecnica' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitacion' },
];

export const DOCS_OPERADOR = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitacion' },
  { tipo: 'RESOLUCION_DPA', nombre: 'Resolucion DPA' },
];

export const DOCS_TRANSPORTISTA = [
  { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP' },
  { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Habilitacion de Transporte' },
  { tipo: 'SEGURO_AMBIENTAL', nombre: 'Seguro Ambiental' },
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
  { id: 5, label: 'Calculo TEF', icon: Calculator },
  { id: 6, label: 'Documentos', icon: FileText },
  { id: 7, label: 'Resumen', icon: Check },
];

export const STEPS_OPERADOR: StepDef[] = [
  { id: 1, label: 'Establecimiento', icon: FlaskConical },
  { id: 2, label: 'Regulatorio', icon: ClipboardList },
  { id: 3, label: 'Domicilios', icon: MapPin },
  { id: 4, label: 'Representantes', icon: Users },
  { id: 5, label: 'Corrientes', icon: Shield },
  { id: 6, label: 'Calculo TEF', icon: Calculator },
  { id: 7, label: 'Documentos', icon: FileText },
  { id: 8, label: 'Resumen', icon: Check },
];

export const STEPS_TRANSPORTISTA: StepDef[] = [
  { id: 1, label: 'Datos Basicos', icon: Truck },
  { id: 2, label: 'Habilitacion', icon: Shield },
  { id: 3, label: 'Vehiculos', icon: Car },
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

export interface DocDef {
  tipo: string;
  nombre: string;
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
  if (pw.length < 8) errors.push('Minimo 8 caracteres');
  if (!/[A-Z]/.test(pw)) errors.push('Al menos 1 mayuscula');
  if (!/\d/.test(pw)) errors.push('Al menos 1 numero');
  return { valid: errors.length === 0, errors };
}

export const inputCls = (hasError = false) =>
  `w-full px-4 h-10 rounded-xl border ${hasError ? 'border-error-400 bg-error-50' : 'border-neutral-200'} focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors`;

export const selectCls = (hasError = false) =>
  `w-full px-4 h-10 rounded-xl border ${hasError ? 'border-error-400 bg-error-50' : 'border-neutral-200'} focus:border-[#0D8A4F] focus:ring-2 focus:ring-[#0D8A4F]/20 focus:outline-none text-sm bg-white transition-colors`;

export const labelCls = 'block text-sm font-medium text-neutral-700 mb-1';
