import { afterEach, expect, it, vi } from 'vitest';
import { inTrainingSession } from '../../lib/trainingScope';
import { clearGpsAnomalySampling, sampleGpsAnomalies } from '../../services/gpsAnomalySampling.service';

afterEach(() => {
  clearGpsAnomalySampling('sample-a');
  clearGpsAnomalySampling('sample-b');
  inTrainingSession(() => clearGpsAnomalySampling('sample-a'));
});

it('shares the sampling count across origin and relay, scoped by manifest', async () => {
  const detector = vi.fn().mockResolvedValue([]);
  for (let i = 0; i < 9; i++) sampleGpsAnomalies('sample-a', 'carrier', detector);
  sampleGpsAnomalies('sample-b', undefined, detector);
  sampleGpsAnomalies('sample-a', undefined, detector);
  await new Promise(resolve => setImmediate(resolve));
  expect(detector).toHaveBeenCalledTimes(1);
  expect(detector).toHaveBeenCalledWith('sample-a', undefined);
});

it('isolates operational and training counters', async () => {
  const detector = vi.fn().mockResolvedValue([]);
  for (let i = 0; i < 9; i++) sampleGpsAnomalies('sample-a', 'carrier', detector);
  inTrainingSession(() => sampleGpsAnomalies('sample-a', undefined, detector));
  await new Promise(resolve => setImmediate(resolve));
  expect(detector).not.toHaveBeenCalled();
  sampleGpsAnomalies('sample-a', 'carrier', detector);
  await new Promise(resolve => setImmediate(resolve));
  expect(detector).toHaveBeenCalledOnce();
});

it('clears a partial sample when the trip cache is invalidated', async () => {
  const detector = vi.fn().mockResolvedValue([]);
  for (let i = 0; i < 9; i++) sampleGpsAnomalies('sample-a', 'carrier', detector);
  clearGpsAnomalySampling('sample-a');
  sampleGpsAnomalies('sample-a', 'carrier', detector);
  await new Promise(resolve => setImmediate(resolve));
  expect(detector).not.toHaveBeenCalled();
});
