import { assessGeographicCorridor } from '../../services/gpsCorridor.service';

const corridor = {
  origin: { latitud: -32.89, longitud: -68.84 },
  destination: { latitud: -34.62, longitud: -68.33 },
};

describe('assessGeographicCorridor', () => {
  it('does not raise an anomaly from a single noisy GPS point', () => {
    expect(assessGeographicCorridor([{ latitud: -31.4, longitud: -66.0 }], corridor)).toBeNull();
  });

  it('does not raise when one of the recent samples returns to the corridor', () => {
    expect(assessGeographicCorridor([
      { latitud: -31.4, longitud: -66.0 },
      { latitud: -33.2, longitud: -68.7 },
      { latitud: -31.5, longitud: -66.1 },
    ], corridor)).toBeNull();
  });

  it('classifies three sustained distant points as a geographic anomaly', () => {
    const result = assessGeographicCorridor([
      { latitud: -31.4, longitud: -66.0 },
      { latitud: -31.5, longitud: -66.1 },
      { latitud: -31.6, longitud: -66.2 },
    ], corridor);
    expect(result).not.toBeNull();
    expect(result!.minimumDistanceKm).toBeGreaterThan(50);
  });
});
