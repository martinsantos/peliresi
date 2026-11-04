import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UserRole } from '../../contexts/AuthContext';

const state = vi.hoisted(() => ({ role: 'ADMIN_GENERADOR' as UserRole }));
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ currentUser: { id:'reviewer', rol:state.role }, isLoading:false, isRestricted:false }),
}));
vi.mock('../../layouts/MainLayout', () => ({ MainLayout: () => <Outlet /> }));
vi.mock('../../layouts/MobileLayout', () => ({ MobileLayout: () => <Outlet /> }));
vi.mock('../../layouts/AuthLayout', () => ({ AuthLayout: () => <Outlet /> }));
vi.mock('../../components/AccessUnavailable', () => ({ default: () => <p>Acceso no disponible</p> }));
vi.mock('../../pages/notificaciones/OpenLinkPage', () => ({ default: () => null }));
vi.mock('../../pages/notificaciones/AvisoPage', () => ({ default: () => null }));
vi.mock('../../routes/pages', async () => {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const source = readFileSync(resolve(process.cwd(), 'src-v6/routes/pages.ts'), 'utf8');
  // Use real router nesting and guards, replacing only unrelated page bodies.
  return Object.fromEntries([...source.matchAll(/export const (\w+) =/g)].map(([, name]) => [name, () => <p>{name}</p>]));
});
import App from '../../App';
import AppMobile from '../../AppMobile';

afterEach(cleanup);
const surfaces = ['web', 'mobile-legacy', 'app'] as const;
function mount(surface: typeof surfaces[number], path = '/admin/renovaciones') {
  render(<MemoryRouter initialEntries={[(surface==='mobile-legacy'?'/mobile':'')+path]}>{surface==='app'?<AppMobile />:<App />}</MemoryRouter>);
}
describe.each(surfaces)('renewal access in %s', surface => {
  it.each(['ADMIN','ADMIN_GENERADOR','ADMIN_OPERADOR'] as const)('%s can reach the renewal work already authorized by the API', role => {
    state.role=role; mount(surface);
    expect(screen.getByText('AdminRenovacionesPage')).toBeInTheDocument();
    expect(screen.queryByText('Acceso no disponible')).not.toBeInTheDocument();
  });
  it.each(['ADMIN_TRANSPORTISTA','GENERADOR','TRANSPORTISTA','OPERADOR','AUDITOR'] as const)('%s remains outside administrative renewal review', role => {
    state.role=role; mount(surface);
    expect(screen.getByText('Acceso no disponible')).toBeInTheDocument();
    expect(screen.queryByText('AdminRenovacionesPage')).not.toBeInTheDocument();
  });
  it('does not grant treatment catalogue access to the generator administrator', () => {
    state.role='ADMIN_GENERADOR'; mount(surface,'/admin/tratamientos');
    expect(screen.getByText('Acceso no disponible')).toBeInTheDocument();
  });
});
