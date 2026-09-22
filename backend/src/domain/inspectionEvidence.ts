import { TipoEvidenciaInspeccion } from '@prisma/client';
import { z } from 'zod';

const optionalFormString = (max: number) => z.preprocess(
  (value) => value === '' || value === null || value === undefined ? undefined : value,
  z.string().trim().min(1).max(max).optional(),
);

const optionalCoordinate = (min: number, max: number) => z.preprocess(
  (value) => value === '' || value === null || value === undefined ? undefined : value,
  z.coerce.number().finite().min(min).max(max).optional(),
);

export const inspectionEvidenceMetadataSchema = z.object({
  eventoId: optionalFormString(128),
  comparacionId: optionalFormString(128),
  itemId: optionalFormString(128),
  clienteId: optionalFormString(128).refine((value) => !value || /^[a-zA-Z0-9_-]{8,128}$/.test(value), 'Identificador de captura inválido'),
  clienteSha256: optionalFormString(64).refine((value) => !value || /^[a-fA-F0-9]{64}$/.test(value), 'Huella de captura inválida'),
  tipo: z.preprocess(
    (value) => typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined,
    z.nativeEnum(TipoEvidenciaInspeccion).optional(),
  ),
  descripcion: optionalFormString(2_000),
  transcripcion: optionalFormString(20_000),
  capturadaAt: z.preprocess(
    (value) => value === '' || value === null || value === undefined ? undefined : value,
    z.coerce.date().optional(),
  ),
  latitud: optionalCoordinate(-90, 90),
  longitud: optionalCoordinate(-180, 180),
}).superRefine((value, context) => {
  const targets = [value.eventoId, value.comparacionId, value.itemId].filter(Boolean);
  if (targets.length > 1) context.addIssue({ code: 'custom', message: 'La evidencia debe vincularse a un único destino' });
  if ((value.latitud === undefined) !== (value.longitud === undefined)) {
    context.addIssue({ code: 'custom', message: 'La ubicación requiere latitud y longitud' });
  }
});
