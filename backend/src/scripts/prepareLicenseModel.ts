import { randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { LICENSE_MODEL, verifyLicenseModel } from '../domain/licenseModel';

/** Build asset, not a service/startup hook. Fail closed on changed bytes. */
export async function prepareLicenseModel(): Promise<void> {
  const directory = path.join(__dirname, '..', 'assets', 'ocr');
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, 'spa.traineddata');
  const existing = await lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (existing) {
    if (!existing.isFile() || existing.isSymbolicLink() || existing.size !== LICENSE_MODEL.bytes) throw new Error('LICENSE_MODEL_INTEGRITY');
    verifyLicenseModel(await readFile(target)); return;
  }
  const response = await fetch(LICENSE_MODEL.url, { signal: AbortSignal.timeout(30_000), redirect: 'error' });
  if (!response.ok || !response.body) throw new Error('LICENSE_MODEL_DOWNLOAD');
  const chunks: Buffer[] = []; let size = 0;
  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > LICENSE_MODEL.bytes) throw new Error('LICENSE_MODEL_INTEGRITY');
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) { await response.body.cancel().catch(() => undefined); throw error; }
  const bytes = Buffer.concat(chunks); verifyLicenseModel(bytes);
  const temporary = path.join(directory, `spa-${randomUUID()}.partial`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o644 });
    await rename(temporary, target);
  } finally { await unlink(temporary).catch(() => undefined); }
}

if (typeof require !== 'undefined' && require.main === module) prepareLicenseModel().then(() => {
  console.log('Pinned Spanish OCR asset verified; no private documents or runtime download.');
}).catch(() => { console.error('License OCR model build failed integrity/download checks.'); process.exitCode = 1; });
