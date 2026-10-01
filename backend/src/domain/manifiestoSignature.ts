import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { AppError } from '../middlewares/errorHandler';

/** Captured handwriting, not a certificate-backed digital signature. */
export async function prepareManifiestoSignature(value: unknown): Promise<{ imagen: string; sha256: string } | null> {
  if (value === undefined) return null; // Older clients approve with their authenticated account only.
  const invalid = () => new AppError('La firma adjunta no es válida. Volvé a dibujarla antes de confirmar.', 400);
  if (typeof value !== 'string' || value.length > 175_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw invalid();
  try {
    const source = Buffer.from(value.slice('data:image/png;base64,'.length), 'base64');
    if (source.length > 128 * 1024) throw invalid();
    const input = sharp(source, { limitInputPixels: 800 * 400, failOn: 'error' });
    const metadata = await input.metadata();
    if (metadata.format !== 'png' || !metadata.width || !metadata.height
      || metadata.width < 100 || metadata.width > 800 || metadata.height < 40 || metadata.height > 400
      || (metadata.pages || 1) !== 1) throw invalid();
    // Decode/re-encode: do not persist arbitrary PNG metadata or an unvalidated data URL.
    const normalized = await input.flatten({ background: '#ffffff' }).removeAlpha().png().toBuffer();
    const stats = await sharp(normalized).stats();
    if (!stats.channels.some(channel => channel.min < 200 && channel.stdev > 0.5)) throw invalid();
    return { imagen: `data:image/png;base64,${normalized.toString('base64')}`, sha256: createHash('sha256').update(normalized).digest('hex') };
  } catch {
    throw invalid();
  }
}
