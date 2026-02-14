/**
 * SITREP v6 - Protected Route
 * ============================
 * Guards routes that require authentication and optional role-based access.
 */

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  /** Optional list of roles allowed to access the route */
  roles?: UserRole[];
  /** Where to redirect unauthenticated users (default: /login) */
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  roles,
  redirectTo = '/login',
}) => {
  const { currentUser, isLoading } = useAuth();

  // Show spinner while auth state is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
          <p className="text-neutral-600 font-medium">Verificando autenticacion...</p>
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login
  if (!currentUser) {
    return <Navigate to={redirectTo} replace />;
  }

  // Authenticated but role not allowed -> access denied
  if (roles && roles.length > 0 && !roles.includes(currentUser.rol)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4 text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800">Acceso denegado</h2>
          <p className="text-neutral-600">
            No tienes permisos para acceder a esta seccion. Tu rol actual es{' '}
            <span className="font-medium">{currentUser.rol}</span>.
          </p>
          <a
            href="/dashboard"
            className="mt-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Volver al Dashboard
          </a>
        </div>
      </div>
    );
  }

  // All checks passed -> render child routes
  return <Outlet />;
};

export default ProtectedRoute;
