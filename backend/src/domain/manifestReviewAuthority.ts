import { isTrainingSession } from '../lib/trainingScope';

/** Explicit deployment policy; classroom scope and the legacy account list stay isolated. */
export function reviewAuthorityByRole(): boolean {
  return !isTrainingSession() && process.env.MANIFEST_REVIEW_AUTHORITY_BY_ROLE === 'true';
}

export function designatedReviewAccount(id: string): boolean {
  return reviewAuthorityByRole() || (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').filter(Boolean).includes(id);
}

export function reviewAuthorityAccountFilter(): { id?: { in: string[] } } {
  return reviewAuthorityByRole() ? {} : { id: { in: (process.env.MANIFEST_EXCEPTIONAL_REVIEWERS || '').split(',').filter(Boolean) } };
}
