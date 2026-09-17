import { describe, expect, it } from 'vitest';
import { getReviewFixture, type TipoActor } from '../../pages/public/inscripcion/shared';

describe('public registration review fixture', () => {
  it.each(['GENERADOR', 'OPERADOR', 'TRANSPORTISTA'] as TipoActor[])('prefills a complete %s review fixture', (tipoActor) => {
    const fixture = getReviewFixture(tipoActor);

    expect(fixture.reg.email).toBe('qa-alta@sitrep.local');
    expect(fixture.form.razonSocial).toBeTruthy();
    expect(fixture.form.domicilio).toBeTruthy();
  });

  it('includes structured transport data for the transportista wizard', () => {
    const fixture = getReviewFixture('TRANSPORTISTA');

    expect(JSON.parse(fixture.form.vehiculosJson)).toHaveLength(1);
    expect(JSON.parse(fixture.form.choferesJson)).toHaveLength(1);
  });
});
