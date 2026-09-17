import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { config } from '../config/config';

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
  engine: string;
}

interface OcrJob {
  id: string;
  source: { kind: 'path'; value: string } | { kind: 'buffer'; value: Uint8Array };
}

interface OcrMessage {
  id: string;
  result?: OcrResult;
  error?: string;
}

let worker: Worker | null = null;
let workerReady: Promise<Worker> | null = null;
const pending = new Map<string, { resolve: (value: OcrResult) => void; reject: (error: Error) => void }>();

function attachWorker(instance: Worker): Worker {
  instance.on('message', (message: OcrMessage) => {
    const job = pending.get(message.id);
    if (!job) return;
    pending.delete(message.id);
    if (message.error) job.reject(new Error(message.error));
    else if (message.result) job.resolve(message.result);
    else job.reject(new Error('Respuesta OCR vacia'));
  });
  instance.on('error', (error) => {
    for (const job of pending.values()) job.reject(error);
    pending.clear();
    worker = null;
    workerReady = null;
  });
  instance.on('exit', (code) => {
    if (code !== 0) {
      const error = new Error(`Worker OCR finalizo con codigo ${code}`);
      for (const job of pending.values()) job.reject(error);
      pending.clear();
    }
    worker = null;
    workerReady = null;
  });
  return instance;
}

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  if (workerReady) return workerReady;
  const file = path.resolve(__dirname, '../workers/ocr.worker.js');
  if (!fs.existsSync(file)) throw new Error('Worker OCR no compilado; ejecute npm run build antes de usar el OCR de respaldo');
  workerReady = Promise.resolve(attachWorker(new Worker(file, {
    workerData: {
      langPath: config.OCR_LANG_PATH || path.resolve(__dirname, '../../assets/ocr'),
      workerPath: config.OCR_WORKER_PATH || undefined,
      corePath: config.OCR_CORE_PATH || undefined,
    },
  }))).then((instance) => {
    worker = instance;
    return instance;
  });
  return workerReady;
}

/** OCR runs in a dedicated Node worker, outside the Express event loop. */
export async function recognizeDocument(input: Buffer | string): Promise<OcrResult> {
  const instance = await getWorker();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const source: OcrJob['source'] = typeof input === 'string'
    ? { kind: 'path', value: input }
    : { kind: 'buffer', value: new Uint8Array(input) };
  return new Promise<OcrResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    instance.postMessage({ id, source } satisfies OcrJob);
  });
}

export async function terminateOcrWorker(): Promise<void> {
  const instance = worker;
  worker = null;
  workerReady = null;
  for (const job of pending.values()) job.reject(new Error('Worker OCR detenido'));
  pending.clear();
  if (instance) await instance.terminate();
}
