import { describe, expect, it } from 'vitest';
import { canOfferManifestDelete } from '../../utils/manifestActions';

describe('manifest delete is offered only where the server accepts it', () => {
  it.each(['BORRADOR', 'CANCELADO'])('GENERADOR and ADMIN may delete %s', estado => {
    expect(canOfferManifestDelete('GENERADOR', estado)).toBe(true);
    expect(canOfferManifestDelete('ADMIN', estado)).toBe(true);
  });
  it.each(['APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'])('nobody is offered delete on %s', estado => {
    expect(canOfferManifestDelete('GENERADOR', estado)).toBe(false);
    expect(canOfferManifestDelete('ADMIN', estado)).toBe(false);
  });
  it.each(['TRANSPORTISTA', 'OPERADOR', 'ADMIN_GENERADOR', 'INSPECTOR', undefined])('%s is not offered delete', rol => {
    expect(canOfferManifestDelete(rol, 'BORRADOR')).toBe(false);
  });
});
