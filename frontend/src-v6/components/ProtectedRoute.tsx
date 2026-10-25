/**
 * SITREP v6 - Protected Route
 * ============================
 * Guards routes that require authentication and optional role-based access.
 */

import React from 'react';
import { canAccessMobilePath } from '../utils/mobileAccess';
import { LoadingIndicator } from './ui/LoadingState';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import AccessUnavailable from './AccessUnavailable';
import { useAuth, type UserRole } from '../contexts/AuthContext';
import { actorDetailFromPath, canReadActorDetail, type ActorReadType } from '../utils/actorReadAccess';

interface ProtectedRouteProps {
  /** Optional list of roles allowed to access the route */
  roles?: UserRole[];
  /** Read-only actor detail routes may also be consulted by designated inspectors. */
  allowInspector?: boolean;
  /** Exact actor consultation; administrative actions keep their own guards. */
  actorRead?: ActorReadType;
  /** Where to redirect unauthenticated users (default: /login) */
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  roles,
  allowInspector = false,
  actorRead,
  redirectTo = '/login',
}) => {
  const { currentUser, isLoading, isRestricted, signOutRedirectPending } = useAuth();
  const location = useLocation();

  // Show spinner while auth state is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-4">
          <LoadingIndicator label="Verificando tu sesión…" size={40} />
        </div>
      </div>
    );
  }

  // Not authenticated -> redirect to login (save origin for post-login redirect)
  if (!currentUser) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={redirectTo} state={signOutRedirectPending ? null : { from }} replace />;
  }

  // Restricted users can only access /mi-solicitud
  if (isRestricted && !location.pathname.startsWith('/mi-solicitud')) {
    return <Navigate to="/mi-solicitud" replace />;
  }

  // Share the app's route boundary before rendering a page or fetching its data.
  if (!canAccessMobilePath(currentUser, location.pathname)) {
    return <AccessUnavailable />;
  }

  // Authenticated but role not allowed -> access denied
  const actor = actorRead ? actorDetailFromPath(location.pathname) : null;
  const actorDenied = actorRead && (!actor || actor.type !== actorRead || !canReadActorDetail(currentUser, actorRead, actor.id));
  if (actorDenied || (roles && roles.length > 0 && !roles.includes(currentUser.rol) && !(allowInspector && currentUser.esInspector))) {
    return <AccessUnavailable />;
  }

  // All checks passed -> render child routes
  return <Outlet />;
};

export default ProtectedRoute;
