/** Presentation only. The API verifies the signed training realm and its isolated store. */
export const manifestFeatureVisible = (operationalFlag: string | undefined, user: { training?: boolean } | null | undefined): boolean =>
  operationalFlag === 'true' || user?.training === true;
