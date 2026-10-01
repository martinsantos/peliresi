export type SolicitudActorType = 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA';

export interface SolicitudDocumentRequirement {
  tipo: string;
  nombre: string;
  required: boolean;
}

export const SOLICITUD_DOCUMENT_ACCEPT = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const SOLICITUD_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const REQUIREMENTS: Record<SolicitudActorType, SolicitudDocumentRequirement[]> = {
  GENERADOR: [
    { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', required: true },
    { tipo: 'MEMORIA_TECNICA', nombre: 'Memoria Tecnica', required: true },
    { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitacion', required: true },
  ],
  OPERADOR: [
    { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', required: true },
    { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Certificado de Habilitacion', required: true },
    { tipo: 'RESOLUCION_DPA', nombre: 'Resolucion DPA', required: true },
  ],
  TRANSPORTISTA: [
    { tipo: 'CONSTANCIA_AFIP', nombre: 'Constancia AFIP', required: true },
    { tipo: 'CERTIFICADO_HABILITACION', nombre: 'Habilitacion de Transporte', required: true },
    { tipo: 'SEGURO_AMBIENTAL', nombre: 'Seguro Ambiental', required: true },
  ],
};

export function isSolicitudActorType(value: string): value is SolicitudActorType {
  return value === 'GENERADOR' || value === 'OPERADOR' || value === 'TRANSPORTISTA';
}

export function getSolicitudRequirements(tipoActor: string): SolicitudDocumentRequirement[] {
  if (!isSolicitudActorType(tipoActor)) return [];
  return REQUIREMENTS[tipoActor].map((requirement) => ({ ...requirement }));
}

export function getMissingRequiredDocumentTypes(tipoActor: string, uploadedTypes: string[]): string[] {
  const present = new Set(uploadedTypes);
  return getSolicitudRequirements(tipoActor)
    .filter((requirement) => requirement.required && !present.has(requirement.tipo))
    .map((requirement) => requirement.tipo);
}
