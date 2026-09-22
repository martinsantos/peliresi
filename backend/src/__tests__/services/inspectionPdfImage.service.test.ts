import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareInspectionPdfImages } from '../../services/inspectionPdfImage.service';

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('inspection PDF image representations', () => {
  let directory = '';

  beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-pdf-image-')); });
  afterEach(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it('normalizes PNG and WEBP into bounded JPEG buffers without changing originals', async () => {
    fs.writeFileSync(path.join(directory, 'field.png'), PNG_1PX);
    await sharp(PNG_1PX).webp().toFile(path.join(directory, 'field.webp'));
    const originalWebp = fs.readFileSync(path.join(directory, 'field.webp'));

    const result = await prepareInspectionPdfImages([
      { id: 'png', tipo: 'FOTO', storageKey: 'field.png' },
      { id: 'webp', tipo: 'FOTO', storageKey: 'field.webp' },
    ], (key) => path.join(directory, key));

    expect(result.get('png')?.status).toBe('READY');
    expect(result.get('webp')?.status).toBe('READY');
    expect(result.get('png')?.buffer?.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(result.get('webp')?.buffer?.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(fs.readFileSync(path.join(directory, 'field.webp'))).toEqual(originalWebp);
  });

  it('isolates missing, corrupt and resolver failures instead of aborting the PDF', async () => {
    fs.writeFileSync(path.join(directory, 'corrupt.png'), Buffer.from('not-an-image'));
    const result = await prepareInspectionPdfImages([
      { id: 'missing', tipo: 'FOTO', storageKey: 'missing.png' },
      { id: 'corrupt', tipo: 'FOTO', storageKey: 'corrupt.png' },
      { id: 'resolver', tipo: 'FOTO', storageKey: '../blocked.png' },
    ], (key) => {
      if (key.startsWith('..')) throw new Error('blocked');
      return path.join(directory, key);
    });

    expect(result.get('missing')).toEqual({ buffer: null, status: 'MISSING' });
    expect(result.get('corrupt')).toEqual({ buffer: null, status: 'UNREADABLE' });
    expect(result.get('resolver')).toEqual({ buffer: null, status: 'UNREADABLE' });
  });

  it('skips annulled evidence and non-photographic files', async () => {
    const result = await prepareInspectionPdfImages([
      { id: 'annulled', tipo: 'FOTO', storageKey: 'x.png', anuladaAt: new Date() },
      { id: 'document', tipo: 'DOCUMENTO', storageKey: 'x.pdf' },
    ], (key) => path.join(directory, key));
    expect(result.size).toBe(0);
  });
});
