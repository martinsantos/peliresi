import { createHash } from 'node:crypto';

// Official Apache-2.0 model. Downloaded/verified ONLY while building; runtime
// OCR is completely offline and never sends a document to this origin.
export const LICENSE_MODEL = Object.freeze({
  url: 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/spa.traineddata',
  bytes: 13_570_187,
  sha256: 'e2c1ffdad8b30f26c45d4017a9183d3a7f9aa69e59918be4f88b126fac99ab2c',
});

export function verifyLicenseModel(bytes: Uint8Array): void {
  if (bytes.length !== LICENSE_MODEL.bytes || createHash('sha256').update(bytes).digest('hex') !== LICENSE_MODEL.sha256) {
    throw new Error('LICENSE_MODEL_INTEGRITY');
  }
}
