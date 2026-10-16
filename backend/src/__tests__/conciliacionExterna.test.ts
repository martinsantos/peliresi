import { expect, it } from 'vitest';
import { verifiedCuit, reconciliationCommand, csvCell } from '../domain/conciliacionExterna';

it('accepts only complete checksum-valid CUIT, never guesses an identity', () => {
  expect(verifiedCuit('30-71234567-1')).toBe('30712345671');
  for (const value of ['', 'QA-123', '30712345670', '30.71234567.1', '=30712345671', '00000000000'])
    expect(verifiedCuit(value)).toBeNull();
});
it('requires explicit audited commands and rejects forged or ambiguous fields', () => {
  const base = { id: '12345678-1234-4123-8123-123456789abc', revision: 0, rol: 'generador', accion: 'VINCULAR', motivo: 'Identidad verificada', actorId: 'actor' };
  expect(reconciliationCommand.safeParse(base).success).toBe(true);
  for (const value of [{ ...base, motivo: '' }, { ...base, actorId: undefined }, { ...base, revision: -1 },
    { ...base, accion: 'DESVINCULAR' }, { ...base, autorId: 'forged' }])
    expect(reconciliationCommand.safeParse(value).success).toBe(false);
  expect(reconciliationCommand.safeParse({ ...base, accion: 'DESVINCULAR', actorId: undefined }).success).toBe(true);
});
it('quotes separators/newlines and neutralizes spreadsheet formulas, including leading whitespace', () => {
  expect(csvCell('a;"b\nc')).toBe('"a;""b\nc"');
  for (const value of ['=CMD()', ' +SUM(1)', '\t-1', '@SUM(1)', '\r=1'])
    expect(csvCell(value).startsWith('"\'')).toBe(true);
  expect(csvCell('105')).toBe('"105"');
});
