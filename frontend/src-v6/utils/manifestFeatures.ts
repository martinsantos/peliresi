/** Presentation only. The API verifies the signed training realm and its isolated store. */
export const manifestFeatureVisible = (operationalFlag: string | undefined, user: { training?: boolean } | null | undefined): boolean =>
  operationalFlag === 'true' || user?.training === true;

/** Ordinary three-party proposals; independent from post-factum addendum review. */
export const manifestProposalsVisible = (user: { training?: boolean } | null | undefined): boolean =>
  manifestFeatureVisible(import.meta.env.VITE_MANIFEST_PROPOSALS_ENABLED, user);
