/**
 * UserSwitcherPage — Impersonación de usuarios (solo ADMIN)
 * ==========================================================
 * Usa la API real de impersonación (/admin/impersonate/:id).
 * Carga usuarios reales del backend, no credenciales hardcodeadas.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Shield, Factory, Truck, FlaskConical, ClipboardCheck, User, ChevronRight, ChevronDown, Loader2, Search, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_GROUP_LABELS } from '../../utils/roleGroupLabels';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'INSPECTOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_GENERADOR' | 'ADMIN_OPERADOR';

interface ApiUsuario {
  id: string;
  nombre: string;
  apellido?: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  empresa?: string;
  generador?: { razonSocial: string };
  transportista?: { razonSocial: string };
  operador?: { razonSocial: string };
}

// ─── Configuración de roles ───────────────────────────────────────────────────

const ROL_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  ADMIN:              { label: 'Administrador',      icon: Shield,       color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  GENERADOR:          { label: 'Generador',          icon: Factory,      color: 'text-purple-700',  bg: 'bg-purple-50',   border: 'border-purple-200' },
  TRANSPORTISTA:      { label: 'Transportista',      icon: Truck,        color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200' },
  OPERADOR:           { label: 'Operador',           icon: FlaskConical, color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200' },
  INSPECTOR:          { label: 'Inspector',          icon: ClipboardCheck, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  ADMIN_TRANSPORTISTA:{ label: 'Adm. Transportistas',icon: User,         color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  ADMIN_GENERADOR:    { label: 'Adm. Generadores',  icon: User,         color: 'text-lime-700',    bg: 'bg-lime-50',     border: 'border-lime-200' },
  ADMIN_OPERADOR:     { label: 'Adm. Operadores',   icon: User,         color: 'text-teal-700',    bg: 'bg-teal-50',     border: 'border-teal-200' },
};

const ROL_ORDER: UserRole[] = ['ADMIN', 'INSPECTOR', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSector(u: ApiUsuario): string {
  return u.generador?.razonSocial || u.transportista?.razonSocial || u.operador?.razonSocial || u.empresa || u.email;
}

function getInitials(u: ApiUsuario): string {
  const name = [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email;
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface UserPage { usuarios: ApiUsuario[]; pagination: { total: number; pages: number } }

/** Each role has its own server page: a large generator roster cannot starve operators. */
function RoleUsers({ rol, search, adminId, training, onSelect }: { rol: UserRole; search: string; adminId: string; training: boolean; onSelect: (user: ApiUsuario) => void }) {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(true);
  const cfg = ROL_CONFIG[rol];
  const Icon = cfg.icon;
  const label = rol === 'INSPECTOR' ? 'Inspectores' : ROLE_GROUP_LABELS[rol];
  const { data, isLoading, isError, refetch } = useQuery<UserPage>({
    queryKey: ['admin-usuarios-switcher', adminId, rol, search, page, training],
    queryFn: async () => (await api.get(training ? '/admin/training/usuarios' : '/admin/usuarios', { params: {
      limit: 5, page, activo: 'true', excludeSelf: 'true', sortBy: 'nombre', sortOrder: 'asc',
      esInspector: rol === 'INSPECTOR' ? 'true' : 'false',
      ...(rol === 'INSPECTOR' ? {} : { rol }), ...(search ? { search } : {}),
    } })).data.data,
    staleTime: 2 * 60_000,
  });
  const users = data?.usuarios || [];
  const total = data?.pagination.total || 0;
  return <section aria-label={label} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
    <button type="button" aria-expanded={open} aria-controls={`users-${rol}`} onClick={() => setOpen(value => !value)}
      className={`flex min-h-12 w-full items-center gap-2 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700 ${cfg.bg} ${cfg.color}`}>
      <Icon size={18} aria-hidden="true" className="shrink-0" /><span className="flex-1 font-semibold">{label}</span>
      {!isLoading && !isError && <span className="text-sm tabular-nums">{total}</span>}
      <ChevronDown size={18} aria-hidden="true" className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
    {open && <div id={`users-${rol}`}>
      {isLoading && <p role="status" className="flex items-center gap-2 p-4"><Loader2 size={18} className="animate-spin" /> Cargando…</p>}
      {isError && <div role="alert" className="p-4 text-red-800">No se pudo cargar esta categoría.
        <button type="button" onClick={() => void refetch()} className="mt-2 flex min-h-11 items-center gap-2 font-semibold"><RefreshCw size={16} /> Reintentar {label.toLowerCase()}</button>
      </div>}
      {!isLoading && !isError && <>
        {users.length === 0 && <p className="px-4 py-3 text-sm text-neutral-600">{search ? 'Sin coincidencias en esta categoría.' : 'No hay otros usuarios activos en esta categoría.'}</p>}
        <div className="divide-y divide-neutral-100">{users.slice(0, 5).map(u => <button type="button" key={u.id} onClick={() => onSelect(u)}
          aria-label={`Ver como ${[u.nombre, u.apellido].filter(Boolean).join(' ') || u.email}, ${getSector(u)}`}
          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${cfg.bg} ${cfg.color}`} aria-hidden="true">{getInitials(u)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-medium text-neutral-900">{[u.nombre, u.apellido].filter(Boolean).join(' ') || u.email}</span>
            <span className="block truncate text-sm text-neutral-600">{getSector(u)}</span></span>
          <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-neutral-500" />
        </button>)}</div>
        {(total > 5 || page > 1) && <nav aria-label={`Páginas de ${label.toLowerCase()}`} className="flex items-center justify-between gap-2 border-t px-3 py-1 text-sm">
          <button type="button" disabled={page === 1} onClick={() => setPage(value => value - 1)} className="min-h-11 px-2 font-semibold disabled:opacity-40">Anterior</button>
          <span className="text-neutral-600 tabular-nums">{page} / {Math.max(page, data?.pagination.pages || 1)}</span>
          <button type="button" disabled={page >= (data?.pagination.pages || 1)} onClick={() => setPage(value => value + 1)} className="min-h-11 px-2 font-semibold disabled:opacity-40">Siguiente</button>
        </nav>}
      </>}
    </div>}
  </section>;
}

export const UserSwitcherPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { impersonateUser } = useImpersonation();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [training, setTraining] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handleImpersonate = async (u: ApiUsuario) => {
    setActionError(null);
    setLoadingId(String(u.id));
    try {
      await impersonateUser(String(u.id));
      // impersonateUser does window.location.href = '/dashboard', so this won't run
    } catch (err) {
      console.error('Impersonation failed:', err);
      setActionError('No se pudo abrir la vista temporal. Tu sesión no cambió. Intentá nuevamente.');
      setLoadingId(null);
    }
  };

  if (currentUser?.rol !== 'ADMIN') {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-bold text-neutral-900">Cambio de usuario no disponible</h1>
        <p className="mt-2 text-base text-neutral-700">Esta función pertenece a una cuenta administradora. Tu sesión actual no cambió.</p>
        <button type="button" onClick={() => navigate('/dashboard')} className="mt-5 min-h-11 rounded-lg bg-primary-800 px-4 font-semibold text-white">Volver al inicio</button>
      </div>
    );
  }

  // Loading overlay
  if (loadingId !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-emerald-500 animate-spin" />
          <p className="font-semibold text-neutral-700">Cambiando a otro usuario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-1 pb-8 pt-2 sm:px-4" data-testid="user-switcher-page">
      <div className="space-y-5">

        {/* Header */}
        <div>
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-neutral-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Volver
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">Ver como otro usuario</h1>
          <p className="mt-1 text-base text-neutral-700">Vista temporal para comprobar su experiencia. Podés volver a tu cuenta en cualquier momento.</p>
        </div>

        <div role="group" aria-label="Ámbito de usuarios" className="flex flex-wrap gap-2">
          {[false, true].map(value => <button type="button" key={String(value)} aria-pressed={training === value} onClick={() => setTraining(value)}
            className={`min-h-11 rounded-lg border px-4 font-semibold ${training === value ? 'border-primary-800 bg-primary-800 text-white' : 'border-neutral-300 bg-white text-neutral-800'}`}>
            {value ? 'Capacitación' : 'Operación real'}
          </button>)}
        </div>
        {training && <p role="status" className="text-sm font-medium text-amber-900">Sólo datos de práctica. Sin envíos ni documentos oficiales.</p>}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-neutral-800">Buscar usuario</span>
          <span className="flex min-h-12 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-3 focus-within:border-primary-700 focus-within:ring-2 focus-within:ring-primary-100">
            <Search size={19} className="shrink-0 text-neutral-600" aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, correo o entidad" className="w-full bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-500" />
          </span>
        </label>

        {actionError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-900">{actionError}</p>}
        <p className="text-sm text-neutral-600">Hasta cinco por categoría. Buscá en todo el padrón o usá las páginas de cada grupo.</p>
        {ROL_ORDER.map(rol => <RoleUsers key={rol + ':' + debouncedSearch + ':' + training} rol={rol} search={debouncedSearch} training={training}
          adminId={String(currentUser.id)} onSelect={handleImpersonate} />)}

      </div>
    </div>
  );
};

export default UserSwitcherPage;
