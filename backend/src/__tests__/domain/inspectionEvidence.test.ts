import { describe, expect, it } from 'vitest';
import { inspectionEvidenceMetadataSchema } from '../../domain/inspectionEvidence';

describe('inspection evidence metadata', () => {
  it('accepts valid multipart strings and preserves zero coordinates', () => {
    const parsed = inspectionEvidenceMetadataSchema.parse({
      itemId: 'item-1', clienteId: 'capture_12345678', tipo: 'foto',
      capturadaAt: '2026-09-22T10:00:00.000Z', latitud: '0', longitud: '0',
    });
    expect(parsed.tipo).toBe('FOTO');
    expect(parsed.latitud).toBe(0);
    expect(parsed.longitud).toBe(0);
    expect(parsed.capturadaAt).toBeInstanceOf(Date);
  });

  it('rejects multiple targets, partial coordinates and malformed client hashes', () => {
    expect(inspectionEvidenceMetadataSchema.safeParse({ itemId: 'item-1', eventoId: 'event-1' }).success).toBe(false);
    expect(inspectionEvidenceMetadataSchema.safeParse({ latitud: '-32.8' }).success).toBe(false);
    expect(inspectionEvidenceMetadataSchema.safeParse({ clienteSha256: 'not-a-hash' }).success).toBe(false);
  });
});
