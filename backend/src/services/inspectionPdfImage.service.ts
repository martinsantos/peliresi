import fs from 'fs';
import sharp from 'sharp';

export type PreparedInspectionImage = {
  buffer: Buffer | null;
  status: 'READY' | 'MISSING' | 'UNREADABLE';
};

/**
 * Creates bounded JPEG representations for PDF rendering. The original
 * evidence file is never rewritten: its stored bytes and SHA-256 remain the
 * evidentiary source referenced by the document fingerprint.
 */
export async function prepareInspectionPdfImages(
  evidence: Array<{ id: string; tipo: string; storageKey: string; anuladaAt?: unknown }>,
  resolveEvidence: (key: string) => string,
): Promise<Map<string, PreparedInspectionImage>> {
  const prepared = new Map<string, PreparedInspectionImage>();
  const photos = evidence.filter((item) => item.tipo === 'FOTO' && !item.anuladaAt);

  // Sequential processing bounds peak memory for large field dossiers.
  for (const photo of photos) {
    try {
      const source = resolveEvidence(photo.storageKey);
      if (!fs.existsSync(source)) {
        prepared.set(photo.id, { buffer: null, status: 'MISSING' });
        continue;
      }
      const buffer = await sharp(source, { failOn: 'error', limitInputPixels: 80_000_000 })
        .rotate()
        .resize({ width: 1_600, height: 1_600, fit: 'inside', withoutEnlargement: true })
        .flatten({ background: '#FFFFFF' })
        .jpeg({ quality: 84, mozjpeg: true })
        .toBuffer();
      prepared.set(photo.id, { buffer, status: 'READY' });
    } catch {
      prepared.set(photo.id, { buffer: null, status: 'UNREADABLE' });
    }
  }

  return prepared;
}
