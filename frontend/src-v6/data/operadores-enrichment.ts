/**
 * Datos de enriquecimiento de operadores — tipo exportado para el frontend.
 * Los datos (45 operadores) ahora se sirven desde el backend:
 *   GET /api/catalogos/enrichment/operadores
 * Usar useOperadoresEnrichment() de hooks/useEnrichment.ts
 */

export interface OperadorEnriched {
  certificado: string;
  expediente: string;
  empresa: string;
  cuit: string;
  telefono: string;
  mail: string;
  domicilioLegal: { calle: string; localidad: string; departamento: string };
  domicilioReal: { calle: string; localidad: string; departamento: string };
  tipoOperador: 'FIJO' | 'IN SITU' | 'FIJO / IN SITU';
  tecnologia: string;
  corrientes: string[];
}
