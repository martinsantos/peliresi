import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { validateDocumentStructure } from '../../utils/documentStructure';

describe('document structure validation', () => {
  let directory: string;
  beforeAll(async () => { directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sitrep-document-structure-')); });
  afterAll(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  async function pdfFile(name: string, pages: number) {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    const ready = new Promise<Buffer>((resolve) => { doc.on('data', (chunk) => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); });
    for (let i = 0; i < pages; i++) doc.addPage().text(`QA ${i}`);
    doc.end();
    const file = path.join(directory, name);
    await fs.writeFile(file, await ready);
    return file;
  }
  it('accepts a real PDF', async () => {
    await expect(validateDocumentStructure(await pdfFile('valid.pdf', 1), 'application/pdf')).resolves.toBeUndefined();
  });
  it('rejects a PDF with only a forged header', async () => {
    const file = path.join(directory, 'corrupt.pdf');
    await fs.writeFile(file, '%PDF-1.4\ncorrupt\n%%EOF');
    await expect(validateDocumentStructure(file, 'application/pdf')).rejects.toThrow();
  });
  it('rejects more than 30 pages', async () => {
    await expect(validateDocumentStructure(await pdfFile('large.pdf', 31), 'application/pdf')).rejects.toThrow();
  });
  it('accepts a decoded image and rejects a truncated one', async () => {
    const file = path.join(directory, 'valid.png');
    const bytes = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await fs.writeFile(file, bytes);
    await expect(validateDocumentStructure(file, 'image/png')).resolves.toBeUndefined();
    await fs.writeFile(file, bytes.subarray(0, 30));
    await expect(validateDocumentStructure(file, 'image/png')).rejects.toThrow();
  });
});
