import { describe, expect, it } from 'vitest';
import { gpsNoticeContext, gpsNoticeTitle } from '../../utils/gpsNoticeContext';
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
  it('keeps the original geographic-corridor message and explains that reception may be later than capture', () => {
    const notice = { tipo: 'ALERTA_SISTEMA', datos: JSON.stringify({ evento: 'ANOMALIA_GPS', tipoAnomalia: 'FUERA_CORREDOR_GEOGRAFICO' }), mensaje: 'Tres posiciones consecutivas se mantuvieron fuera del corredor estimado' };
    expect(gpsNoticeContext(notice)).toMatch(/hora de captura.*recepci[oó]n/i);
    expect(gpsNoticeContext(notice)).toMatch(/verific[aá].*transporte/i);
    expect(gpsNoticeContext(notice)).toMatch(/no se compara una ruta vial autorizada/i);
    expect(notice.mensaje).toBe('Tres posiciones consecutivas se mantuvieron fuera del corredor estimado');
  });
  it('recognizes an older unstructured corridor notice without duplicating its route warning', () => {
    const notice = { tipo: 'ANOMALIA_DETECTADA', datos: null, mensaje: 'Tres posiciones se mantuvieron fuera del corredor geográfico estimado. No se compara una ruta vial autorizada.' };
    expect(gpsNoticeContext(notice)).toMatch(/hora de captura.*recepci[oó]n/i);
    expect(gpsNoticeContext(notice)).not.toMatch(/no se compara una ruta vial autorizada/i);
  });
  it('does not repeat the context of a new corridor notice', () => {
    expect(gpsNoticeContext({ tipo: 'ANOMALIA_DETECTADA', datos: null,
      mensaje: 'Tres posiciones recibidas fuera del corredor geográfico. No se compara una ruta vial autorizada. Hora de captura no disponible. Verificá el caso con transporte.' })).toBeNull();
  });
  it('labels only the generic direct corridor notice without changing configured rule names', () => {
    const notice = { tipo: 'ANOMALIA_DETECTADA', titulo: '⚠️ Anomalía GPS Detectada', mensaje: 'Tres posiciones recibidas fuera del corredor geográfico estimado.' };
    expect(gpsNoticeTitle(notice)).toBe('GPS: corredor para revisar');
    expect(notice.titulo).toBe('⚠️ Anomalía GPS Detectada');
    expect(gpsNoticeTitle({ ...notice, tipo: 'ALERTA_SISTEMA', titulo: 'Regla elegida por Ambiente' })).toBeNull();
    expect(gpsNoticeTitle({ ...notice, mensaje: 'Otra observación GPS' })).toBeNull();
  });
  it('does not add it to unrelated notices', () => {
    expect(gpsNoticeContext({ tipo: 'MANIFIESTO_FIRMADO', datos: null, mensaje: 'Manifiesto aprobado' })).toBeNull();
  });
});

it('shows the related manifest only when the original notice has not named it', () => {
  const manifest = { numero: 'QA-001' };
  expect(notificationManifestReference({ manifiesto: manifest, titulo: 'GPS', mensaje: 'Revisá' })).toBe('Manifiesto QA-001');
  expect(notificationManifestReference({ manifiesto: manifest, titulo: 'GPS', mensaje: 'QA-001 · Revisá' })).toBeNull();
  expect(notificationManifestReference({ manifiesto: null, titulo: 'GPS', mensaje: 'Revisá' })).toBeNull();
});
