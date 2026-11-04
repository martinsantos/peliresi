import { useCallback } from 'react';

export function useBlobDownload(blob: Blob) {
  return useCallback((link: HTMLAnchorElement | null) => {
    if (!link) return;
    const url = URL.createObjectURL(blob);
    link.href = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
}
