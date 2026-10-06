// Return a router path; BrowserRouter adds /app/ for the standalone app.
export function monitorReturnPath(pathname: string): string {
  return /^\/mobile(?:\/|$)/.test(pathname) ? '/mobile/centro-control' : '/centro-control';
}
