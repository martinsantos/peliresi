import { describe, expect, it } from 'vitest';
import { gpsNoticeContext } from '../../utils/gpsNoticeContext';
import { notificationManifestReference } from '../../utils/notificationManifestReference';

describe('GPS notices recorded before capture-time clarification', () => {
  it.each([
    { tipo: 'ANOMALIA_DETECTADA', datos: null, mensaje: 'Velocidad anormalmente alta detectada: 250 km/h' },
    { tipo: 'ALERTA_SISTEMA', datos: JSON.stringify({ evento: 'ANOMALIA_GPS', tipoAnomalia: 'GPS_PERDIDO' }), mensaje: 'Regla activada: GPS' },
  ])('adds a reading guide without rewriting the saved message', notice => {
    expect(gpsNoticeContext(notice)).toMatch(/hora de captura.*recepci[oó]n/i);
    expect(gpsNoticeContext(notice)).toMatch(/verific[aá].*transporte/i);
  });
  it('does not duplicate the explanation already in a new notice', () => {
    expect(gpsNoticeContext({ tipo: 'ANOMALIA_DETECTADA', datos: null,
      mensaje: 'Hora de captura no disponible. Verificá el caso con transporte.' })).toBeNull();
  });
  it('does not add it to unrelated notices or a clearly identified geographic corridor', () => {
    expect(gpsNoticeContext({ tipo: 'MANIFIESTO_FIRMADO', datos: null, mensaje: 'Manifiesto aprobado' })).toBeNull();
    expect(gpsNoticeContext({ tipo: 'ALERTA_SISTEMA', datos: JSON.stringify({ evento: 'ANOMALIA_GPS', tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO' }), mensaje: 'Fuera del corredor estimado' })).toBeNull();
  });
});

it('shows the related manifest only when the original notice has not named it', () => {
  const manifest = { numero: 'QA-001' };
  expect(notificationManifestReference({ manifiesto: manifest, titulo: 'GPS', mensaje: 'Revisá' })).toBe('Manifiesto QA-001');
  expect(notificationManifestReference({ manifiesto: manifest, titulo: 'GPS', mensaje: 'QA-001 · Revisá' })).toBeNull();
  expect(notificationManifestReference({ manifiesto: null, titulo: 'GPS', mensaje: 'Revisá' })).toBeNull();
});
