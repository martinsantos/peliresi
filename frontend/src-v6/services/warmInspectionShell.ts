/** First navigation can finish before the worker takes control. Warm only the
 * already-used hashed JS/CSS so a saved inspection also has a renderable shell. */
export async function warmInspectionShell(): Promise<void> {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !navigator.onLine) return;
  if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => {
    const finish = () => { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', finish); resolve(); };
    const timer = setTimeout(finish, 10_000);
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
  });
  if (!navigator.serviceWorker.controller || !navigator.onLine) return;
  const prefix = import.meta.env.BASE_URL + 'assets/';
  const urls = [...new Set(performance.getEntriesByType('resource').map(entry => entry.name))].filter(value => {
    const url = new URL(value);
    return url.origin === location.origin && /\.(js|css)$/.test(url.pathname)
      && (url.pathname.startsWith(prefix) || url.pathname === import.meta.env.BASE_URL + 'inspection-export-mobile.css');
  });
  // Same-origin GETs pass through the worker, which validates and caches them.
  // Never preload the 40 MB voice model, APIs, private records or arbitrary URLs.
  await Promise.allSettled(urls.map(url => fetch(url, { cache: 'reload' })));
}
