import { describe, expect, it } from 'vitest';
import { capacityFormValue, vehicleUpdatePayload, type VehicleFormValues } from '../../utils/vehicleUpdate';

const form = (patch: Partial<VehicleFormValues> = {}): VehicleFormValues => ({
  patente: 'AB123CD', marca: 'Iveco', modelo: 'Tector', anio: '2020', capacidad: '1500.5', numeroHabilitacion: '', vencimiento: '', activo: true, ...patch,
});
const now = new Date('2026-10-17T12:00:00Z');

describe('vehicle edit never corrupts stored values', () => {
  it('prefills capacity from the raw number, so 1500.5 kg is not re-read as 15005', () => {
    expect(capacityFormValue(1500.5)).toBe('1500.5');
    expect(vehicleUpdatePayload(form({ capacidad: capacityFormValue(1500.5) }), now)).toEqual({ data: expect.objectContaining({ capacidad: 1500.5 }) });
  });
  it('keeps the stored year and capacity when the fields are left empty instead of sending 0', () => {
    const result = vehicleUpdatePayload(form({ anio: '', capacidad: '' }), now);
    expect(result).toEqual({ data: expect.not.objectContaining({ anio: expect.anything() }) });
    expect('data' in result && 'capacidad' in result.data).toBe(false);
  });
  it('rejects an impossible year or capacity before sending', () => {
    expect(vehicleUpdatePayload(form({ anio: '0' }), now)).toEqual({ error: 'El año debe estar entre 1950 y 2027.' });
    expect(vehicleUpdatePayload(form({ capacidad: '0' }), now)).toEqual({ error: 'La capacidad debe ser un número mayor a 0 kg.' });
  });
  it('accepts a decimal comma typed on a Spanish keyboard', () => {
    expect(vehicleUpdatePayload(form({ capacidad: '1500,5' }), now)).toEqual({ data: expect.objectContaining({ capacidad: 1500.5 }) });
  });
});
