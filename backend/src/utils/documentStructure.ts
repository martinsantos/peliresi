import fs from 'fs/promises';
import sharp from 'sharp';

/** Runs only inside the bounded document worker, never the HTTP event loop. */
export async function validateDocumentStructure(filePath: string, mime: string): Promise<void> {
  if (mime === 'application/pdf') {
    // Node 20.19+ supports synchronous ESM loading from this CommonJS worker.
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.mjs');
    const task = pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(filePath)), isEvalSupported: false, stopAtErrors: true, verbosity: 0 });
    try {
      const pdf = await task.promise;
      if (pdf.numPages < 1 || pdf.numPages > 30) throw new Error('page-limit');
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        const view = page.getViewport({ scale: 1 });
        if (!Number.isFinite(view.width * view.height) || view.width <= 0 || view.height <= 0 || view.width * view.height > 20_000_000) throw new Error('dimensions');
        await page.getOperatorList();
        page.cleanup();
      }
    } finally { await task.destroy(); }
    return;
  }
  const image = sharp(filePath, { limitInputPixels: 25_000_000, failOn: 'warning' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || (metadata.pages || 1) !== 1) throw new Error('dimensions');
  // Decode pixels, not just metadata: truncated images must fail too.
  await image.resize({ width: 32, height: 32, fit: 'inside' }).raw().toBuffer();
}
