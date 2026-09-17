import { describe, expect, it } from 'vitest';
import { calculateAverageStageTimes } from '../../utils/workflowMetrics';

describe('workflow metrics', () => {
  it('calculates delivery to reception using different timestamps', () => {
    const result = calculateAverageStageTimes([{
      createdAt: '2026-08-10T08:00:00Z',
      fechaFirma: '2026-08-10T09:00:00Z',
      fechaRetiro: '2026-08-10T10:00:00Z',
      fechaEntrega: '2026-08-10T12:00:00Z',
      fechaRecepcion: '2026-08-10T15:30:00Z',
      fechaCierre: '2026-08-10T18:00:00Z',
    }]);

    expect(result.find(stage => stage.name === 'Entrega → Recepción')).toEqual({
      name: 'Entrega → Recepción',
      value: 3.5,
      sampleSize: 1,
    });
  });

  it('does not mix missing or chronologically invalid samples', () => {
    const result = calculateAverageStageTimes([{
      createdAt: '2026-08-10T08:00:00Z',
      fechaFirma: null,
      fechaRetiro: null,
      fechaEntrega: '2026-08-10T15:00:00Z',
      fechaRecepcion: '2026-08-10T12:00:00Z',
      fechaCierre: null,
    }]);
    expect(result.find(stage => stage.name === 'Entrega → Recepción')?.sampleSize).toBe(0);
  });
});
