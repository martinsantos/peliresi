import { z } from 'zod';
import { distanceMeters, MAP_MAX_DISTANCE_M, MAP_REFERENCE_TYPES } from './inspectionMapGeometry';

/** Versioned, optional additions. Historical acts remain readable without invented defaults. */
export const inspectionMeasureSchema = z.object({
  id: z.string().min(1).max(100),
  detalle: z.string().trim().max(2000),
  responsable: z.string().trim().max(200),
  finalidad: z.enum(['DOCUMENTACION', 'SUBSANACION', 'DESCARGO']),
  dias: z.number().int().min(1).max(365).optional(),
  tipoDias: z.enum(['HABILES', 'CORRIDOS']).optional(),
  inicio: z.string().trim().max(300).optional(),
  vencimiento: z.string().datetime().optional(),
}).strict();
const mapPointSchema = z.object({ latitud: z.number().finite().min(-90).max(90), longitud: z.number().finite().min(-180).max(180) }).strict();
export const inspectionLocationSchema = z.object({
  latitud: z.number().finite().min(-90).max(90), longitud: z.number().finite().min(-180).max(180),
  origen: z.enum(['GPS', 'MAPA', 'MANUAL']), precisionMetros: z.number().finite().min(0).max(100000).optional(),
  mapaImagen: z.string().max(1100000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/).optional(),
  mapaZoom: z.number().int().min(2).max(19).optional(),
  registradaAt: z.string().datetime(), zoom: z.number().int().min(2).max(19).optional(),
  // Optional approximate drawing; older acts without it stay valid.
  perimetro: z.array(mapPointSchema).min(3).max(40).optional(),
  referencias: z.array(mapPointSchema.extend({ id: z.string().min(1).max(100), tipo: z.enum(MAP_REFERENCE_TYPES), etiqueta: z.string().trim().max(160).optional() }).strict()).max(20).optional(),
}).strict().superRefine((value, ctx) => {
  for (const [path, points] of [['perimetro', value.perimetro || []], ['referencias', value.referencias || []]] as const)
    points.forEach((point, index) => { if (distanceMeters(value, point) > MAP_MAX_DISTANCE_M) ctx.addIssue({ code: 'custom', path: [path, index], message: 'El trazado está a más de 10 km del punto inspeccionado. Revisá el mapa.' }); });
});
export const inspectionFieldExtensions = {
  modeloCampo: z.literal(2).optional(),
  motivoTipo: z.enum(['OFICIO', 'DENUNCIA', 'SEGUIMIENTO', 'INCIDENTE']).optional(),
  contactoActa: z.string().trim().max(254).optional(),
  solicitaCopia: z.boolean().optional(),
  actividadObservada: z.string().trim().max(2000).optional(),
  ampliacionEstado: z.enum(['COINCIDE', 'DIFIERE', 'NO_VERIFICADO', 'NO_APLICA']).optional(),
  ampliacionDetalle: z.string().trim().max(3000).optional(),
  entornoObservado: z.string().trim().max(3000).optional(),
  restriccionReferencia: z.string().trim().max(1000).optional(),
  receptores: z.array(z.enum(['POBLACION', 'SUELO', 'AGUA', 'AIRE'])).max(4).optional(),
  ubicacionCampo: inspectionLocationSchema.optional(),
  medidas: z.array(inspectionMeasureSchema).max(30).optional(),
  cointervinientes: z.array(z.object({ nombre: z.string().trim().min(1).max(200), cargo: z.string().trim().max(120).optional() }).strict()).max(10).optional(),
};
export function inspectionMeasureText(measures: Array<z.infer<typeof inspectionMeasureSchema>>): string {
  return measures.map((m, i) => `${i + 1}. ${m.detalle} — Responsable: ${m.responsable}.${m.dias ? ` Plazo: ${m.dias} días ${m.tipoDias === 'HABILES' ? 'hábiles' : 'corridos'}.` : ''}${m.inicio ? ` Inicio: ${m.inicio}.` : ''}${m.vencimiento ? ` Vence: ${new Date(m.vencimiento).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza' })}.` : ''}`).join('\n');
}
