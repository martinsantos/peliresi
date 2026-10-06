export type ConsoleObservation = { text: string; at: string; deliberatelyOffline: boolean };
export type IconProof = { url: string; at: string; status: number; mime: string; width: number; height: number; sha256: string };
export const qaManifestIcon = 'http://127.0.0.1:4177/app/icon-512.png';

// Record every message. Only a consequence of a deliberately disconnected
// context is expected; normal online failures and JS exceptions still fail QA.
export function expectedOfflineConsole(event: ConsoleObservation, proofs: IconProof[]): boolean {
  if (!event.deliberatelyOffline) return false;
  if (/^Failed to load resource: net::ERR_INTERNET_DISCONNECTED$/.test(event.text)) return true;
  if (event.text !== `Error while trying to use the following icon from the Manifest: ${qaManifestIcon} (Download error or resource isn't a valid image)`) return false;
  const timestamp = Date.parse(event.at);
  const valid = proofs.filter(proof => proof.url === qaManifestIcon && proof.status === 200
    && proof.mime.split(';')[0].trim() === 'image/png' && proof.width === 512 && proof.height === 512
    && /^[a-f0-9]{64}$/.test(proof.sha256));
  return valid.some(before => Date.parse(before.at) < timestamp
    && valid.some(after => Date.parse(after.at) > timestamp && before.sha256 === after.sha256));
}
