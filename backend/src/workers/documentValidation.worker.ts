import { parentPort, workerData } from 'worker_threads';
import { validateDocumentStructure } from '../utils/documentStructure';

validateDocumentStructure(workerData.filePath, workerData.mime)
  .then(() => parentPort?.postMessage({ ok: true }))
  .catch(() => parentPort?.postMessage({ ok: false }));
