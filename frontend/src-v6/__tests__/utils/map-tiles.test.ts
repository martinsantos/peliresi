import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE_MAP_ATTRIBUTION, BASE_MAP_TILE_URL } from '../../utils/map-tiles';

const mapSurfaces = [
  'pages/monitor/components/WarRoomMap.tsx',
  'pages/centro-control/components/ControlMap.tsx',
  'pages/reportes/tabs/MapaActoresTab.tsx',
  'pages/manifiestos/ManifiestoDetallePage.tsx',
  'pages/tracking/ViajeEnCursoPage.tsx',
  'pages/transporte/ViajeEnCursoTransportista.tsx',
];

describe('SITREP basemap policy', () => {
  it('uses a keyless tile service with explicit attribution', () => {
    expect(BASE_MAP_TILE_URL).toBe('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(BASE_MAP_TILE_URL.toLowerCase()).not.toContain('key');
    expect(BASE_MAP_ATTRIBUTION).toContain('OpenStreetMap');
  });

  it.each(mapSurfaces)('%s consumes the shared basemap configuration', surface => {
    const source = readFileSync(resolve(process.cwd(), 'src-v6', surface), 'utf8');
    expect(source).toContain('BASE_MAP_TILE_URL');
    expect(source).toContain('BASE_MAP_ATTRIBUTION');
    expect(source).not.toContain('basemaps.cartocdn.com');
  });
});
