import { afterEach, describe, expect, it, vi } from 'vitest';
import { canOfferManifestDelete, canOfferManifestCreate } from '../../utils/manifestActions';

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

afterEach(()=>vi.unstubAllEnvs());
it.each(['GENERADOR','TRANSPORTISTA','OPERADOR'])('offers proposal creation for authenticated %s only in the enabled surface',role=>{
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','true');expect(canOfferManifestCreate(role,false)).toBe(true);
 vi.stubEnv('VITE_MANIFEST_PROPOSALS_ENABLED','false');expect(canOfferManifestCreate(role,false)).toBe(role==='GENERADOR');
});
