import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { matchingExchangeReceipt, fileDigest } from '../../services/inspectionCommandReceipt';
import type { ExchangeCommand } from '../../services/inspectionExchangeCommand';
import type { InspectionExchange } from '../../types/inspection';
const file = () => new File(['original'], 'constancia.pdf', { type: 'application/pdf' });
const command = (): ExchangeCommand => ({ id: 'key', scope: { userId: 'actor', owner: 'G', inspectionId: 'case' }, savedAt: '', status: 'pending',
  kind: 'presentation', input: { clienteId: 'send-1', version: 3, tipo: 'DESCARGO', asunto: 'Constancia', cuerpo: 'Contenido íntegro.',
    respondeAId: 'request', files: [file()] } });
const receipt = async (): Promise<InspectionExchange> => ({ id: 'entry', clienteId: 'send-1', inspeccionId: 'case', autorId: 'actor', parte: 'INSPECCIONADO',
  versionExpediente: 4, tipo: 'DESCARGO', asunto: 'Constancia', cuerpo: 'Contenido íntegro.', respondeAId: 'request', plazoRespuestaAt: null,
  adjuntos: [{ nombreOriginal: 'constancia.pdf', bytes: 8, sha256: await fileDigest(file()) }] } as InspectionExchange);
describe('read-only acknowledgement of PSIP commands', () => {
  beforeEach(() => Object.defineProperty(crypto, 'subtle', { configurable: true, value: webcrypto.subtle }));
  it('matches the authorized receipt and original bytes', async () => {
    const entry = await receipt(); expect(await matchingExchangeReceipt(command(), [entry], 'INSPECCIONADO')).toBe(entry);
  });
  it.each([
    ['clienteId', 'another-send'], ['inspeccionId', 'another-case'], ['autorId', 'someone-else'], ['parte', 'AUTORIDAD'],
    ['versionExpediente', 5], ['tipo', 'RESPUESTA'], ['asunto', 'Otro asunto'], ['cuerpo', 'Otro contenido'],
    ['respondeAId', 'other-request'], ['plazoRespuestaAt', '2026-10-26T12:00:00Z'],
  ])('does not acknowledge a different %s', async (field, value) => {
    expect(await matchingExchangeReceipt(command(), [{ ...await receipt(), [field]: value }], 'INSPECCIONADO')).toBeNull();
  });
  it('does not accept another photo with the same filename and size', async () => {
    const entry = await receipt(); entry.adjuntos[0].sha256 = '0'.repeat(64);
    expect(await matchingExchangeReceipt(command(), [entry], 'INSPECCIONADO')).toBeNull();
  });
  it('does not accept missing or extra attachments', async () => {
    const entry = await receipt(); entry.adjuntos = [];
    expect(await matchingExchangeReceipt(command(), [entry], 'INSPECCIONADO')).toBeNull();
  });
  it('matches a legal decision including the full legal reference', async () => {
    const saved: ExchangeCommand = { ...command(), kind: 'decision', input: { clienteId: 'send-1', version: 3, decision: 'DERIVADA_LEGALES', fundamento: 'Fundamento documentado.', expedienteLegal: 'QA-123', files: [file()] } };
    const entry = { ...await receipt(), tipo: 'DERIVACION_LEGALES' as const, parte: 'AUTORIDAD' as const, respondeAId: null,
      asunto: 'Derivación del expediente a Legales', cuerpo: 'Fundamento documentado.\n\nExpediente legal: QA-123' };
    expect(await matchingExchangeReceipt(saved, [entry], 'AUTORIDAD')).toBe(entry);
    expect(await matchingExchangeReceipt(saved, [{ ...entry, cuerpo: entry.cuerpo.replace('123', '124') }], 'AUTORIDAD')).toBeNull();
  });
});
