import type { Worker } from 'tesseract.js';
import { detectedDocumentType, extractLocalOcrFields, type OcrFieldSuggestion } from './document-ocr-fields';

export interface LocalOcrResult {
  text: string;
  confidence: number;
  language: 'spa';
  engine: 'tesseract.js-local';
  tipoDetectado?: string;
  campos?: OcrFieldSuggestion[];
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    const { createWorker } = await import('tesseract.js');
    // All runtime assets are served by the same origin. This deliberately
    // avoids the default jsDelivr language/model fallback so the PWA keeps
    // working during a VPN outage or with no external AI service.
    const base = import.meta.env.BASE_URL || '/';
    const ocrBase = `${base.replace(/\/$/, '')}/ocr`;
    workerPromise = createWorker('spa', 1, {
      workerPath: `${ocrBase}/worker.min.js`,
      // Government's browser/WebView can expose SIMD but still stall inside
      // the SIMD build. The standard WASM core is slower but deterministic.
      corePath: `${ocrBase}/tesseract-core-lstm.wasm.js`,
      langPath: ocrBase,
      gzip: false,
      // Government CSP allows same-origin workers but blocks blob: workers.
      workerBlobURL: false,
      // Discard any partial model left by an interrupted first run, then
      // write the verified same-origin model back to the browser cache.
      cacheMethod: 'refresh',
      logger: (message) => console.debug('OCR local', message),
      errorHandler: (error) => console.error('OCR local error', error),
    });
  }
  return workerPromise;
}

function preprocessImage(file: File): Promise<HTMLCanvasElement | File> {
  if (!file.type.startsWith('image/')) return Promise.resolve(file);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1.5, 2200 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      ctx.filter = 'contrast(1.12) grayscale(1)';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas);
    };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    image.src = url;
  });
}

export async function recognizeLocalDocument(file: File, tipo = 'OTRO'): Promise<LocalOcrResult> {
  const operation = (async () => {
    const worker = await getWorker();
    const input = await preprocessImage(file);
    // The documents are single-page forms/cards. A single-block page mode is
    // considerably faster on phones and avoids the layout-analysis path that
    // can stall on low-memory mobile WebViews.
    return worker.recognize(input, { tessedit_pageseg_mode: '6' } as any);
  })();
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('El OCR local superó los 30 segundos; pruebe con una foto más nítida o continúe con revisión manual.')), 30_000);
  });
  const result = await Promise.race([operation, timeout]);
  const text = result.data.text;
  const tipoDetectado = detectedDocumentType(tipo, text);
  return {
    text,
    confidence: result.data.confidence,
    language: 'spa',
    engine: 'tesseract.js-local',
    tipoDetectado,
    campos: extractLocalOcrFields(tipoDetectado, text),
  };
}

export async function releaseLocalOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  // Detach the promise before awaiting it: a failed Web Worker must not keep
  // the document screen in its busy state forever.
  workerPromise = null;
  try {
    const worker = await Promise.race([
      pending,
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('OCR worker no respondió')), 1000)),
    ]);
    await worker.terminate();
  } catch {
    // The browser will reclaim a worker that failed to initialize.
  }
}
