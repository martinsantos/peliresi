import { expect, it } from 'vitest';
import { createGpsFixOrder, gpsFixFingerprint } from '../../utils/gpsFixOrder';

it('rejects a demonstrably older sensor callback within a watcher', () => {
  const accept = createGpsFixOrder();
  expect(accept(100_000, 100_000)).toBe(true);
  expect(accept(99_000, 101_000)).toBe(false);
  expect(accept(100_000, 102_000)).toBe(true);
  expect(accept(103_000, 103_000)).toBe(true);
});

it('allows a new comparison window after the device clock moves backwards', () => {
  const accept = createGpsFixOrder();
  expect(accept(100_000, 100_000)).toBe(true);
  expect(accept.epoch()).toBe(0);
  expect(accept(80_000, 80_000)).toBe(true);
  expect(accept.epoch()).toBe(1);
  expect(accept(79_000, 81_000)).toBe(false);
});

it('does not invent ordering for a reading with no usable timestamp', () => {
  const accept = createGpsFixOrder();
  expect(accept(100_000, 100_000)).toBe(true);
  expect(accept(NaN, 101_000)).toBe(true);
  expect(accept(99_000, 102_000)).toBe(false);
});

it('recognizes a repeated dated fix without conflating distinct or undated readings', () => {
  const point = { latitud: -33, longitud: -68, precision: 10 };
  expect(gpsFixFingerprint(100_000, point)).toBe(gpsFixFingerprint(100_000, point));
  expect(gpsFixFingerprint(100_000, point)).not.toBe(gpsFixFingerprint(101_000, point));
  expect(gpsFixFingerprint(100_000, point)).not.toBe(gpsFixFingerprint(100_000, { ...point, latitud: -34 }));
  expect(gpsFixFingerprint(NaN, point)).toBeNull();
});
