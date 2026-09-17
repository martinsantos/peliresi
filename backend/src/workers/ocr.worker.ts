import fs from 'fs';
import path from 'path';
import { parentPort, workerData } from 'worker_threads';
import { createWorker, type Worker as TesseractWorker } from 'tesseract.js';
import sharp from 'sharp';

interface OcrRequest {
  id: string;
  source: { kind: 'path'; value: string } | { kind: 'buffer'; value: Uint8Array };
}

let workerPromise: Promise<TesseractWorker> | null = null;

async function getTesseractWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    const workerPath = workerData.workerPath
      || path.resolve(__dirname, '../../node_modules/tesseract.js/src/worker-script/node/index.js');
    const options = {
      langPath: workerData.langPath || path.resolve(__dirname, '../../assets/ocr'),
      workerPath,
      gzip: false,
      logger: () => undefined,
      ...(workerData.corePath ? { corePath: workerData.corePath } : {}),
    };
    workerPromise = createWorker('spa', 1, {
      ...options,
    });
  }
  return workerPromise;
}

async function sourceBytes(source: OcrRequest['source']): Promise<Buffer> {
  return source.kind === 'path' ? fs.promises.readFile(source.value) : Buffer.from(source.value);
}

async function recognize(request: OcrRequest) {
  const source = await sourceBytes(request.source);
  const isPdf = source.subarray(0, 4).toString('utf8') === '%PDF';
  const images: Buffer[] = [];
  if (isPdf) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // pdfjs-dist deliberately rejects Node Buffers; pass a detached
    // Uint8Array so PDF OCR follows the same binary contract as images.
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(source),
      standardFontDataUrl: `${path.resolve(__dirname, '../../node_modules/pdfjs-dist/standard_fonts')}${path.sep}`,
    } as any).promise;
    const maxPages = Math.min(pdf.numPages, 5);
    const canvasModule = await import('@napi-rs/canvas');
    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d') as any, viewport } as any).promise;
      images.push(canvas.toBuffer('image/png'));
    }
  } else {
    images.push(await sharp(source).rotate().grayscale().normalize().png().toBuffer());
  }

  const ocr = await getTesseractWorker();
  let text = '';
  let confidenceTotal = 0;
  for (const image of images) {
    const result = await ocr.recognize(image);
    text += `${result.data.text}\n`;
    confidenceTotal += result.data.confidence;
  }
  return { text: text.trim(), confidence: images.length ? confidenceTotal / images.length : 0, language: 'spa', engine: 'tesseract.js@7-worker' };
}

if (!parentPort) throw new Error('OCR worker requiere parentPort');
parentPort.on('message', async (request: OcrRequest) => {
  try {
    parentPort!.postMessage({ id: request.id, result: await recognize(request) });
  } catch (error) {
    parentPort!.postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) });
  }
});
