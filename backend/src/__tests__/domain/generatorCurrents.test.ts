import { describe, expect, it } from 'vitest';
import { decideGeneratorCurrents, exceptionsCoveredByFicha, formatCurrents, generatorAuthorizedCurrents, generatorCurrentsBackfillPlan, openExceptions, currentsDecisionMessage } from '../../domain/generatorCurrents';

const exception = (id: string, corrientes: string[], manifiestoId = 'm-old', cerradaAt: string | null = null) => ({ id, corrientes, manifiestoId, cerradaAt });

describe('generator ficha currents', () => {
  it('formats a ficha that parses back to exactly the same set', () => {
    const text = formatCurrents(['Y9', 'Y48', 'Y8', 'Y48']);
    expect(text).toBe('Y8, Y9, Y48');
    expect(generatorAuthorizedCurrents(text)).toEqual(['Y8', 'Y9', 'Y48']);
  });

  it('completes only empty fichas, matching CUIT with or without dashes, and never overwrites an edited one', () => {
    const plan = generatorCurrentsBackfillPlan([
      { id: 'a', cuit: '30712345678', corrientesControl: null },
      { id: 'b', cuit: '30-71234567-9', corrientesControl: '' },
      { id: 'c', cuit: '30712345670', corrientesControl: 'Y12' },
      { id: 'd', cuit: '20111111112', corrientesControl: null },
    ], {
      '30-71234567-8': { cuit: '30-71234567-8', categoriasControl: ['Y48', 'Y8'] },
      '30-71234567-9': { cuit: '30-71234567-9', categoriasControl: ['Y9'] },
      '30-71234567-0': { cuit: '30-71234567-0', categoriasControl: ['Y1'] },
    });
    expect(plan.changes).toEqual([{ id: 'a', antes: null, despues: 'Y8, Y48' }, { id: 'b', antes: '', despues: 'Y9' }]);
    expect(plan).toMatchObject({ conFicha: 1, sinDatos: 1, total: 4 });
  });
});

describe('one open exception per generator', () => {
  const base = { authorized: ['Y8', 'Y48'], manifiestoId: 'm1', exceptions: [] as ReturnType<typeof exception>[] };

  it('a quantity-only difference on authorized currents needs nothing', () => {
    expect(decideGeneratorCurrents({ ...base, corrientes: ['Y8'] })).toEqual({ estado: 'AUTORIZADAS' });
  });
  it('an empty ficha never blocks', () => {
    expect(decideGeneratorCurrents({ ...base, authorized: [], corrientes: ['Y12'] })).toEqual({ estado: 'SIN_FICHA' });
  });
  it('the first Y outside the ficha requires the authority exception', () => {
    expect(decideGeneratorCurrents({ ...base, corrientes: ['Y8', 'Y12'] })).toEqual({ estado: 'REQUIERE_EXCEPCION', corrientes: ['Y12'] });
  });
  it('with an open exception, a different unauthorized Y is refused', () => {
    const d = decideGeneratorCurrents({ ...base, corrientes: ['Y12'], exceptions: [exception('e1', ['Y34'])] });
    expect(d).toMatchObject({ estado: 'BLOQUEADA', corrientes: ['Y12'], excepcionAbierta: { id: 'e1' } });
    expect(currentsDecisionMessage(d, 'ADENDA')).toContain('Sólo el alta de esa corriente en la ficha');
  });
  it('with an open exception, the same Y again in another manifest is refused', () => {
    const d = decideGeneratorCurrents({ ...base, corrientes: ['Y34'], exceptions: [exception('e1', ['Y34'])] });
    expect(d).toMatchObject({ estado: 'BLOQUEADA' });
    expect(currentsDecisionMessage(d, 'CREACION')).toContain('ya se exceptuó una vez sin que se diera de alta');
  });
  it('the same manifest already exempted is the same event, not a second occurrence', () => {
    expect(decideGeneratorCurrents({ ...base, corrientes: ['Y34'], exceptions: [exception('e1', ['Y34'], 'm1')] })).toEqual({ estado: 'CUBIERTAS_POR_EXCEPCION', excepcionId: 'e1' });
  });
  it('a new Y in the same manifest beyond its exception is still refused', () => {
    expect(decideGeneratorCurrents({ ...base, corrientes: ['Y34', 'Y12'], exceptions: [exception('e1', ['Y34'], 'm1')] })).toMatchObject({ estado: 'BLOQUEADA' });
  });
  it('registering the exempted Y in the ficha frees the generator for a new exception, even before the closing hook', () => {
    const exceptions = [exception('e1', ['Y34'])];
    const authorized = ['Y8', 'Y48', 'Y34'];
    expect(openExceptions(exceptions, authorized)).toEqual([]);
    expect(exceptionsCoveredByFicha(exceptions, authorized).map(e => e.id)).toEqual(['e1']);
    expect(decideGeneratorCurrents({ authorized, manifiestoId: 'm2', corrientes: ['Y12'], exceptions })).toEqual({ estado: 'REQUIERE_EXCEPCION', corrientes: ['Y12'] });
  });
  it('a partially registered exception stays open', () => {
    const exceptions = [exception('e1', ['Y34', 'Y35'])];
    expect(openExceptions(exceptions, ['Y34']).map(e => e.id)).toEqual(['e1']);
    expect(exceptionsCoveredByFicha(exceptions, ['Y34'])).toEqual([]);
  });
  it('a closed exception never counts', () => {
    expect(decideGeneratorCurrents({ ...base, corrientes: ['Y12'], exceptions: [exception('e1', ['Y34'], 'm0', '2026-11-07T00:00:00Z')] })).toMatchObject({ estado: 'REQUIERE_EXCEPCION' });
  });
});
