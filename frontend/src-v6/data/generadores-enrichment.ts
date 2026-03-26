/**
 * Datos de enriquecimiento de generadores — tipo exportado para el frontend.
 * Los datos (1224 generadores) ahora se sirven desde el backend:
 *   GET /api/catalogos/enrichment/generadores
 * Usar useGeneradoresEnrichment() de hooks/useEnrichment.ts
 */

export interface GeneradorEnriched {
  certificado: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  emailOriginal: string;
  emailGenerado: boolean;
  categoriasControl: string[];
  activo: boolean;
  actividad: string;
  rubro: string;
}
