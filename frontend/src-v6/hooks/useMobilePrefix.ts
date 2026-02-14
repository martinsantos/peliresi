import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export function useMobilePrefix() {
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  return useCallback(
    (path: string) => isMobile ? `/mobile${path}` : path,
    [isMobile]
  );
}
