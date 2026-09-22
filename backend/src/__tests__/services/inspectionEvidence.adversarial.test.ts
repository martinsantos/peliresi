import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function upload(buffer: Buffer, name = 'campo.png', mimetype = 'image/png'): Express.Multer.File {
  return { buffer, originalname: name, mimetype, size: buffer.length } as Express.Multer.File;
}

describe('inspection evidence hostile storage boundaries', () => {
  let uploadsDir = '';
  const originalUploadsDir = process.env.UPLOADS_DIR;
  const originalScanMode = process.env.FILE_SCAN_MODE;
  const originalScanCommand = process.env.CLAMAV_SCAN_CMD;

  beforeEach(async () => {
    uploadsDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sitrep-evidence-adversarial-'));
    process.env.UPLOADS_DIR = uploadsDir;
    delete process.env.FILE_SCAN_MODE;
    delete process.env.CLAMAV_SCAN_CMD;
    vi.resetModules();
  });

  afterEach(async () => {
    if (originalUploadsDir === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = originalUploadsDir;
    if (originalScanMode === undefined) delete process.env.FILE_SCAN_MODE;
    else process.env.FILE_SCAN_MODE = originalScanMode;
    if (originalScanCommand === undefined) delete process.env.CLAMAV_SCAN_CMD;
    else process.env.CLAMAV_SCAN_CMD = originalScanCommand;
    await fs.promises.rm(uploadsDir, { recursive: true, force: true });
  });

  it('rejects empty and oversized captures before writing anything to disk', async () => {
    const service = await import('../../services/inspectionEvidence.service');

    await expect(service.persistInspectionEvidence(upload(Buffer.alloc(0)), 'inspection-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(service.persistInspectionEvidence(upload(Buffer.alloc(25 * 1024 * 1024 + 1)), 'inspection-1'))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(await fs.promises.readdir(uploadsDir)).toEqual([]);
  });

  it.each(['../inspection-2', 'inspection/../../escape', '/absolute', 'id with spaces'])(
    'rejects a hostile inspection identifier: %s',
    async (inspectionId) => {
      const service = await import('../../services/inspectionEvidence.service');
      await expect(service.persistInspectionEvidence(upload(PNG_1PX), inspectionId))
        .rejects.toMatchObject({ statusCode: 400 });
      expect(await fs.promises.readdir(uploadsDir)).toEqual([]);
    },
  );

  it.each([
    '/etc/passwd',
    '../outside.png',
    'inspecciones/inspection-1/../../outside.png',
    'inspecciones\\inspection-1\\outside.png',
  ])('never resolves an evidence path outside the configured store: %s', async (storageKey) => {
    const service = await import('../../services/inspectionEvidence.service');
    expect(() => service.resolveInspectionEvidence(storageKey)).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('removes the quarantine file when mandatory antivirus scanning fails', async () => {
    process.env.FILE_SCAN_MODE = 'required';
    process.env.CLAMAV_SCAN_CMD = 'false';
    vi.resetModules();
    const service = await import('../../services/inspectionEvidence.service');

    await expect(service.persistInspectionEvidence(upload(PNG_1PX), 'inspection-1'))
      .rejects.toMatchObject({ statusCode: 400 });

    const files = await fs.promises.readdir(uploadsDir, { recursive: true });
    expect(files.filter((entry) => String(entry).endsWith('.evidence'))).toEqual([]);
    expect(files.filter((entry) => /\.(png|jpg|webp)$/i.test(String(entry)))).toEqual([]);
  });
});
