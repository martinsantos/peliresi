import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import ProtectedRoute from '../../components/ProtectedRoute';

const auth = vi.hoisted(() => ({
  currentUser: { rol: 'GENERADOR', esInspector: false, actorId: 'g-1' } as { rol: string; esInspector: boolean; actorId?: string } | null,
  isLoading: false, isRestricted: false, mount: vi.fn(),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));
function Ficha() { auth.mount(); return <h1>Ficha autorizada</h1>; }
function Destination() {
  const location = useLocation();
  return <output>{JSON.stringify({ path: location.pathname, from: location.state?.from })}</output>;
}
function open(path = '/admin/actores/generadores/g-1', basename?: string) {
  return render(<MemoryRouter basename={basename} initialEntries={[`${basename || ''}${path}`]}><Routes>
    <Route element={<ProtectedRoute actorRead="GENERADOR" />}>
      <Route path="/admin/actores/generadores/:id" element={<Ficha />} />
      <Route path="/mobile/admin/actores/generadores/:id" element={<Ficha />} />
      <Route path="/admin/actores/operadores/:id" element={<Ficha />} />
    </Route>
    <Route element={<ProtectedRoute roles={['ADMIN', 'ADMIN_GENERADOR']} />}>
      <Route path="/admin/actores/generadores/:id/editar" element={<Ficha />} />
    </Route>
    <Route path="/login" element={<Destination />} />
    <Route path="/mi-solicitud" element={<Destination />} />
    <Route path="/dashboard" element={<Destination />} />
    <Route path="/mobile/dashboard" element={<Destination />} />
  </Routes></MemoryRouter>);
}
beforeEach(() => {
  auth.currentUser = { rol: 'GENERADOR', esInspector: false, actorId: 'g-1' };
  auth.isLoading = false; auth.isRestricted = false; auth.mount.mockClear();
});
it('renders the exact own actor, not a role-wide consultation', () => {
  open(); expect(screen.getByRole('heading', { name: 'Ficha autorizada' })).toBeVisible();
});
it('rejects a foreign actor before mounting its screen', () => {
  open('/admin/actores/generadores/g-2');
  expect(screen.getByText('Acceso denegado')).toBeVisible(); expect(auth.mount).not.toHaveBeenCalled();
});
it('does not infer an actor association from the role', () => {
  auth.currentUser!.actorId = undefined; open();
  expect(screen.getByText('Acceso denegado')).toBeVisible(); expect(auth.mount).not.toHaveBeenCalled();
});
it('allows a designated inspector to consult a foreign actor', () => {
  auth.currentUser!.esInspector = true; open('/admin/actores/generadores/g-2');
  expect(screen.getByRole('heading', { name: 'Ficha autorizada' })).toBeVisible();
});
it('allows sectorial cross-category consultation without the editor', () => {
  auth.currentUser!.rol = 'ADMIN_OPERADOR'; const view = open();
  expect(screen.getByRole('heading', { name: 'Ficha autorizada' })).toBeVisible();
  view.unmount(); auth.mount.mockClear(); open('/admin/actores/generadores/g-1/editar');
  expect(screen.getByText('Acceso denegado')).toBeVisible(); expect(auth.mount).not.toHaveBeenCalled();
});
it('does not permit an actorRead guard to authorize a different category', () => {
  auth.currentUser!.rol = 'ADMIN'; open('/admin/actores/operadores/o-1');
  expect(screen.getByText('Acceso denegado')).toBeVisible(); expect(auth.mount).not.toHaveBeenCalled();
});
it('keeps loading from mounting an actor or deciding access prematurely', () => {
  auth.isLoading = true; open();
  expect(screen.getByText('Verificando autenticacion...')).toBeVisible(); expect(auth.mount).not.toHaveBeenCalled();
});
it('retains an anonymous return path including query and hash in the app basename', () => {
  auth.currentUser = null; open('/admin/actores/generadores/g-1?view=docs#registro', '/app');
  expect(screen.getByRole('status').textContent).toBe(JSON.stringify({ path: '/login', from: '/admin/actores/generadores/g-1?view=docs#registro' }));
  expect(auth.mount).not.toHaveBeenCalled();
});
it('restricted sessions cannot use the consultation exception', () => {
  auth.isRestricted = true; auth.currentUser!.esInspector = true; open();
  expect(screen.getByRole('status').textContent).toBe(JSON.stringify({ path: '/mi-solicitud' }));
  expect(auth.mount).not.toHaveBeenCalled();
});
it('provides a router exit to the mobile dashboard without losing the app basename', () => {
  open('/mobile/admin/actores/generadores/g-2', '/app');
  const back = screen.getByRole('link', { name: 'Volver al Dashboard' });
  expect(back).toHaveAttribute('href', '/app/mobile/dashboard'); fireEvent.click(back);
  expect(screen.getByRole('status').textContent).toBe(JSON.stringify({ path: '/mobile/dashboard' }));
});
