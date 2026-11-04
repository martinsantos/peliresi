import { isTrainingSession } from './trainingScope';

type ManifestFlag = 'MANIFEST_EXCEPTIONAL_ENABLED' | 'MANIFEST_ADDENDA_ENABLED' | 'MANIFEST_PARTY_REVIEW_ENABLED';
/** A signed school realm uses the restricted training database; operational flags stay opt-in. */
export const manifestFeatureEnabled = (flag: ManifestFlag): boolean => isTrainingSession() || process.env[flag] === 'true';

/** Simulate the selected school participant, retaining the original request for
 * attribution. Never relax impersonation restrictions in an operational session.
 * Existing role, linked-party, restricted-token and self-review checks still run.
 */
export function manifestPracticeIdentity<T extends { email?: string; impersonatedBy?: unknown }>(user: T): T {
  return isTrainingSession() && user.email?.endsWith('@capacitacion.invalid')
    ? { ...user, impersonatedBy: undefined } : user;
}
