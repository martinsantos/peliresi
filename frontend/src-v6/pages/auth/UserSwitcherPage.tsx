/**
 * UserSwitcherPage — Impersonación de usuarios (solo ADMIN)
 * ==========================================================
 * Usa la API real de impersonación (/admin/impersonate/:id).
 * Carga usuarios reales del backend, no credenciales hardcodeadas.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Shield, Factory, Truck, FlaskConical, User, ChevronRight, Loader2, Search, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_GROUP_LABELS } from '../../utils/roleGroupLabels';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'AUDITOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_GENERADOR' | 'ADMIN_OPERADOR';

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
  AUDITOR:            { label: 'Auditor',            icon: User,         color: 'text-slate-700',   bg: 'bg-slate-50',    border: 'border-slate-200' },
  ADMIN_TRANSPORTISTA:{ label: 'Adm. Transportistas',icon: User,         color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200' },
  ADMIN_GENERADOR:    { label: 'Adm. Generadores',  icon: User,         color: 'text-lime-700',    bg: 'bg-lime-50',     border: 'border-lime-200' },
  ADMIN_OPERADOR:     { label: 'Adm. Operadores',   icon: User,         color: 'text-teal-700',    bg: 'bg-teal-50',     border: 'border-teal-200' },
};

const ROL_ORDER: UserRole[] = ['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'AUDITOR', 'ADMIN_TRANSPORTISTA', 'ADMIN_GENERADOR', 'ADMIN_OPERADOR'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSector(u: ApiUsuario): string {
  return u.generador?.razonSocial || u.transportista?.razonSocial || u.operador?.razonSocial || u.empresa || u.email;
}

function getInitials(u: ApiUsuario): string {
  const name = [u.nombre, u.apellido].filter(Boolean).join(' ') || u.email;
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const UserSwitcherPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { impersonateUser } = useImpersonation();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<ApiUsuario[]>({
    queryKey: ['admin-usuarios-switcher', currentUser?.id],
    queryFn: () => api.get('/admin/usuarios', { params: { limit: 200 } }).then(r => r.data?.data?.usuarios || []),
    staleTime: 2 * 60_000,
    enabled: currentUser?.rol === 'ADMIN',
  });

  const usuarios: ApiUsuario[] = useMemo(() => {
    const list = data || [];
    // Exclude current user and already-impersonated user
    const term = search.trim().toLocaleLowerCase('es-AR');
    return list.filter(u => String(u.id) !== String(currentUser?.id) && u.activo && (!term ||
      `${u.nombre} ${u.apellido || ''} ${u.email} ${getSector(u)} ${ROL_CONFIG[u.rol]?.label || u.rol}`.toLocaleLowerCase('es-AR').includes(term)));
  }, [data, currentUser?.id, search]);

  const byRole = useMemo(() => {
    const map: Record<string, ApiUsuario[]> = {};
    for (const u of usuarios) {
      if (!map[u.rol]) map[u.rol] = [];
      map[u.rol].push(u);
    }
    return map;
  }, [usuarios]);

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

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-neutral-800">Buscar usuario</span>
          <span className="flex min-h-12 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-3 focus-within:border-primary-700 focus-within:ring-2 focus-within:ring-primary-100">
            <Search size={19} className="shrink-0 text-neutral-600" aria-hidden="true" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre, correo, entidad o rol" className="w-full bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-500" />
          </span>
        </label>

        {/* Estado de carga / error */}
        {isLoading && (
          <div role="status" className="flex items-center justify-center gap-3 py-12 text-neutral-700">
            <Loader2 size={32} className="text-emerald-500 animate-spin" />
            <span>Cargando usuarios…</span>
          </div>
        )}

        {isError && (
          <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
            <p className="font-semibold">No se pudieron cargar los usuarios</p>
            <p className="mt-1 text-sm">Comprobá la conexión o renová tu sesión. No se cambió de cuenta.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-red-700 bg-white px-3 font-semibold text-red-900"><RefreshCw size={16} aria-hidden="true" /> Reintentar</button>
          </div>
        )}

        {actionError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-900">{actionError}</p>}

        {/* Lista por rol */}
        {!isLoading && !isError && <p className="text-sm font-medium text-neutral-600">{usuarios.length} {usuarios.length === 1 ? 'usuario disponible' : 'usuarios disponibles'}</p>}
        {!isLoading && !isError && ROL_ORDER.map(rol => {
          const group = byRole[rol];
          if (!group || group.length === 0) return null;
          const cfg = ROL_CONFIG[rol] || ROL_CONFIG.AUDITOR;
          const Icon = cfg.icon;

          return (
            <section key={rol} className="overflow-hidden rounded-xl border border-neutral-200 bg-white" aria-label={cfg.label}>
              {/* Cabecera del grupo */}
              <div className={`flex items-center gap-2 border-b px-4 py-3 ${cfg.bg} ${cfg.border}`}>
                <Icon size={16} className={cfg.color} />
                <span className={`font-semibold text-sm ${cfg.color}`}>{ROLE_GROUP_LABELS[rol] || cfg.label}</span>
                <span className="ml-auto text-xs font-medium text-neutral-500 bg-white/70 px-2 py-0.5 rounded-full">
                  {group.length}
                </span>
              </div>

              {/* Usuarios */}
              <div className="divide-y divide-neutral-100">
                {group.map(u => (
                  <button
                    key={u.id}
                    onClick={() => handleImpersonate(u)}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-700"
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                      {getInitials(u)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-neutral-900 truncate">
                        {[u.nombre, u.apellido].filter(Boolean).join(' ') || u.email}
                      </p>
                      <p className="truncate text-sm text-neutral-600">{getSector(u)}</p>
                    </div>

                    <ChevronRight size={16} className="text-neutral-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {/* Sin usuarios */}
        {!isLoading && !isError && usuarios.length === 0 && (
          <div className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-neutral-700">
            <User size={32} className="mx-auto mb-3" aria-hidden="true" />
            <p className="font-medium">{search ? 'No hay usuarios que coincidan con la búsqueda' : 'No hay otros usuarios activos'}</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserSwitcherPage;
