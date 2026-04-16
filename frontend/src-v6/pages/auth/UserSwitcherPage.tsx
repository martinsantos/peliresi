/**
 * UserSwitcherPage — Impersonación de usuarios (solo ADMIN)
 * ==========================================================
 * Usa la API real de impersonación (/admin/impersonate/:id).
 * Carga usuarios reales del backend, no credenciales hardcodeadas.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Shield, Factory, Truck, FlaskConical, User, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useImpersonation } from '../../contexts/ImpersonationContext';
import { useAuth } from '../../contexts/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type UserRole = 'ADMIN' | 'GENERADOR' | 'TRANSPORTISTA' | 'OPERADOR' | 'AUDITOR' | 'ADMIN_TRANSPORTISTA' | 'ADMIN_GENERADOR' | 'ADMIN_OPERADOR';

interface ApiUsuario {
  id: number;
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
  const { impersonateUser, impersonationData } = useImpersonation();
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery<ApiUsuario[]>({
    queryKey: ['admin-usuarios-switcher'],
    queryFn: () => api.get('/admin/usuarios', { params: { limit: 200 } }).then(r => r.data?.data?.usuarios || []),
    staleTime: 2 * 60_000,
  });

  const usuarios: ApiUsuario[] = useMemo(() => {
    const list = data || [];
    // Exclude current user and already-impersonated user
    return list.filter(u => u.id !== currentUser?.id && u.activo);
  }, [data, currentUser]);

  const byRole = useMemo(() => {
    const map: Record<string, ApiUsuario[]> = {};
    for (const u of usuarios) {
      if (!map[u.rol]) map[u.rol] = [];
      map[u.rol].push(u);
    }
    return map;
  }, [usuarios]);

  const handleImpersonate = async (u: ApiUsuario) => {
    setLoadingId(u.id);
    try {
      await impersonateUser(String(u.id));
      // impersonateUser does window.location.href = '/dashboard', so this won't run
    } catch (err) {
      console.error('Impersonation failed:', err);
      setLoadingId(null);
    }
  };

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
    <div className="min-h-screen bg-neutral-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-sm font-medium text-neutral-700 transition-colors"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Cambiar Usuario</h1>
            <p className="text-neutral-500 text-sm">Selecciona un usuario para impersonarlo</p>
          </div>
        </div>

        {/* Banner informativo */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-4 text-white">
          <p className="font-semibold">Acceso Comodín — Impersonación de Usuarios</p>
          <p className="text-emerald-100 text-sm mt-1">
            Tomarás el control total de la sesión del usuario seleccionado. Aparecerá
            una barra naranja para recordarte que estás en modo impersonación.
            {impersonationData && (
              <span className="font-bold"> Ya estás impersonando a {impersonationData.impersonatedUser.nombre}.</span>
            )}
          </p>
        </div>

        {/* Estado de carga / error */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="text-emerald-500 animate-spin" />
          </div>
        )}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            Error al cargar usuarios. Verificá que tenés rol ADMIN.
          </div>
        )}

        {/* Lista por rol */}
        {!isLoading && !isError && ROL_ORDER.map(rol => {
          const group = byRole[rol];
          if (!group || group.length === 0) return null;
          const cfg = ROL_CONFIG[rol] || ROL_CONFIG.AUDITOR;
          const Icon = cfg.icon;

          return (
            <div key={rol} className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm">
              {/* Cabecera del grupo */}
              <div className={`flex items-center gap-2 px-4 py-3 ${cfg.bg} border-b ${cfg.border}`}>
                <Icon size={16} className={cfg.color} />
                <span className={`font-semibold text-sm ${cfg.color}`}>{cfg.label}s</span>
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
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
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
                      <p className="text-xs text-neutral-500 truncate">{getSector(u)}</p>
                    </div>

                    <ChevronRight size={16} className="text-neutral-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {/* Sin usuarios */}
        {!isLoading && !isError && usuarios.length === 0 && (
          <div className="text-center py-12 text-neutral-400">
            <User size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay otros usuarios activos</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default UserSwitcherPage;
