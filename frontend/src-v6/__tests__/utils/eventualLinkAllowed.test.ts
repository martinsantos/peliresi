import { describe, expect, it } from 'vitest';
import { eventualLinkAllowed } from '../../types/inspectionIntake';

describe('link candidates for an eventual antecedent', () => {
  it('offers only cases whose field stage is open', () => {
    const eventual = { origen: 'PARTICIPANTE_EVENTUAL' };
    expect(['BORRADOR', 'PLANIFICADA', 'EN_CAMPO'].every(estado => eventualLinkAllowed(eventual, { estado }))).toBe(true);
    expect(['EN_REVISION', 'NOTIFICADA', 'CERRADA_CONFORME', 'FINALIZADA'].some(estado => eventualLinkAllowed(eventual, { estado }))).toBe(false);
  });
  it('does not restrict other antecedents', () => {
    expect(eventualLinkAllowed({ origen: 'INFORME_ADENDA' }, { estado: 'CERRADA_CONFORME' })).toBe(true);
  });
});
