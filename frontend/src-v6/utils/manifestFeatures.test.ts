import { expect, it } from 'vitest';
import { manifestFeatureVisible } from './manifestFeatures';
it('shows school features only to the authenticated training profile or an explicit release flag', () => {
  expect(manifestFeatureVisible('false', { training: true })).toBe(true);
  for (const user of [undefined, null, {}, { training: false }]) expect(manifestFeatureVisible('false', user)).toBe(false);
  expect(manifestFeatureVisible('true', { training: false })).toBe(true);
});
