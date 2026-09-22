import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

describe('SheetJS import tooling', () => {
  it('uses the maintained release and preserves a basic workbook round trip', () => {
    expect(XLSX.version).toBe('0.20.3');

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['CUIT', 'Razon Social'],
      ['30-71123596-1', 'ALFA SERVICE'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Actores');

    const serialized = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const reopened = XLSX.read(serialized, { type: 'buffer' });
    const rows = XLSX.utils.sheet_to_json<string[]>(reopened.Sheets.Actores, { header: 1 });

    expect(rows).toEqual([
      ['CUIT', 'Razon Social'],
      ['30-71123596-1', 'ALFA SERVICE'],
    ]);
  });
});
