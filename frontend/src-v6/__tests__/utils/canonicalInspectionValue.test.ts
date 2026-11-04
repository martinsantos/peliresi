import { describe, expect, it } from 'vitest';
import { canonicalInspectionValue as canonical } from '../../pages/inspecciones/canonicalInspectionValue';
describe('inspection draft semantic equality', () => {
 it('matches nested map and measures after PostgreSQL JSONB key reordering', () => {
  const local={ubicacionCampo:{latitud:-32.89,longitud:-68.84,mapaImagen:'data:image/png;base64,abc'},medidas:[{id:'one',dias:10,detalle:'Presentar constancia'}]};
  const server={medidas:[{detalle:'Presentar constancia',dias:10,id:'one'}],ubicacionCampo:{mapaImagen:'data:image/png;base64,abc',longitud:-68.84,latitud:-32.89}};
  expect(JSON.stringify(canonical(local))).toBe(JSON.stringify(canonical(server)));
 });
 it('retains real changes and array order', () => {
  expect(canonical({medidas:[{dias:10}]})).not.toEqual(canonical({medidas:[{dias:11}]}));
  expect(canonical({medidas:['a','b']})).not.toEqual(canonical({medidas:['b','a']}));
 });
});
