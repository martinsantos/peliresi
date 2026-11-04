import { webcrypto } from 'node:crypto';
import { Buffer } from 'node:buffer';

const nativeDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);

/** Node 20 validates BufferSource against its own realm. Copy DOM/FileReader bytes
 * into a Node Buffer, then use the real digest; never replace integrity checks with a constant. */
export const domSubtleCrypto = {
  digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
    const bytes = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
    return nativeDigest(algorithm, Buffer.from(bytes));
  },
};
