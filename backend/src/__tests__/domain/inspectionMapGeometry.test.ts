import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { inspectionFieldExtensions } from '../../domain/inspectionFieldModel';
import { areaSquareMeters, distanceMeters, inspectionMapSummary, perimeterMeters } from '../../domain/inspectionMapGeometry';

const point = { latitud: -32.89, longitud: -68.84 };
// ~100 m × ~100 m square around the point (1° lat ≈ 111.2 km; longitude scaled by cos(lat)).
const dLat = 100 / 111195, dLon = 100 / (111195 * Math.cos(-32.89 * Math.PI / 180));
const square = [point, { latitud: point.latitud + dLat, longitud: point.longitud }, { latitud: point.latitud + dLat, longitud: point.longitud + dLon }, { latitud: point.latitud, longitud: point.longitud + dLon }];
const schema = z.object(inspectionFieldExtensions);
const location = { ...point, origen: 'MAPA', registradaAt: '2026-11-03T15:00:00Z' };

describe('geometría aproximada del mapa de inspección', () => {
  it('mide distancias, superficie y perímetro con error menor al 1 %', () => {
    expect(distanceMeters(point, { latitud: point.latitud + 1, longitud: point.longitud }) / 111195).toBeCloseTo(1, 2);
    expect(areaSquareMeters(square)).toBeGreaterThan(9900); expect(areaSquareMeters(square)).toBeLessThan(10100);
    expect(perimeterMeters(square)).toBeGreaterThan(396); expect(perimeterMeters(square)).toBeLessThan(404);
    expect(areaSquareMeters(square.slice(0, 2))).toBe(0);
  });
  it('resume sector y referencias con la numeración de la imagen y avisa que es aproximado', () => {
    const lines = inspectionMapSummary({ ...point, perimetro: square, referencias: [
      { id: 'a', tipo: 'VIVIENDA', etiqueta: 'Casa lindera', latitud: point.latitud + dLat, longitud: point.longitud },
      { id: 'b', tipo: 'CURSO_AGUA', etiqueta: ' ', latitud: point.latitud, longitud: point.longitud + 3 * dLon },
    ] });
    expect(lines[0]).toMatch(/^Sector observado, trazado aproximado por el inspector: 4 vértices · superficie ≈ [\d.,]+ (m²|ha) · perímetro ≈ \d{3} m\. No delimita el predio inscripto\.$/);
    expect(lines[2]).toBe('1. Vivienda — Casa lindera · 100 m');
    expect(lines[3]).toBe('2. Curso o cuerpo de agua · 300 m');
    expect(inspectionMapSummary(point)).toEqual([]);
  });
  it('acepta actas anteriores y un trazado válido', () => {
    expect(schema.safeParse({ ubicacionCampo: location }).success).toBe(true);
    expect(schema.safeParse({ ubicacionCampo: { ...location, perimetro: square, referencias: [{ id: 'r', tipo: 'AMPLIACION', etiqueta: '', ...square[2] }] } }).success).toBe(true);
  });
  it('rechaza sectores incompletos, tipos desconocidos y marcas lejanas', () => {
    expect(schema.safeParse({ ubicacionCampo: { ...location, perimetro: square.slice(0, 2) } }).success).toBe(false);
    expect(schema.safeParse({ ubicacionCampo: { ...location, referencias: [{ id: 'r', tipo: 'ZONA_INDUSTRIAL', ...point }] } }).success).toBe(false);
    const far = schema.safeParse({ ubicacionCampo: { ...location, referencias: [{ id: 'r', tipo: 'OTRO', latitud: point.latitud + 0.2, longitud: point.longitud }] } });
    expect(far.success).toBe(false); expect(JSON.stringify(far.error?.issues)).toContain('10 km');
    expect(schema.safeParse({ ubicacionCampo: { ...location, perimetro: square.map(p => ({ ...p, extra: 1 })) } }).success).toBe(false);
  });
});
