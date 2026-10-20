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
});
