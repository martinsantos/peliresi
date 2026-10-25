import { useLayoutEffect } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/** Keep the ficha tab in the URL, including across edit and reload. */
export function useActorDetailNavigation(tabs: string[]) {
  const location = useLocation();
  useLayoutEffect(() => {
    // Desktop scrolls the main panel; the app may scroll the document.
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  }, [location.pathname]);
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab') || 'info';
  const activeTab = tabs.includes(requested) ? requested : 'info';
  const onChange = (tab: string) => {
    if (!tabs.includes(tab)) return;
    const next = new URLSearchParams(params);
    if (tab === 'info') next.delete('tab'); else next.set('tab', tab);
    setParams(next, { replace: true, state: location.state });
  };
  return { activeTab, onChange };
}

/** Only the same actor's ficha on this router surface can be the edit destination. */
export function actorEditReturn(state: unknown, listPath: string, id: string): string {
  const fallback = listPath + '/' + encodeURIComponent(id);
  const value = (state as { actorDetailReturn?: unknown } | null)?.actorDetailReturn;
  if (typeof value !== 'string' || value.length > 6000 || /[\\\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://sitrep.invalid');
    return url.origin === 'https://sitrep.invalid' && url.pathname === fallback ? fallback + url.search : fallback;
  } catch { return fallback; }
}
