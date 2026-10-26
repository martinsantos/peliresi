import { describe, expect, it } from 'vitest';
import { electricityReading, MENDOZA_DISTRIBUTORS } from '../../domain/electricityReading';
const issuers = ['EDEMSA', 'EDESTESA', 'Cooperativa Empresa Eléctrica de Godoy Cruz', 'Cooperativa Alto Verde y Algarrobo Grande', 'Cooperativa Popular de Rivadavia', 'CECSAGAL', 'Cooperativa Eléctrica de Medrano', 'Cooperativa Eléctrica de Monte Comán', 'COSPAC Bowen', 'Cooperativa Eléctrica de Santa Rosa', 'Cooperativa Sud Río Tunuyán'];
describe('Mendoza electricity evidence, without inference or a fiscal update', () => {
  it.each(issuers.map((name, index) => [name, MENDOZA_DISTRIBUTORS[index].id]))('recognizes the explicit distributor header %s', (name, id) => {
    const result = electricityReading(`${name}\nTarifa: T1-R3\nConsumo facturado: 1.234,5 kWh\nPotencia contratada: 25,5 kW\nPotencia registrada: 23 kW\nNIC: 123456789\nPeríodo: 2026/10`);
    expect(result.distribuidora).toBe(id); expect(result.campos).toMatchObject({ categoriaTarifaria: 'T1R3', consumoKwh: '1234.5', potenciaContratadaKw: '25.5', potenciaRegistradaKw: '23', suministro: '123456789', periodo: '2026/10' });
    expect(result.evidencias.some(item => item.campo === 'categoriaTarifaria')).toBe(true);
  });
  it.each([['T1 G', 'T1G'], ['T2 R BT', 'T2RBT'], ['T2 B MT/BT', 'T2BMT/BT'], ['T2 ES', 'T2ES'], ['TRA MT', 'TRAMT'], ['TP AT/MT', 'TPAT/MT'], ['T1 NR', 'T1NR'], ['T2', 'T2']])('preserves a labelled tariff code %s without deriving a demand or HP', (code, expected) => {
    const result = electricityReading(`EDEMSA\nTarifa: ${code}`); expect(result.campos.categoriaTarifaria).toBe(expected);
    expect(result.campos.consumoKwh).toBeUndefined(); expect(result.campos.potenciaContratadaKw).toBeUndefined();
    expect(result).not.toHaveProperty('potenciaHP'); expect(result).not.toHaveProperty('TEF');
  });
  it('handles units before values and keeps subsidy separate from the tariff', () => {
    const result = electricityReading('CEGC\nCategoría tarifaria T1R2\nConsumo (kWh): 420\nPotencia contratada (kW): 8,5\nNivel: 3');
    expect(result.campos).toMatchObject({ categoriaTarifaria: 'T1R2', consumoKwh: '420', potenciaContratadaKw: '8.5', nivelSubsidio: 'N3' });
    expect(electricityReading('EDESTE\nTarifa: T1 G\nCON SEF').campos.nivelSubsidio).toBe('CON SEF');
  });
  it('never determines residential category from consumption, history, total pesos or subsidy', () => {
    const result = electricityReading('EDEMSA\nConsumo: 1200 kWh\nNivel 1\nTotal: $95000\nHistoria del consumo 2026');
    expect(result.campos.categoriaTarifaria).toBeUndefined(); expect(result.campos.potenciaContratadaKw).toBeUndefined();
  });
  it('does not misread a monetary unit price as energy or contracted power', () => {
    const result = electricityReading('EDEMSA\nCONSUMO DE ENERGIA $/kWh 241,6774\nPOTENCIA CONTRATADA $/kW-mes 15000\nEnergía reactiva 300 kVArh');
    expect(result.campos).toEqual({});
  });
  it('does not choose one of two competing categories, supplies or issuers', () => {
    const result = electricityReading('EDEMSA\nCEGC\nTarifa: T1R1\nTarifa: T2\nNIC: 12345678\nNIC: 87654321');
    expect(result.distribuidora).toBeNull(); expect(result.campos.categoriaTarifaria).toBeUndefined(); expect(result.campos.suministro).toBeUndefined();
    expect(result.conflictos).toEqual(expect.arrayContaining(['distribuidora', 'categoriaTarifaria', 'suministro']));
  });
  it('does not identify Godoy Cruz from the customer address or mistake EDERSA/EDENOR for Mendoza', () => {
    for (const text of ['Domicilio Godoy Cruz, Mendoza', 'EDERSA\nTarifa: T1R1', 'EDENOR\nTarifa: T1R1', 'EDENSA']) expect(electricityReading(text).distribuidora).toBeNull();
  });
  it('keeps an unreadable invoice available with no invented category', () => {
    const result = electricityReading(''); expect(result.distribuidora).toBeNull(); expect(result.campos).toEqual({}); expect(result.aviso).toContain('no cambian la TEF');
  });
  it.each(['1 234,5', '1\u00a0234,5', '1\u202f234,5'])('reads the whole grouped value with the unit before it: %s', value => {
    const result = electricityReading(`CEGC\nConsumo (kWh): ${value}\nPotencia contratada (kW): 25,5`);
    expect(result.campos.consumoKwh).toBe('1234.5');
    expect(result.campos.potenciaContratadaKw).toBe('25.5');
    expect(result.evidencias.find(item => item.campo === 'consumoKwh')?.texto).toContain(value);
  });
  it.each(['Consumo: 12 34 kWh', 'Consumo: 120  240 kWh', 'Consumo (kWh): 120\t240',
    'Consumo (kWh): 25,12345', 'Consumo (kWh): 25 kVA', 'Consumo -250 kWh',
    'Consumo (kWh) -250', 'Consumo (kWh): -250', 'Consumo: 250 kWh/mes'])('does not publish a truncated, signed or ambiguous amount: %s', line => {
    const result = electricityReading(`EDEMSA\n${line}`);
    expect(result.campos.consumoKwh).toBeUndefined();
  });
  it.each(['Potencia contratada (kW): 1 234,5', 'Potencia contratada: 1 234,5 kW'])('uses the same complete number rule for power: %s', line => {
    expect(electricityReading(line).campos.potenciaContratadaKw).toBe('1234.5');
  });
  it('does not discard an unreadable competing labelled amount in favor of a clean one', () => {
    const result = electricityReading('EDEMSA\nConsumo: 1234 kWh\nConsumo (kWh): 12 34');
    expect(result.campos.consumoKwh).toBeUndefined();
    expect(result.conflictos).toContain('consumoKwh');
  });
  it('keeps independent, explicitly labelled amounts on the same line', () => {
    const result = electricityReading('Consumo: 1250 kWh   Potencia contratada: 45 kW');
    expect(result.campos).toMatchObject({ consumoKwh: '1250', potenciaContratadaKw: '45' });
    expect(electricityReading('Consumo: 250 kWh / mes').campos.consumoKwh).toBeUndefined();
  });
  it.each(['kW-mes', 'kW · mes', 'kW.mes', 'kW–mes'])('does not truncate a compound power unit to kW: %s', unit => {
    const result = electricityReading(`EDEMSA\nPotencia contratada: 15000 ${unit}`);
    expect(result.campos.potenciaContratadaKw).toBeUndefined();
  });
  it('keeps a real consumption when another labelled line is a compound unit', () => {
    const result = electricityReading('EDESTE\nConsumo: 420 kWh\nConsumo: 241 kWh-mes');
    expect(result.campos.consumoKwh).toBe('420');
    expect(result.conflictos).not.toContain('consumoKwh');
  });
  it('recognizes equal labelled values despite decimal precision and leading zeroes', () => {
    const result = electricityReading('CECSAGAL\nConsumo: 1.250 kWh\nConsumo (kWh): 1250,00\nPotencia contratada: 025,50 kW\nPotencia contratada (kW): 25,5');
    expect(result.campos).toMatchObject({ consumoKwh: '1250', potenciaContratadaKw: '25.5' });
    expect(result.conflictos).toEqual([]);
    expect(result.evidencias).toHaveLength(4);
  });
});
