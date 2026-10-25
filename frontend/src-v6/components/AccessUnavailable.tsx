import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LockKeyhole, UserRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMobilePrefix } from '../hooks/useMobilePrefix';
import { workspaceRoleLabel } from '../utils/workspaceNavigation';
import { SitrepMark, SitrepWordmark } from './SitrepMark';
import { Button } from './ui/ButtonV2';

/** Route boundary: never mount or query the inaccessible screen. */
export default function AccessUnavailable() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const mp = useMobilePrefix();
  const title = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    title.current?.focus();
  }, [location.pathname, currentUser?.id, currentUser?.rol]);

  return (
    <main className="min-h-dvh bg-neutral-50 px-4 py-8 sm:p-8">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <SitrepMark size={32} />
          <SitrepWordmark />
        </div>
        <section className="space-y-6 rounded-xl border border-neutral-200 bg-white p-4 sm:p-6" aria-labelledby="access-unavailable-title">
          <div className="space-y-3">
            <LockKeyhole className="text-primary-800" size={28} aria-hidden="true" />
            <h1 id="access-unavailable-title" ref={title} tabIndex={-1} className="text-xl font-semibold text-neutral-900 focus:outline-none">Acceso no disponible</h1>
            <p className="text-neutral-700">Este enlace no está disponible para tu rol actual. Podés continuar desde Inicio o revisar tu actividad en Mi perfil.</p>
          </div>
          <div className="border-y border-neutral-200 py-4 text-sm break-words">
            <p className="font-semibold text-neutral-900">{currentUser?.nombre}</p>
            <p className="text-neutral-600">Rol activo: {workspaceRoleLabel(currentUser?.rol || '')}</p>
            {currentUser?.empresaContexto && <p className="mt-1 text-neutral-700">{currentUser.empresaContexto.razonSocial}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button leftIcon={<Home size={18} aria-hidden="true" />} onClick={() => navigate(mp('/dashboard'), { replace: true })}>Ir a Inicio</Button>
            <Button variant="outline" leftIcon={<UserRound size={18} aria-hidden="true" />} onClick={() => navigate(mp('/mi-perfil'), { replace: true })}>Revisar mi actividad</Button>
          </div>
        </section>
      </div>
    </main>
  );
}
