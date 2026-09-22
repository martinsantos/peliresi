import { describe, expect, it } from 'vitest';
import {
  buildInspectionExchangeDigests,
  canDecideInspectionExchange,
  exchangePartyForUser,
  isExchangeTypeAllowed,
  isInspectionExchangeOpen,
  nextInspectionStateForExchange,
} from '../../services/inspectionExchange.service';

const inspection = {
  inspectorId: 'inspector-1',
  tipoActor: 'GENERADOR' as const,
  generadorId: 'generator-1',
  transportistaId: null,
  operadorId: null,
};

const baseDigest = {
  inspeccionId: 'inspection-1',
  secuencia: 1,
  respondeAId: null,
  tipo: 'REQUERIMIENTO' as const,
  parte: 'AUTORIDAD' as const,
  asunto: 'Documentación pendiente',
  cuerpo: 'Presente la constancia vigente y el plan de adecuación.',
  plazoRespuestaAt: '2026-09-30T18:00:00.000Z',
  canal: 'PORTAL_SITREP' as const,
  versionExpediente: 8,
  autorId: 'admin-1',
  createdAt: '2026-09-22T15:00:00.000Z',
  adjuntos: [
    { nombreOriginal: 'requerimiento.pdf', mimeDetectado: 'application/pdf', bytes: 500, sha256: 'b'.repeat(64) },
    { nombreOriginal: 'foto.jpg', mimeDetectado: 'image/jpeg', bytes: 300, sha256: 'a'.repeat(64) },
  ],
};

describe('inspection exchange policy', () => {
  it('limits an inspected actor to its own linked inspection', () => {
    expect(exchangePartyForUser({ rol: 'GENERADOR', generador: { id: 'generator-1' } }, inspection)).toBe('INSPECCIONADO');
    expect(exchangePartyForUser({ rol: 'GENERADOR', generador: { id: 'generator-2' } }, inspection)).toBeNull();
    expect(exchangePartyForUser({ rol: 'TRANSPORTISTA', transportista: { id: 'generator-1' } }, inspection)).toBeNull();
  });

  it('limits sector administrators to their actor type and decisions to administrators', () => {
    expect(exchangePartyForUser({ rol: 'ADMIN_GENERADOR' }, inspection)).toBe('AUTORIDAD');
    expect(exchangePartyForUser({ rol: 'ADMIN_TRANSPORTISTA' }, inspection)).toBeNull();
    expect(canDecideInspectionExchange({ rol: 'ADMIN_GENERADOR' }, inspection)).toBe(true);
    expect(canDecideInspectionExchange({ rol: 'ADMIN_TRANSPORTISTA' }, inspection)).toBe(false);
    expect(canDecideInspectionExchange({ rol: 'GENERADOR', generador: { id: 'generator-1' } }, inspection)).toBe(false);
  });

  it('allows assigned inspectors to participate but not issue the final decision', () => {
    const user = { id: 'inspector-1', rol: 'GENERADOR', esInspector: true, generador: { id: 'another-actor' } };
    expect(exchangePartyForUser(user, inspection)).toBe('AUTORIDAD');
    expect(canDecideInspectionExchange(user, inspection)).toBe(false);
  });

  it('separates authority messages from inspected-party submissions', () => {
    expect(isExchangeTypeAllowed('AUTORIDAD', 'REQUERIMIENTO')).toBe(true);
    expect(isExchangeTypeAllowed('AUTORIDAD', 'DESCARGO')).toBe(false);
    expect(isExchangeTypeAllowed('INSPECCIONADO', 'DESCARGO')).toBe(true);
    expect(isExchangeTypeAllowed('INSPECCIONADO', 'PRONUNCIAMIENTO')).toBe(false);
  });

  it('opens contradiction only in the notified, response and remediation stages', () => {
    expect(isInspectionExchangeOpen('NOTIFICADA')).toBe(true);
    expect(isInspectionExchangeOpen('EN_DESCARGO')).toBe(true);
    expect(isInspectionExchangeOpen('REQUIERE_SUBSANACION')).toBe(true);
    expect(isInspectionExchangeOpen('EN_REVISION')).toBe(false);
    expect(isInspectionExchangeOpen('DERIVADA_LEGALES')).toBe(false);
  });

  it('advances responses and new requirements without skipping legal decisions', () => {
    expect(nextInspectionStateForExchange('NOTIFICADA', 'INSPECCIONADO', 'DESCARGO')).toBe('EN_DESCARGO');
    expect(nextInspectionStateForExchange('EN_DESCARGO', 'AUTORIDAD', 'REQUERIMIENTO')).toBe('REQUIERE_SUBSANACION');
    expect(nextInspectionStateForExchange('REQUIERE_SUBSANACION', 'AUTORIDAD', 'PRONUNCIAMIENTO')).toBe('REQUIERE_SUBSANACION');
  });
});

describe('inspection exchange evidence chain', () => {
  it('is deterministic regardless of attachment arrival order', () => {
    const left = buildInspectionExchangeDigests(baseDigest, null);
    const right = buildInspectionExchangeDigests({ ...baseDigest, adjuntos: [...baseDigest.adjuntos].reverse() }, null);
    expect(left).toEqual(right);
    expect(left.contenidoSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(left.hashCadena).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when text, deadline or any attachment changes', () => {
    const original = buildInspectionExchangeDigests(baseDigest, null);
    expect(buildInspectionExchangeDigests({ ...baseDigest, cuerpo: `${baseDigest.cuerpo} Adicional.` }, null)).not.toEqual(original);
    expect(buildInspectionExchangeDigests({ ...baseDigest, plazoRespuestaAt: '2026-10-01T18:00:00.000Z' }, null)).not.toEqual(original);
    expect(buildInspectionExchangeDigests({
      ...baseDigest,
      adjuntos: baseDigest.adjuntos.map((file, index) => index === 0 ? { ...file, sha256: 'c'.repeat(64) } : file),
    }, null)).not.toEqual(original);
  });

  it('chains every later presentation to the preceding hash', () => {
    const first = buildInspectionExchangeDigests(baseDigest, null);
    const secondInput = {
      ...baseDigest,
      secuencia: 2,
      respondeAId: 'exchange-1',
      tipo: 'DESCARGO' as const,
      parte: 'INSPECCIONADO' as const,
      asunto: 'Descargo y constancia',
      autorId: 'actor-user-1',
      versionExpediente: 9,
    };
    const linked = buildInspectionExchangeDigests(secondInput, first.hashCadena);
    const unlinked = buildInspectionExchangeDigests(secondInput, null);
    expect(linked.contenidoSha256).toBe(unlinked.contenidoSha256);
    expect(linked.hashCadena).not.toBe(unlinked.hashCadena);
  });
});
