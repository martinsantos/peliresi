import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '../../contexts/AuthContext';
import ProtectedRoute from '../../components/ProtectedRoute';
import { AuthGate } from '../../AppMobile';

const auth = vi.hoisted(() => ({
  currentUser: null as User | null, isLoading: false, isRestricted: false,
  queryForbiddenScreen: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth, AuthProvider: ({ children }: any) => children }));

function PrivateScreen() {
  auth.queryForbiddenScreen();
  return <h1>Contenido reservado</h1>;
}
function CurrentPage() {
  return <h1>{useLocation().pathname.endsWith('/mi-perfil') ? 'Mi perfil' : 'Inicio'}</h1>;
}
function open(surface: 'web' | 'app' | 'mobile', target = '/admin/actores/generadores/other') {
  const prefix = surface === 'mobile' ? '/mobile' : '';
  const basename = surface === 'app' ? '/app' : '';
  const routes = () => <Routes>
    <Route path={`${prefix}/dashboard`} element={<CurrentPage />} />
    <Route path={`${prefix}/mi-perfil`} element={<CurrentPage />} />
    {surface === 'app'
      ? <Route path="*" element={<PrivateScreen />} />
      : <Route element={<ProtectedRoute />}><Route path="*" element={<PrivateScreen />} /></Route>}
  </Routes>;
  const view = () => <MemoryRouter basename={basename} initialEntries={[`${basename}${prefix}${target}?origen=aviso#documentos`]}>
    {surface === 'app' ? <AuthGate>{routes()}</AuthGate> : routes()}
  </MemoryRouter>;
  return { ...render(view()), view };
}
beforeEach(() => {
  auth.currentUser = { id: 'synthetic-user', nombre: 'QA Operador', rol: 'OPERADOR', actorId: 'own', actividades: ['OPERADOR', 'GENERADOR'] } as User;
  auth.isLoading = false; auth.isRestricted = false; auth.queryForbiddenScreen.mockClear();
});

describe.each(['web', 'app', 'mobile'] as const)('access orientation in %s', surface => {
  it.each(['/admin/actores/generadores/other', '/inspecciones', '/admin/usuarios'])('explains the boundary before any child read at %s', target => {
    open(surface, target);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Acceso no disponible');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(screen.getByText('Rol activo: Operador')).toBeVisible();
    expect(screen.getByText('QA Operador')).toBeVisible();
    expect(screen.queryByText('Contenido reservado')).not.toBeInTheDocument();
    expect(auth.queryForbiddenScreen).not.toHaveBeenCalled();
  });
  it.each(['Ir a Inicio', 'Revisar mi actividad'])('offers a safe exit through %s', action => {
    open(surface);
    fireEvent.click(screen.getByRole('button', { name: action }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(action === 'Ir a Inicio' ? 'Inicio' : 'Mi perfil');
    expect(auth.queryForbiddenScreen).not.toHaveBeenCalled();
  });
  it('reevaluates a role change without exposing the former account or actor', () => {
    const result = open(surface);
    auth.currentUser = { ...auth.currentUser!, nombre: 'QA Generador', rol: 'GENERADOR', actorId: 'still-not-other' };
    result.rerender(result.view());
    expect(screen.getByText('Rol activo: Generador')).toBeVisible();
    expect(screen.queryByText('QA Operador')).not.toBeInTheDocument();
    expect(auth.queryForbiddenScreen).not.toHaveBeenCalled();
    auth.currentUser = { ...auth.currentUser!, actorId: 'other' };
    result.rerender(result.view());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Contenido reservado');
  });
  it('still permits a designated inspector', () => {
    auth.currentUser = { ...auth.currentUser!, esInspector: true };
    open(surface, '/inspecciones');
    expect(screen.getByRole('heading')).toHaveTextContent('Contenido reservado');
  });
});
