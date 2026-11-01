import { describe, expect, it } from 'vitest';
import { MANIFEST_PROPOSAL, inspectProposal, manifestReadiness } from '../domain/manifestProposal';

const manifest = { generadorId: 'g', transportistaId: 't', operadorId: 'o', creadoPorId: 'u', modalidad: 'FIJO' };
const proposal = { ...manifest, version: 2, autorRol: 'GENERADOR' };
const marker = { tipo: MANIFEST_PROPOSAL, descripcion: JSON.stringify(proposal) };
const approvals = ([['FIRMA','GENERADOR','g'], ['APROBACION_TRANSPORTISTA','TRANSPORTISTA','t'], ['APROBACION_OPERADOR','OPERADOR','o']] as const)
  .map(([tipo,rol,actorId]) => ({ tipo, usuarioId: `user-${rol}`, descripcion: JSON.stringify({ version: 1, rol, actorId, decision: 'APROBADA' }) }));

describe('manifest proposal readiness', () => {
  it('distinguishes absent, unreadable, duplicate and mismatched snapshots', () => {
    expect(inspectProposal(manifest, []).kind).toBe('missing');
    expect(inspectProposal(manifest, [{ tipo: MANIFEST_PROPOSAL, descripcion: '{' }]).kind).toBe('invalid');
    expect(inspectProposal(manifest, [marker, marker]).kind).toBe('duplicate');
    expect(inspectProposal({ ...manifest, operadorId: 'other' }, [marker]).kind).toBe('mismatch');
  });
  it('requires all three decisions and a separate start; a rejection blocks even with all events', () => {
    expect(manifestReadiness(manifest, [marker, ...approvals.slice(0, 2)])).toBe('FALTAN_APROBACIONES');
    expect(manifestReadiness(manifest, [marker, ...approvals])).toBe('FALTA_COORDINACION');
    expect(manifestReadiness(manifest, [marker, ...approvals, { tipo: 'INICIO_COORDINACION' }])).toBe('LISTA');
    expect(manifestReadiness(manifest, [marker, ...approvals, { tipo: 'INICIO_COORDINACION' }, { tipo: 'RECHAZO_PARTE' }])).toBe('RECHAZADA');
  });
  it('does not accept an approval for another actor or a legacy signature without proposal evidence', () => {
    const wrongActor = { ...approvals[1], descripcion: JSON.stringify({ version: 1, rol: 'TRANSPORTISTA', actorId: 'other', decision: 'APROBADA' }) };
    expect(manifestReadiness(manifest, [marker, approvals[0], wrongActor, approvals[2], { tipo: 'INICIO_COORDINACION' }])).toBe('INCONSISTENTE');
    expect(manifestReadiness(manifest, [marker, { tipo: 'FIRMA', descripcion: 'firma antigua', usuarioId: 'g' }, ...approvals.slice(1), { tipo: 'INICIO_COORDINACION' }])).toBe('INCONSISTENTE');
  });
  it('marks coordination or unanimous decisions inconsistent with a pending state for review', () => {
    const start = { tipo: 'INICIO_COORDINACION' };
    expect(manifestReadiness({ ...manifest, estado: 'PENDIENTE_APROBACION' }, [marker, ...approvals.slice(0, 2), start])).toBe('INCONSISTENTE');
    expect(manifestReadiness({ ...manifest, estado: 'PENDIENTE_APROBACION' }, [marker, ...approvals])).toBe('INCONSISTENTE');
    expect(manifestReadiness({ ...manifest, estado: 'APROBADO' }, [marker, ...approvals.slice(0, 2), start])).toBe('INCONSISTENTE');
    expect(manifestReadiness({ ...manifest, estado: 'PENDIENTE_APROBACION' }, [marker, ...approvals.slice(0, 2)])).toBe('FALTAN_APROBACIONES');
    expect(manifestReadiness({ ...manifest, estado: 'APROBADO' }, [marker, ...approvals, start])).toBe('LISTA');
  });
  it('keeps an old in-situ agreement without a carrier blocked', () => {
    const old = { ...proposal, version: 1, modalidad: 'IN_SITU', transportistaId: null };
    expect(manifestReadiness({ ...manifest, modalidad: 'IN_SITU', transportistaId: null }, [{ tipo: MANIFEST_PROPOSAL, descripcion: JSON.stringify(old) }, ...approvals, { tipo: 'INICIO_COORDINACION' }])).toBe('SIN_TRANSPORTE');
  });
});
