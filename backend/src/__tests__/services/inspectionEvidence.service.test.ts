import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function uploadFile(buffer: Buffer, name = 'hallazgo.png', mimetype = 'image/png'): Express.Multer.File {
  return { buffer, originalname: name, mimetype, size: buffer.length } as Express.Multer.File;
}

describe('inspection evidence filesystem persistence', () => {
  let uploadsDir = '';
  const originalUploadsDir = process.env.UPLOADS_DIR;

  beforeEach(async () => {
    uploadsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sitrep-evidence-'));
    process.env.UPLOADS_DIR = uploadsDir;
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
    await fs.promises.rm(uploadsDir, { recursive: true, force: true });
  });

  it('accepts a real PNG, stores the original bytes and returns its server hash', async () => {
    const service = await import('../../services/inspectionEvidence.service');
    const stored = await service.persistInspectionEvidence(uploadFile(PNG_1PX), 'inspection-qa');
    const storedPath = service.resolveInspectionEvidence(stored.storageKey);

    expect(stored.mimeType).toBe('image/png');
    expect(stored.bytes).toBe(PNG_1PX.length);
    expect(stored.sha256).toBe(crypto.createHash('sha256').update(PNG_1PX).digest('hex'));
    expect(await fs.promises.readFile(storedPath)).toEqual(PNG_1PX);
    expect(path.relative(uploadsDir, storedPath).startsWith('..')).toBe(false);
  });

  it('rejects a file that merely claims to be PNG without PNG bytes', async () => {
    const service = await import('../../services/inspectionEvidence.service');
    await expect(service.persistInspectionEvidence(uploadFile(Buffer.from('not-an-image')), 'inspection-qa'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(await fs.promises.readdir(uploadsDir)).toEqual([]);
  });
});
