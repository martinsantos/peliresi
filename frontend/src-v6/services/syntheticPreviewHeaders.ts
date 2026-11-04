import axios from 'axios';

export const SYNTHETIC_PREVIEW_HEADER = 'X-SITREP-Synthetic-Preview';

/** A build marker for client/API compatibility, never an authorization token. */
export function syntheticPreviewHeaders(enabled = import.meta.env.VITE_SYNTHETIC_PREVIEW === 'true'): Record<string, string> {
  return enabled ? { [SYNTHETIC_PREVIEW_HEADER]: '1' } : {};
}

// A few public and refresh flows intentionally use the global Axios client.
// The normal build must not mutate its defaults.
if (import.meta.env.VITE_SYNTHETIC_PREVIEW === 'true') {
  axios.defaults.headers.common[SYNTHETIC_PREVIEW_HEADER] = '1';
}
