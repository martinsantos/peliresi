import { useLocation } from 'react-router-dom';

export function useMobilePrefix() {
  const location = useLocation();
  const isMobile = location.pathname.startsWith('/mobile');
  return (path: string) => isMobile ? `/mobile${path}` : path;
}
