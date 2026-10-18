import { describe, expect, it } from 'vitest';
import { registrationFleet } from '../../domain/registrationFleet';

const driver = { key: 'driver-qa-001', nombre: 'Juan', apellido: 'QA', dni: '30123456', licencia: 'QA-001', vencimiento: '2027-12-31', telefono: '0261-555-0000' };
const vehicle = { key: 'vehicle-qa-001', patente: 'QA123AB', marca: 'QA', modelo: 'Camión', anio: '2026', capacidad: '1000', numeroHabilitacion: 'QA-VEH', vencimiento: '2027-12-31' };
describe('registration approval creates actual fleet from the shared declaration', () => {
  it('maps only allowed driver/vehicle fields and preserves actual units', () => {
    const result = registrationFleet({ choferesJson: JSON.stringify([{ ...driver, activo: false, transportistaId: 'foreign' }]), vehiculosJson: JSON.stringify([vehicle]) });
    expect(result.choferes?.create[0]).toEqual({ nombre: 'Juan', apellido: 'QA', dni: '30123456', licencia: 'QA-001', vencimiento: new Date('2027-12-31T00:00:00Z'), telefono: '0261-555-0000' });
    expect(result.vehiculos?.create[0]).toMatchObject({ patente: 'QA123AB', anio: 2026, capacidad: 1000 });
    expect(result.vehiculos?.create[0]).not.toHaveProperty('key');
  });
  it('keeps legacy free text without manufacturing operative rows', () => {
    expect(registrationFleet({ vehiculosDesc: 'Old unstructured fleet', choferesDesc: 'Old names' })).toEqual({});
    expect(registrationFleet({})).toEqual({});
  });
  it.each(['{broken', '{}', '[null]'])('rejects invalid structured JSON %s before creating an actor', value => {
    expect(() => registrationFleet({ choferesJson: value })).toThrow();
  });
  it.each(['2027-02-31', '', 'not-a-date'])('rejects invalid driver expiry %s', vencimiento => {
    expect(() => registrationFleet({ choferesJson: JSON.stringify([{ ...driver, vencimiento }]) })).toThrow();
  });
  it('rejects duplicates and negative capacity rather than silently losing them', () => {
    expect(() => registrationFleet({ choferesJson: JSON.stringify([driver, driver]) })).toThrow();
    expect(() => registrationFleet({ vehiculosJson: JSON.stringify([{ ...vehicle, capacidad: '-1' }]) })).toThrow();
  });
});
