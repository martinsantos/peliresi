import sharp from 'sharp';
import { AppError } from '../middlewares/errorHandler';
/** A bounded, single raster map; no SVG, file path or arbitrary server URL. */
export async function validateInspectionMap(image?: string): Promise<void> {
  if (!image) return;
  try {
    if (image.length > 1100000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) throw new Error();
    const bytes = Buffer.from(image.slice(image.indexOf(',') + 1), 'base64');
    const source = sharp(bytes, { limitInputPixels: 800000, animated: false });
    const meta = await source.metadata();
    if (meta.format !== 'png' || !meta.width || !meta.height || meta.width > 1200 || meta.height > 800 || (meta.pages || 1) !== 1) throw new Error();
    await source.stats();
  } catch { throw new AppError('No se pudo validar la imagen del mapa. Volvé a guardar su vista; las coordenadas se conservan.', 400); }
}
