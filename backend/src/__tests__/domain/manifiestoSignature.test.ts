import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { prepareManifiestoSignature } from '../../domain/manifiestoSignature';

const image = async (width = 400, height = 200, blank = false) => {
  const pixels = Buffer.alloc(width * height * 3, 255);
  if (!blank) for (let x = 20; x < Math.min(width - 1, 150); x++) {
    const y = Math.min(height - 1, Math.floor(x / 2));
    for (let c = 0; c < 3; c++) pixels[(y * width + x) * 3 + c] = 20;
  }
  const png = await sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
};

describe('prepareManifiestoSignature', () => {
  it('preserves compatibility without pretending a handwritten signature exists', async () => {
    expect(await prepareManifiestoSignature(undefined)).toBeNull();
  });
  it('normalizes a real PNG and fingerprints the persisted bytes', async () => {
    const result = await prepareManifiestoSignature(await image());
    expect(result!.imagen).toMatch(/^data:image\/png;base64,/);
    const bytes = Buffer.from(result!.imagen.split(',')[1], 'base64');
    expect(await sharp(bytes).metadata()).toMatchObject({ width: 400, height: 200, format: 'png' });
    expect(result!.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
  });
  it.each([null, '', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,AAAA', 'https://example.invalid/image.png', 12])('rejects invalid input %s', async value => {
    await expect(prepareManifiestoSignature(value)).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects oversized payloads before decoding', async () => {
    await expect(prepareManifiestoSignature('data:image/png;base64,' + 'A'.repeat(180_000))).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects blank and implausibly sized signatures', async () => {
    for (const value of [await image(400, 200, true), await image(1, 1), await image(1000, 500)]) {
      await expect(prepareManifiestoSignature(value)).rejects.toMatchObject({ statusCode: 400 });
    }
  });
});
