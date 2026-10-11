import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { SitrepMark } from '../components/SitrepMark';
import { ToastContainer } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';

/** A pending account can work on its application, not the full operations desk. */
export function ApplicantLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  return <div className="min-h-dvh bg-neutral-50">
    <header className="border-b border-primary-900 bg-primary-800 px-4 py-3 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <SitrepMark size={36} className="rounded-lg bg-white p-1" />
          <div className="min-w-0">
            <span className="text-xs font-semibold tracking-wide">SITREP</span>
            <h1 className="text-lg font-semibold !text-white">Mi solicitud</h1>
          </div>
        </div>
        <button type="button" onClick={() => { logout(); navigate(mp('/login'), { replace: true }); }}
          className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">
          <LogOut size={18} aria-hidden="true" />Salir
        </button>
      </div>
    </header>
    <main className="mx-auto max-w-4xl px-4 py-6"><Outlet /></main>
    <ToastContainer />
  </div>;
}
