import { z } from 'zod';
import { isTrainingSession } from '../lib/trainingScope';

export const TRANSPORT_GPS_PURPOSE = 'transport-leg-gps';
export const transportHandoffEnabled = () => isTrainingSession() || process.env.MANIFEST_TRANSPORT_HANDOFF_ENABLED === 'true';
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const declaredTransportSchema = z.object({
  empresa: optionalText(180), cuit: optionalText(30), patente: optionalText(30),
  chofer: optionalText(180), documento: optionalText(40), telefono: optionalText(80),
  observaciones: optionalText(1000),
}).strict();
export const handoffSchema = z.object({
  id: z.string().uuid(),
  // The expected current leg prevents stale screens from replacing a newer one.
  anteriorId: z.string().nullable(),
  motivo: z.string().trim().min(3).max(1000),
  tipo: z.enum(['REGISTRADO', 'EXTERNO']),
  transportistaId: z.string().min(1).max(100).optional(),
  vehiculoId: z.string().min(1).max(100).optional(),
  choferId: z.string().min(1).max(100).optional(),
  datos: declaredTransportSchema,
  latitud: z.number().min(-90).max(90).optional(),
  longitud: z.number().min(-180).max(180).optional(),
}).strict().superRefine((data, ctx) => {
  if ((data.latitud === undefined) !== (data.longitud === undefined)) ctx.addIssue({code:'custom',message:'La ubicación necesita latitud y longitud.'});
  if (data.tipo === 'REGISTRADO' && !data.transportistaId) ctx.addIssue({code:'custom',message:'Elegí la transportista registrada.'});
  if (data.tipo === 'EXTERNO' && (data.transportistaId || data.vehiculoId || data.choferId)) ctx.addIssue({code:'custom',message:'Un externo se identifica con datos declarados.'});
});
export type HandoffCommand = z.infer<typeof handoffSchema>;
export type DeclaredTransport = z.infer<typeof declaredTransportSchema>;
export const gpsPointSchema = z.object({
  latitud:z.number().min(-90).max(90),longitud:z.number().min(-180).max(180),
  velocidad:z.number().min(0).optional(),direccion:z.number().min(0).max(360).optional(),
  precision:z.number().min(0).optional(),
}).strict();
export function isOriginalCarrier(user: {rol?:string;transportista?:{id:string}|null;restricted?:boolean}, manifest:{transportistaId:string|null}) {
  return !user.restricted && user.rol === 'TRANSPORTISTA' && !!manifest.transportistaId && user.transportista?.id === manifest.transportistaId;
}
export function declaredTransportLabel(value: unknown): string {
  const parsed = z.object({empresa:z.string().trim().max(500).optional()}).passthrough().safeParse(value);
  return parsed.success ? parsed.data.empresa || 'Transportista eventual sin nombre declarado' : 'Transporte original';
}
