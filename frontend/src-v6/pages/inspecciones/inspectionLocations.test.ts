import { describe, expect, it } from 'vitest';
import { inspectionLocationSuggestions } from './inspectionLocations';

describe('Declared locations, never inferred field facts', () => {
  it('offers distinct real, declared and legal addresses with explicit origins', () => {
    expect(inspectionLocationSuggestions({ domicilio: 'Registro 100', domicilioRealCalle: 'Planta 200', domicilioRealLocalidad: 'Las Heras', domicilioRealDepto: 'Las Heras', domicilioLegalCalle: 'Oficina 300', domicilioLegalDepto: 'Capital' })).toEqual([
      { label: 'Domicilio real', value: 'Planta 200, Las Heras' },
      { label: 'Domicilio declarado', value: 'Registro 100' },
      { label: 'Domicilio legal', value: 'Oficina 300, Capital' },
    ]);
  });

  it('deduplicates whitespace and case, keeping the physical-origin label', () => {
    expect(inspectionLocationSuggestions({ domicilio: ' CALLE   100 ', domicilioRealCalle: 'Calle 100', domicilioLegalCalle: 'calle 100' })).toEqual([{ label: 'Domicilio real', value: 'Calle 100' }]);
  });

  it('does not invent an address from a locality, invalid data or an absent actor', () => {
    expect(inspectionLocationSuggestions()).toEqual([]);
    expect(inspectionLocationSuggestions({ domicilio: { text: 'Unknown' }, domicilioRealCalle: ' ', domicilioRealLocalidad: 'Capital', domicilioLegalDepto: 'Las Heras' })).toEqual([]);
  });

  it('uses the preserved declaration, not updated current actor fields', () => {
    expect(inspectionLocationSuggestions({ domicilio: 'New address', domicilioRealCalle: 'New plant' }, [{ codigo: 'CON-DOMICILIO', valorDeclarado: 'Declared before visit' }])).toEqual([{ label: 'Domicilio declarado', value: 'Declared before visit' }]);
  });

  it('keeps a deliberately empty declared address empty', () => {
    expect(inspectionLocationSuggestions({ domicilio: 'New address' }, [{ codigo: 'CON-DOMICILIO', valorDeclarado: null }])).toEqual([]);
  });

  it('offers complete preserved site references without parsing or guessing their address', () => {
    expect(inspectionLocationSuggestions(null, [{ codigo: 'EST-SEDES', valorDeclarado: 'Planta norte · FIJO · Acceso 100\r\nPlanta sur · FIJO · Acceso 200\n\nPlanta norte · FIJO · Acceso 100' }])).toEqual([
      { label: 'Sede declarada', value: 'Planta norte · FIJO · Acceso 100' },
      { label: 'Sede declarada', value: 'Planta sur · FIJO · Acceso 200' },
    ]);
  });
});
